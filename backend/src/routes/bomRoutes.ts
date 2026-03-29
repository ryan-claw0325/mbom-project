import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { NotFoundError, ValidationError, BusinessError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

export const bomRoutes = Router();

// Get all BOMs with pagination
bomRoutes.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const keyword = req.query.keyword as string;
  const status = req.query.status as string;

  const skip = (page - 1) * pageSize;

  const where: any = {};
  if (keyword) {
    where.OR = [
      { bomCode: { contains: keyword } },
      { bomName: { contains: keyword } },
    ];
  }
  if (status) {
    where.status = status;
  }

  const [boms, total] = await Promise.all([
    prisma.bOMHeader.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { nodes: true } },
      },
    }),
    prisma.bOMHeader.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      list: boms.map(bom => ({
        ...bom,
        nodeCount: (bom as any)._count?.nodes || 0,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  });
});

// Get single BOM with tree structure
bomRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const bom = await prisma.bOMHeader.findUnique({
    where: { id },
    include: {
      nodes: {
        orderBy: [{ level: 'asc' }, { nodeSequence: 'asc' }],
      },
    },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  res.json({
    success: true,
    data: bom,
  });
});

// Get BOM tree structure
bomRoutes.get('/:id/tree', async (req: Request, res: Response) => {
  const { id } = req.params;

  const bom = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  const nodes = await prisma.mBOMNode.findMany({
    where: { bomId: id },
    orderBy: [{ level: 'asc' }, { nodeSequence: 'asc' }],
    include: {
      material: true,
      specRels: {
        include: {
          spec: true,
          operation: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: {
      bom: {
        id: bom.id,
        bomCode: bom.bomCode,
        bomName: bom.bomName,
        version: bom.version,
        status: bom.status,
      },
      nodes,
    },
  });
});

// Create new BOM
bomRoutes.post('/', async (req: Request, res: Response) => {
  const { bomCode, bomName, bomType, productModel, sourceType, sourceRef, createdBy } = req.body;

  if (!bomCode || !bomName) {
    throw new ValidationError('BOM 编码和名称不能为空');
  }

  // Check if bomCode already exists
  const existing = await prisma.bOMHeader.findUnique({
    where: { bomCode },
  });

  if (existing) {
    throw new BusinessError(`BOM 编码 ${bomCode} 已存在`);
  }

  const bom = await prisma.bOMHeader.create({
    data: {
      bomCode,
      bomName,
      bomType: bomType || 'MBOM',
      productModel,
      sourceType,
      sourceRef,
      createdBy,
      status: 'Draft',
    },
  });

  // Log creation
  await prisma.bOMVersionLog.create({
    data: {
      bomId: bom.id,
      changeType: 'Create',
      changeDesc: '创建 BOM',
      changedBy: createdBy,
    },
  });

  res.status(201).json({
    success: true,
    data: bom,
  });
});

// Update BOM
bomRoutes.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('BOM');
  }

  const bom = await prisma.bOMHeader.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: bom,
  });
});

// Delete BOM
bomRoutes.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('BOM');
  }

  await prisma.bOMHeader.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: 'BOM 删除成功',
  });
});

// Add node to BOM
bomRoutes.post('/:id/nodes', async (req: Request, res: Response) => {
  const { id } = req.params;
  const nodeData = req.body;

  const bom = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  // Calculate level based on parent
  let level = 0;
  if (nodeData.parentNodeId) {
    const parent = await prisma.mBOMNode.findUnique({
      where: { id: nodeData.parentNodeId },
    });
    if (parent) {
      level = parent.level + 1;
    }
  }

  // Get next sequence number
  const siblings = await prisma.mBOMNode.findMany({
    where: { bomId: id, parentNodeId: nodeData.parentNodeId || null },
  });

  const node = await prisma.mBOMNode.create({
    data: {
      bomId: id,
      ...nodeData,
      level,
      nodeSequence: siblings.length,
    },
  });

  res.status(201).json({
    success: true,
    data: node,
  });
});

// Update node
bomRoutes.put('/nodes/:nodeId', async (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const updateData = req.body;

  const existing = await prisma.mBOMNode.findUnique({
    where: { id: nodeId },
  });

  if (!existing) {
    throw new NotFoundError('BOM Node');
  }

  const node = await prisma.mBOMNode.update({
    where: { id: nodeId },
    data: updateData,
  });

  res.json({
    success: true,
    data: node,
  });
});

// Delete node
bomRoutes.delete('/nodes/:nodeId', async (req: Request, res: Response) => {
  const { nodeId } = req.params;

  const existing = await prisma.mBOMNode.findUnique({
    where: { id: nodeId },
  });

  if (!existing) {
    throw new NotFoundError('BOM Node');
  }

  // Delete node and all its children recursively
  async function deleteNodeAndChildren(nodeId: string) {
    const children = await prisma.mBOMNode.findMany({
      where: { parentNodeId: nodeId },
    });

    for (const child of children) {
      await deleteNodeAndChildren(child.id);
    }

    await prisma.mBOMNode.delete({
      where: { id: nodeId },
    });
  }

  await deleteNodeAndChildren(nodeId);

  res.json({
    success: true,
    message: '节点删除成功',
  });
});

