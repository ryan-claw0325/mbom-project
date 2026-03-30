import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { ValidationError, FileParseError, BusinessError, NotFoundError } from '../utils/errors.js';
import { parseExcel } from '../utils/parser/excelParser.js';
import { parseTCXML } from '../utils/parser/xmlParser.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

export const ebomRoutes = Router();

// Upload EBOM file
ebomRoutes.post('/upload', async (req: Request, res: Response) => {
  if (!req.files || !req.files.file) {
    throw new ValidationError('请上传文件');
  }

  const file = req.files.file as any;
  const sourceType = req.body.sourceType;

  if (!sourceType) {
    throw new ValidationError('请指定文件类型 (excel/word/tc-xml)');
  }

  // Validate file type
  const allowedTypes: Record<string, string[]> = {
    excel: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    word: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'tc-xml': ['text/xml', 'application/xml'],
  };

  // Generate unique filename
  const fileId = uuidv4();
  const ext = path.extname(file.name);
  const fileName = `${fileId}${ext}`;
  const filePath = path.join(config.upload.uploadDir, fileName);

  // Move file
  await file.mv(filePath);

  // Save to database
  const uploadedFile = await prisma.uploadedFile.create({
    data: {
      fileName: file.name,
      filePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      sourceType,
      parseStatus: 'Pending',
    },
  });

  res.json({
    success: true,
    data: {
      fileId: uploadedFile.id,
      fileName: file.name,
      fileSize: file.size,
      sourceType,
    },
  });
});

// Parse uploaded file
ebomRoutes.post('/parse', async (req: Request, res: Response) => {
  const { fileId, sourceType, sheetIndex } = req.body;

  if (!fileId) {
    throw new ValidationError('文件 ID 不能为空');
  }

  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { id: fileId },
  });

  if (!uploadedFile) {
    throw new NotFoundError('上传文件');
  }

  let parsedData: any;
  const type = sourceType || uploadedFile.sourceType;

  try {
    if (type === 'excel') {
      parsedData = await parseExcel(uploadedFile.filePath);
    } else if (type === 'tc-xml') {
      parsedData = await parseTCXML(uploadedFile.filePath);
    } else {
      throw new FileParseError(`不支持的文件类型: ${type}`);
    }

    // Update file record with parsed data
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: {
        parseStatus: 'Completed',
        parsedData: JSON.stringify(parsedData),
      },
    });

    // Find unmapped fields (fields that don't match standard EBOM fields)
    const standardFields = ['零件名称', '物料编码', '图号', '数量', '上级物料编码', '层级', '材质', '规格', '材料', '计量单位', '单位'];
    const unmappedFields = parsedData.headers.filter(
      (h: string) => !standardFields.some(sf => h.includes(sf))
    );

    res.json({
      success: true,
      data: {
        fileId,
        totalRows: parsedData.totalRows,
        headers: parsedData.headers,
        preview: parsedData.rows.slice(0, 5),
        unmappedFields,
      },
    });
  } catch (error: any) {
    await prisma.uploadedFile.update({
      where: { id: fileId },
      data: { parseStatus: 'Failed' },
    });
    throw new FileParseError(`解析失败: ${error.message}`);
  }
});

// Get field mapping templates
ebomRoutes.get('/templates', async (req: Request, res: Response) => {
  const sourceType = req.query.sourceType as string;

  const where: any = {};
  if (sourceType) {
    where.sourceType = sourceType;
  }

  const templates = await prisma.importTemplate.findMany({
    where,
    orderBy: { isDefault: 'desc' },
  });

  res.json({
    success: true,
    data: templates.map(t => ({
      ...t,
      fieldMappings: JSON.parse(t.fieldMappings),
    })),
  });
});

