import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default validation rules
  const rules = [
    {
      ruleCode: 'R001',
      ruleName: '物料编码非空',
      ruleType: 'Mandatory',
      targetField: 'materialCode',
      conditionExpr: JSON.stringify({ operator: 'isNotNull' }),
      errorMsg: '物料编码不能为空',
      severity: 'Error',
      priority: 1,
      isActive: true,
    },
    {
      ruleCode: 'R002',
      ruleName: '数量必须为正',
      ruleType: 'Range',
      targetField: 'qty',
      conditionExpr: JSON.stringify({ operator: 'greaterThan', value: 0 }),
      errorMsg: '用量必须大于 0',
      severity: 'Error',
      priority: 2,
      isActive: true,
    },
    {
      ruleCode: 'R003',
      ruleName: '物料编码格式校验',
      ruleType: 'Format',
      targetField: 'materialCode',
      conditionExpr: JSON.stringify({ operator: 'regex', pattern: '^[A-Z]{2}-\\d{4}-\\d{6}$' }),
      errorMsg: '物料编码格式不正确，应为 XX-XXXX-XXXXXX',
      severity: 'Warning',
      priority: 3,
      isActive: true,
    },
    {
      ruleCode: 'R004',
      ruleName: '层级深度不超过10层',
      ruleType: 'Range',
      targetField: 'level',
      conditionExpr: JSON.stringify({ operator: 'lessThanOrEqual', value: 10 }),
      errorMsg: '层级深度不能超过 10 层',
      severity: 'Warning',
      priority: 4,
      isActive: true,
    },
    {
      ruleCode: 'R005',
      ruleName: '父件必须存在',
      ruleType: 'Relationship',
      targetField: 'parentNodeId',
      conditionExpr: JSON.stringify({ operator: 'parentExists' }),
      errorMsg: '父件节点不存在',
      severity: 'Error',
      priority: 5,
      isActive: true,
    },
    {
      ruleCode: 'R006',
      ruleName: '关键件必须关联工艺',
      ruleType: 'Relationship',
      targetField: 'isKeyPart',
      conditionExpr: JSON.stringify({ operator: 'keyPartRequiresSpec' }),
      errorMsg: '关键件必须关联工艺规程',
      severity: 'Error',
      priority: 6,
      isActive: true,
    },
  ];

  for (const rule of rules) {
    await prisma.checkRule.upsert({
      where: { ruleCode: rule.ruleCode },
      update: rule,
      create: rule,
    });
  }
  console.log(`Created ${rules.length} validation rules`);

  // Create default import template
  const template = {
    templateName: 'Excel-标准EBOM',
    sourceType: 'excel',
    fieldMappings: JSON.stringify({
      mappings: [
        { sourceField: '零件名称', targetField: 'materialName', transform: 'direct' },
        { sourceField: '物料编码', targetField: 'materialCode', transform: 'direct' },
        { sourceField: '图号', targetField: 'drawingNo', transform: 'direct' },
        { sourceField: '数量', targetField: 'qty', transform: 'toNumber' },
        { sourceField: '上级物料编码', targetField: 'parentMaterialCode', transform: 'direct' },
        { sourceField: '层级', targetField: 'level', transform: 'toNumber' },
      ],
    }),
    isDefault: true,
  };

  await prisma.importTemplate.upsert({
    where: { id: 'default-excel-template' },
    update: template,
    create: { id: 'default-excel-template', ...template },
  });
  console.log('Created default import template');

  // Create sample BOM for testing
  const sampleBom = await prisma.bOMHeader.upsert({
    where: { bomCode: 'MBOM-2026-SAMPLE' },
    update: {},
    create: {
      bomCode: 'MBOM-2026-SAMPLE',
      bomName: '发动机总成 MBOM（示例）',
      bomType: 'MBOM',
      productModel: '型号A',
      version: 'A/1',
      status: 'Released',
      createdBy: 'System',
    },
  });

  // Create sample nodes
  const nodes = [
    { materialCode: 'EG-2026-001', materialName: '发动机总成', level: 0, qty: 1, isKeyPart: true },
    { materialCode: 'EG-2026-001-01', materialName: '气缸体组件', level: 1, qty: 1, isKeyPart: true },
    { materialCode: 'EG-2026-001-01-01', materialName: '气缸体', level: 2, qty: 1, materialType: '零件' },
    { materialCode: 'EG-2026-001-01-02', materialName: '活塞组件', level: 2, qty: 4, materialType: '零件' },
    { materialCode: 'EG-2026-001-01-03', materialName: '连杆组件', level: 2, qty: 4, materialType: '零件' },
    { materialCode: 'EG-2026-001-02', materialName: '曲柄连杆机构', level: 1, qty: 1, isKeyPart: true },
    { materialCode: 'EG-2026-001-02-01', materialName: '曲轴', level: 2, qty: 1, materialType: '零件' },
    { materialCode: 'EG-2026-001-02-02', materialName: '飞轮', level: 2, qty: 1, materialType: '零件' },
    { materialCode: 'EG-2026-001-03', materialName: '配气机构', level: 1, qty: 1 },
    { materialCode: 'EG-2026-001-04', materialName: '进排气系统', level: 1, qty: 1 },
  ];

  for (let i = 0; i < nodes.length; i++) {
    const nodeData = nodes[i];
    const parentNode = i > 0 ? nodes.slice(0, i).find(n => n.level === nodeData.level - 1) : null;
    
    await prisma.mBOMNode.upsert({
      where: { 
        id: `sample-node-${i}`
      },
      update: {
        bomId: sampleBom.id,
        level: nodeData.level,
        nodeSequence: i,
      },
      create: {
        id: `sample-node-${i}`,
        bomId: sampleBom.id,
        materialCode: nodeData.materialCode,
        materialName: nodeData.materialName,
        materialType: nodeData.materialType,
        qty: nodeData.qty,
        unit: 'EA',
        level: nodeData.level,
        nodeSequence: i,
        isKeyPart: nodeData.isKeyPart || false,
        status: 'Active',
        creator: 'System',
      },
    });
  }
  console.log(`Created ${nodes.length} sample BOM nodes`);

  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
