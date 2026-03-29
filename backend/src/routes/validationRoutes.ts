import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export const validationRoutes = Router();

// Get all validation rules
validationRoutes.get('/rules', async (req: Request, res: Response) => {
  const isActive = req.query.isActive;
  
  const where: any = {};
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const rules = await prisma.checkRule.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { ruleCode: 'asc' }],
  });

  res.json({
    success: true,
    data: rules,
  });
});

// Create validation rule
validationRoutes.post('/rules', async (req: Request, res: Response) => {
  const { ruleCode, ruleName, ruleType, targetField, conditionExpr, errorMsg, severity, priority } = req.body;

  if (!ruleCode || !ruleName || !ruleType || !errorMsg) {
    throw new ValidationError('规则编码、名称、类型和错误信息不能为空');
  }

  // Check if rule code already exists
  const existing = await prisma.checkRule.findUnique({
    where: { ruleCode },
  });

  if (existing) {
    throw new ValidationError(`规则编码 ${ruleCode} 已存在`);
  }

  const rule = await prisma.checkRule.create({
    data: {
      ruleCode,
      ruleName,
      ruleType,
      targetField,
      conditionExpr: conditionExpr ? JSON.stringify(conditionExpr) : null,
      errorMsg,
      severity: severity || 'Error',
      priority: priority || 0,
      isActive: true,
    },
  });

  res.status(201).json({
    success: true,
    data: rule,
  });
});

// Update validation rule
validationRoutes.put('/rules/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  const existing = await prisma.checkRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('校验规则');
  }

  if (updateData.conditionExpr && typeof updateData.conditionExpr === 'object') {
    updateData.conditionExpr = JSON.stringify(updateData.conditionExpr);
  }

  const rule = await prisma.checkRule.update({
    where: { id },
    data: updateData,
  });

  res.json({
    success: true,
    data: rule,
  });
});

// Delete validation rule
validationRoutes.delete('/rules/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.checkRule.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('校验规则');
  }

  await prisma.checkRule.delete({
    where: { id },
  });

  res.json({
    success: true,
    message: '规则删除成功',
  });
});

// Execute validation on a BOM
validationRoutes.post('/execute', async (req: Request, res: Response) => {
  const { bomId, ruleIds, stopOnError } = req.body;

  if (!bomId) {
    throw new ValidationError('BOM ID 不能为空');
  }

  const bom = await prisma.bOMHeader.findUnique({
    where: { id: bomId },
    include: { nodes: true },
  });

  if (!bom) {
    throw new NotFoundError('BOM');
  }

  // Get rules to apply
  const where: any = { isActive: true };
  if (ruleIds && ruleIds.length > 0) {
    where.id = { in: ruleIds };
  }

  const rules = await prisma.checkRule.findMany({
    where,
    orderBy: [{ priority: 'asc' }],
  });

  const details: any[] = [];
  let errorCount = 0;
  let warningCount = 0;

  for (const node of bom.nodes) {
    const nodeErrors: any[] = [];
    const nodeWarnings: any[] = [];

    for (const rule of rules) {
      const result = validateNode(node, rule);
      
      if (!result.passed) {
        if (rule.severity === 'Error') {
          nodeErrors.push({ ruleCode: rule.ruleCode, message: result.message });
          errorCount++;
        } else {
          nodeWarnings.push({ ruleCode: rule.ruleCode, message: result.message });
          warningCount++;
        }
      }

      // Stop on first error if requested
      if (stopOnError && nodeErrors.length > 0) {
        break;
      }
    }

    if (nodeErrors.length > 0 || nodeWarnings.length > 0) {
      details.push({
        nodeId: node.id,
        materialCode: node.materialCode,
        materialName: node.materialName,
        level: node.level,
        errors: nodeErrors,
        warnings: nodeWarnings,
      });
    }
  }

  const totalNodes = bom.nodes.length;
  const passedNodes = totalNodes - new Set(details.map(d => d.nodeId)).size;
  const passRate = totalNodes > 0 ? ((passedNodes / totalNodes) * 100).toFixed(1) : '100.0';

  res.json({
    success: true,
    data: {
      bomId,
      totalNodes,
      passedNodes,
      errorCount,
      warningCount,
      passRate: `${passRate}%`,
      details: details.slice(0, 100), // Return first 100 issues
      totalIssues: details.length,
    },
  });
});

// Validate a single node against a rule
function validateNode(node: any, rule: any): { passed: boolean; message?: string } {
  const value = node[rule.targetField];
  const condition = rule.conditionExpr ? JSON.parse(rule.conditionExpr) : null;

  switch (rule.ruleType) {
    case 'Mandatory':
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { passed: false, message: rule.errorMsg };
      }
      break;

    case 'Range':
      if (condition) {
        if (condition.operator === 'greaterThan' && !(value > condition.value)) {
          return { passed: false, message: rule.errorMsg };
        }
        if (condition.operator === 'lessThanOrEqual' && !(value <= condition.value)) {
          return { passed: false, message: rule.errorMsg };
        }
      }
      break;

    case 'Format':
      if (condition && condition.operator === 'regex') {
        const regex = new RegExp(condition.pattern);
        if (!regex.test(value)) {
          return { passed: false, message: rule.errorMsg };
        }
      }
      break;

    case 'Relationship':
      if (rule.ruleCode === 'R005' && !node.parentNodeId && node.level > 0) {
        // Parent must exist for non-root nodes
        return { passed: false, message: rule.errorMsg };
      }
      if (rule.ruleCode === 'R006' && node.isKeyPart && !node.processSpecId) {
        // Key parts must have process spec
        return { passed: false, message: rule.errorMsg };
      }
      break;

    case 'Custom':
      if (condition) {
        // Custom validation logic can be extended here
      }
      break;
  }

  return { passed: true };
}

// Get validation reports
validationRoutes.get('/reports', async (req: Request, res: Response) => {
  // This would typically store validation results in a separate table
  // For now, return an empty list as results are computed on-demand
  res.json({
    success: true,
    data: [],
  });
});