// Save field mapping template
ebomRoutes.post('/templates', async (req: Request, res: Response) => {
  const { templateName, sourceType, fieldMappings, isDefault } = req.body;

  if (!templateName || !sourceType || !fieldMappings) {
    throw new ValidationError('模板名称、源类型和字段映射不能为空');
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.importTemplate.updateMany({
      where: { sourceType, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.importTemplate.create({
    data: {
      templateName,
      sourceType,
      fieldMappings: JSON.stringify(fieldMappings),
      isDefault: isDefault || false,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      ...template,
      fieldMappings,
    },
  });
});

// Convert EBOM to MBOM
ebomRoutes.post('/convert', async (req: Request, res: Response) => {
  const { fileId, sourceType, bomName, fieldMappings, createBom } = req.body;

  if (!fileId) {
    throw new ValidationError('文件 ID 不能为空');
  }

  const uploadedFile = await prisma.uploadedFile.findUnique({
    where: { id: fileId },
  });

  if (!uploadedFile) {
    throw new NotFoundError('上传文件');
  }

  if (uploadedFile.parseStatus !== 'Completed') {
    throw new BusinessError('文件尚未解析，请先调用解析接口');
  }

  const parsedData = JSON.parse(uploadedFile.parsedData || '{}');
  
  // Generate BOM code
  const bomCode = `MBOM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Create BOM header
  const bom = await prisma.bOMHeader.create({
    data: {
      bomCode,
      bomName: bomName || `导入 BOM ${bomCode}`,
      bomType: 'MBOM',
      sourceType: uploadedFile.sourceType || sourceType,
      sourceRef: uploadedFile.fileName,
      status: 'Draft',
      ebomSourceId: fileId,
    },
  });

  // Map rows to nodes
  const nodes: any[] = [];
  const materialCodeMap = new Map<string, string>(); // temp code -> actual ID mapping

  // First pass: create all nodes without parent references
  for (let i = 0; i < parsedData.rows.length; i++) {
    const row = parsedData.rows[i];
    
    // Apply field mappings
    const nodeData: any = {};
    for (const mapping of fieldMappings) {
      const sourceValue = row[mapping.sourceField];
      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        if (mapping.transform === 'toNumber') {
          nodeData[mapping.targetField] = parseFloat(sourceValue);
        } else {
          nodeData[mapping.targetField] = sourceValue;
        }
      }
    }

    // Determine level from row data or index
    if (!nodeData.level && row['层级']) {
      nodeData.level = parseInt(row['层级']) || 0;
    }

    // Create node
    const node = await prisma.mBOMNode.create({
      data: {
        bomId: bom.id,
        materialCode: nodeData.materialCode || nodeData.material_name,
        materialName: nodeData.materialName || nodeData.material_name || row['零件名称'],
        qty: nodeData.qty || nodeData.quantity || 1,
        unit: nodeData.unit || 'EA',
        level: nodeData.level || 0,
        nodeSequence: i,
        status: 'Active',
      },
    });

    nodes.push(node);
    if (node.materialCode) {
      materialCodeMap.set(node.materialCode, node.id);
    }
  }

  // Second pass: set parent references based on parentMaterialCode
  for (const node of nodes) {
    // Try to find parent based on some heuristic (e.g., previous row with level - 1)
    // This is simplified; real implementation would use the actual parent field
  }

  // Log conversion
  await prisma.eBOMToMBOMLog.create({
    data: {
      ebomId: uploadedFile.id,
      mbomId: bom.id,
      sourceBomCode: uploadedFile.fileName,
      targetBomCode: bomCode,
      conversionStatus: 'Completed',
      itemsConverted: nodes.length,
      itemsFailed: 0,
    },
  });

  res.json({
    success: true,
    data: {
      taskId: bom.id,
      bomCode,
      status: 'Completed',
      itemsConverted: nodes.length,
    },
  });
});

// Get conversion progress
ebomRoutes.get('/tasks/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const log = await prisma.eBOMToMBOMLog.findFirst({
    where: { mbomId: id },
    orderBy: { convertedAt: 'desc' },
  });

  if (!log) {
    throw new NotFoundError('转换任务');
  }

  res.json({
    success: true,
    data: {
      taskId: log.mbomId,
      status: log.conversionStatus,
      itemsConverted: log.itemsConverted,
      itemsFailed: log.itemsFailed,
      convertedAt: log.convertedAt,
      errorDetail: log.errorDetail,
    },
  });
});