// Batch modify nodes
bomRoutes.post('/:id/batch-modify', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { filters, modifyType, modifyData, createSnapshot } = req.body;

  const bom = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  // Build where clause from filters
  const where: any = { bomId: id };
  if (filters) {
    if (filters.level) {
      where.level = Array.isArray(filters.level) ? { in: filters.level } : filters.level;
    }
    if (filters.materialType) {
      where.materialType = filters.materialType;
    }
    if (filters.isKeyPart !== undefined) {
      where.isKeyPart = filters.isKeyPart;
    }
    if (filters.materialCode) {
      where.materialCode = { contains: filters.materialCode };
    }
  }

  // Get matching nodes
  const nodes = await prisma.mBOMNode.findMany({
    where,
  });

  if (nodes.length === 0) {
    throw new BusinessError('没有匹配的节点');
  }

  // Create snapshot if requested
  let snapshotId = null;
  if (createSnapshot) {
    const snapshot = await prisma.bOMVersionLog.create({
      data: {
        bomId: id,
        changeType: 'Update',
        changeDesc: `批量修改: ${nodes.length} 个节点`,
        changeReason: '批量修改快照',
      },
    });
    snapshotId = snapshot.id;
  }

  // Apply modifications
  let modifiedCount = 0;
  const results: any[] = [];

  for (const node of nodes) {
    try {
      const updateData: any = {};
      
      switch (modifyType) {
        case 'replaceMaterial':
          if (modifyData.newMaterialId) updateData.materialId = modifyData.newMaterialId;
          if (modifyData.newMaterialCode) updateData.materialCode = modifyData.newMaterialCode;
          if (modifyData.newMaterialName) updateData.materialName = modifyData.newMaterialName;
          if (modifyData.newSpec) updateData.spec = modifyData.newSpec;
          break;
        case 'adjustQty':
          if (modifyData.adjustType === 'fixed') {
            updateData.qty = modifyData.newQty;
          } else if (modifyData.adjustType === 'scale') {
            updateData.qty = node.qty * modifyData.scaleFactor;
          } else if (modifyData.adjustType === 'increment') {
            updateData.qty = node.qty + modifyData.increment;
          }
          break;
        case 'updateProperty':
          if (modifyData.property && modifyData.value !== undefined) {
            updateData[modifyData.property] = modifyData.value;
          }
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.mBOMNode.update({
          where: { id: node.id },
          data: updateData,
        });
        modifiedCount++;
        results.push({ nodeId: node.id, status: 'success' });
      }
    } catch (error) {
      results.push({ nodeId: node.id, status: 'failed', error: String(error) });
    }
  }

  res.json({
    success: true,
    data: {
      modifiedCount,
      snapshotId,
      results: results.slice(0, 10), // Return first 10 results
      totalResults: results.length,
    },
  });
});

// Get version history
bomRoutes.get('/:id/versions', async (req: Request, res: Response) => {
  const { id } = req.params;

  const logs = await prisma.bOMVersionLog.findMany({
    where: { bomId: id },
    orderBy: { changedAt: 'desc' },
  });

  res.json({
    success: true,
    data: logs,
  });
});

// Release BOM
bomRoutes.post('/:id/release', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { releasedBy } = req.body;

  const bom = await prisma.bOMHeader.findUnique({
    where: { id },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  if (bom.status !== 'UnderReview') {
    throw new BusinessError('只有审核中的 BOM 才能发布');
  }

  const updated = await prisma.bOMHeader.update({
    where: { id },
    data: {
      status: 'Released',
      releasedBy,
      releasedAt: new Date(),
    },
  });

  await prisma.bOMVersionLog.create({
    data: {
      bomId: id,
      versionFrom: bom.version,
      versionTo: bom.version,
      changeType: 'Release',
      changeDesc: '发布 BOM',
      changedBy: releasedBy,
    },
  });

  res.json({
    success: true,
    data: updated,
  });
});

// Duplicate BOM
bomRoutes.post('/:id/duplicate', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newBomCode, newBomName, createdBy } = req.body;

  const original = await prisma.bOMHeader.findUnique({
    where: { id },
    include: { nodes: true },
  });

  if (!original) {
    throw new NotFoundError('BOM');
  }

  // Create new BOM
  const newBom = await prisma.bOMHeader.create({
    data: {
      bomCode: newBomCode || `${original.bomCode}-COPY`,
      bomName: newBomName || `${original.bomName} (副本)`,
      bomType: original.bomType,
      productModel: original.productModel,
      status: 'Draft',
      createdBy,
    },
  });

  // Copy nodes (without relationships)
  for (const node of original.nodes) {
    await prisma.mBOMNode.create({
      data: {
        bomId: newBom.id,
        materialId: node.materialId,
        materialCode: node.materialCode,
        materialName: node.materialName,
        spec: node.spec,
        materialType: node.materialType,
        qty: node.qty,
        unit: node.unit,
        isKeyPart: node.isKeyPart,
        level: node.level,
        nodeSequence: node.nodeSequence,
        status: node.status,
        creator: createdBy,
      },
    });
  }

  res.status(201).json({
    success: true,
    data: newBom,
  });
});
