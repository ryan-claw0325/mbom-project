import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { ValidationError, NotFoundError, BusinessError } from '../utils/errors.js';

export const processRoutes = Router();

// Get all process specs
processRoutes.get('/', async (req: Request, res: Response) => {
  const keyword = req.query.keyword as string;
  const specType = req.query.specType as string;
  const status = req.query.status as string;

  const where: any = {};
  
  if (keyword) {
    where.OR = [
      { specCode: { contains: keyword } },
      { specName: { contains: keyword } },
    ];
  }
  if (specType) {
    where.specType = specType;
  }
  if (status) {
    where.status = status;
  }

  const specs = await prisma.processSpec.findMany({
    where,
    orderBy: { specCode: 'asc' },
    include: {
      _count: { select: { operations: true, nodeRels: true } },
    },
  });

  res.json({
    success: true,
    data: specs.map(spec => ({
      ...spec,
      operationCount: (spec as any)._count?.operations || 0,
      nodeRelCount: (spec as any)._count?.nodeRels || 0,
    })),
  });
});

// Get single process spec with operations
processRoutes.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const spec = await prisma.processSpec.findUnique({
    where: { id },
    include: {
      operations: {
        orderBy: { operationNo: 'asc' },
      },
    },
  });

  if (!spec) {
    throw new NotFoundError('工艺规程');
  }

  res.json({
    success: true,
    data: spec,
  });
});

// Get operations for a spec
processRoutes.get('/:id/operations', async (req: Request, res: Response) => {
  const { id } = req.params;

  const spec = await prisma.processSpec.findUnique({
    where: { id },
  });

  if (!spec) {
    throw new NotFoundError('工艺规程');
  }

  const operations = await prisma.processOperation.findMany({
    where: { specId: id },
    orderBy: { operationNo: 'asc' },
  });

  res.json({
    success: true,
    data: operations,
  });
});

// Create process spec
processRoutes.post('/', async (req: Request, res: Response) => {
  const { specCode, specName, specType, materialCode, operations, createdBy } = req.body;

  if (!specCode || !specName || !specType) {
    throw new ValidationError('规程编码、名称和类型不能为空');
  }

  // Check if specCode already exists
  const existing = await prisma.processSpec.findUnique({
    where: { specCode },
  });

  if (existing) {
    throw new BusinessError(`规程编码 ${specCode} 已存在`);
  }

  const spec = await prisma.processSpec.create({
    data: {
      specCode,
      specName,
      specType,
      materialCode,
      status: 'Draft',
      createdBy,
    },
  });

  // Create operations if provided
  if (operations && Array.isArray(operations)) {
    for (const op of operations) {
      await prisma.processOperation.create({
        data: {
          specId: spec.id,
          operationNo: op.operationNo,
          operationName: op.operationName,
          workCenter: op.workCenter,
          standardHours: op.standardHours,
          setupHours: op.setupHours,
          equipment: op.equipment,
          operationDesc: op.operationDesc,
          qualityRequire: op.qualityRequire,
          isCritical: op.isCritical || false,
        },
      });
    }
  }

  const createdSpec = await prisma.processSpec.findUnique({
    where: { id: spec.id },
    include: { operations: { orderBy: { operationNo: 'asc' } } },
  });

  res.status(201).json({
    success: true,
    data: createdSpec,
  });
});

// Update process spec
processRoutes.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await prisma.processSpec.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('工艺规程');
  }

  const spec = await prisma.processSpec.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: spec,
  });
});

// Delete process spec
processRoutes.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.processSpec.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('工艺规程');
  }

  // Check if there are associated nodes
  const rels = await prisma.nodeSpecRel.findMany({
    where: { specId: id },
  });

  if (rels.length > 0) {
    throw new BusinessError(`该规程已关联 ${rels.length} 个 MBOM 节点，无法删除`);
  }

  await prisma.processSpec.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: '工艺规程删除成功',
  });
});

// Create node-spec relationship
processRoutes.post('/node-spec-rels', async (req: Request, res: Response) => {
  const { nodeId, specId, operationId, assocType, assocBy } = req.body;

  if (!nodeId || !specId) {
    throw new ValidationError('节点 ID 和规程 ID 不能为空');
  }

  // Verify node exists
  const node = await prisma.mBOMNode.findUnique({
    where: { id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('MBOM 节点');
  }

  // Verify spec exists
  const spec = await prisma.processSpec.findUnique({
    where: { id: specId },
  });

  if (!spec) {
    throw new NotFoundError('工艺规程');
  }

  // Check if relationship already exists
  const existing = await prisma.nodeSpecRel.findFirst({
    where: { nodeId, specId, operationId: operationId || null },
  });

  if (existing) {
    throw new BusinessError('该关联关系已存在');
  }

  const rel = await prisma.nodeSpecRel.create({
    data: {
      nodeId,
      specId,
      operationId,
      assocType: assocType || 'Primary',
      assocBy,
    },
    include: {
      spec: true,
      operation: true,
    },
  });

  // Update node's processSpecId if this is primary association
  if (assocType === 'Primary' || !assocType) {
    await prisma.mBOMNode.update({
      where: { id: nodeId },
      data: { processSpecId: specId },
    });
  }

  res.status(201).json({
    success: true,
    data: rel,
  });
});

// Delete node-spec relationship
processRoutes.delete('/node-spec-rels/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.nodeSpecRel.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('关联关系');
  }

  await prisma.nodeSpecRel.delete({
    where: { id },
  });

  // If node had this as primary spec, clear it
  const node = await prisma.mBOMNode.findUnique({
    where: { id: existing.nodeId },
  });

  if (node && node.processSpecId === existing.specId) {
    // Find another primary spec or set to null
    const anotherRel = await prisma.nodeSpecRel.findFirst({
      where: { nodeId: existing.nodeId, id: { not: id } },
    });
    
    await prisma.mBOMNode.update({
      where: { id: existing.nodeId },
      data: { processSpecId: anotherRel?.specId || null },
    });
  }

  res.json({
    success: true,
    message: '关联关系删除成功',
  });
});

// Get specs associated with a node
processRoutes.get('/nodes/:nodeId/specs', async (req: Request, res: Response) => {
  const { nodeId } = req.params;

  const rels = await prisma.nodeSpecRel.findMany({
    where: { nodeId },
    include: {
      spec: true,
      operation: true,
    },
    orderBy: { assocDate: 'desc' },
  });

  res.json({
    success: true,
    data: rels,
  });
});

// Get nodes associated with a spec
processRoutes.get('/specs/:specId/nodes', async (req: Request, res: Response) => {
  const { specId } = req.params;

  const rels = await prisma.nodeSpecRel.findMany({
    where: { specId },
    include: {
      node: {
        include: { bom: true },
      },
    },
    orderBy: { assocDate: 'desc' },
  });

  res.json({
    success: true,
    data: rels.map(rel => ({
      ...rel,
      node: rel.node,
    })),
  });
});

// Get change notifications
processRoutes.get('/notifications', async (req: Request, res: Response) => {
  const isRead = req.query.read as string;
  
  const where: any = {};
  if (isRead !== undefined) {
    where.isRead = isRead === 'true';
  }

  const notifications = await prisma.changeNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    success: true,
    data: notifications.map(n => ({
      ...n,
      affectedNodes: n.affectedNodes ? JSON.parse(n.affectedNodes) : [],
    })),
  });
});

// Mark notification as read
processRoutes.put('/notifications/:id/read', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.changeNotification.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('通知');
  }

  const notification = await prisma.changeNotification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json({
    success: true,
    data: notification,
  });
});
