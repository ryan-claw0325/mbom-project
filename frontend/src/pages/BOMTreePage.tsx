import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tree, Button, Space, Tag, Table, Modal, Form, Input, InputNumber, message, Breadcrumb, Popconfirm, Tabs, Descriptions, Badge } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

interface MBOMNode {
  id: string;
  materialCode?: string;
  materialName?: string;
  materialType?: string;
  qty: number;
  unit: string;
  level: number;
  nodeSequence: number;
  isKeyPart: boolean;
  status: string;
  processSpecId?: string;
  specRels?: any[];
}

interface BOMHeader {
  id: string;
  bomCode: string;
  bomName: string;
  version: string;
  status: string;
}

interface ValidationResult {
  nodeId: string;
  materialCode?: string;
  materialName?: string;
  level: number;
  errors: { ruleCode: string; message: string }[];
  warnings: { ruleCode: string; message: string }[];
}

const BOMTreePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bom, setBom] = useState<BOMHeader | null>(null);
  const [nodes, setNodes] = useState<MBOMNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedNode, setSelectedNode] = useState<MBOMNode | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [validationLoading, setValidationLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('structure');

  const fetchBomTree = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await api.getBomTree(id);
      setBom(res.data.bom);
      setNodes(res.data.nodes);
    } catch (error) {
      message.error('获取 BOM 结构失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBomTree();
  }, [id]);

  // Build tree data
  const treeData = useMemo(() => {
    const map = new Map<string, DataNode>();
    nodes.forEach((node) => {
      map.set(node.id, {
        key: node.id,
        title: (
          <Space>
            <span>{node.materialName || '未命名'}</span>
            <Tag>{node.materialCode || '无编码'}</Tag>
            {node.isKeyPart && <Tag color="blue">关键件</Tag>}
            {node.processSpecId && <Tag color="green">已关联工艺</Tag>}
          </Space>
        ),
        children: [],
      });
    });

    const roots: DataNode[] = [];
    nodes.forEach((node) => {
      const treeNode = map.get(node.id)!;
      if (node.level === 0) {
        roots.push(treeNode);
      } else {
        const parent = map.get(node.parentNodeId || '');
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(treeNode);
        }
      }
    });

    return roots;
  }, [nodes]);

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (selectedKeys.length > 0) {
      const node = nodes.find((n) => n.id === selectedKeys[0]);
      setSelectedNode(node || null);
    } else {
      setSelectedNode(null);
    }
  };

  const handleEdit = () => {
    if (!selectedNode) return;
    editForm.setFieldsValue(selectedNode);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!selectedNode) return;
    try {
      await api.updateNode(selectedNode.id, values);
      message.success('保存成功');
      setEditModalOpen(false);
      fetchBomTree();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    try {
      await api.deleteNode(selectedNode.id);
      message.success('删除成功');
      setSelectedNode(null);
      fetchBomTree();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleValidate = async () => {
    if (!id) return;
    setValidationLoading(true);
    try {
      const res: any = await api.executeValidation({ bomId: id });
      setValidationResults(res.data.details || []);
      setActiveTab('validation');
      message.success(`校验完成: ${res.data.errorCount} 个错误, ${res.data.warningCount} 个警告`);
    } catch (error) {
      message.error('校验失败');
    } finally {
      setValidationLoading(false);
    }
  };

  const validationColumns: ColumnsType<ValidationResult> = [
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 150,
      render: (code) => code || '-',
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
    },
    {
      title: '层级',
      dataIndex: 'level',
      width: 60,
    },
    {
      title: '错误',
      dataIndex: 'errors',
      width: 200,
      render: (errors) =>
        errors.length > 0 ? (
          <Space direction="vertical" size={0}>
            {errors.map((e: any, i: number) => (
              <Tag key={i} color="red">{e.message}</Tag>
            ))}
          </Space>
        ) : '-',
    },
    {
      title: '警告',
      dataIndex: 'warnings',
      width: 200,
      render: (warnings) =>
        warnings.length > 0 ? (
          <Space direction="vertical" size={0}>
            {warnings.map((w: any, i: number) => (
              <Tag key={i} color="orange">{w.message}</Tag>
            ))}
          </Space>
        ) : '-',
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { title: <a onClick={() => navigate('/boms')}>BOM 列表</a> },
          { title: bom?.bomCode || '加载中...' },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Card
        title={
          <Space>
            <span>{bom?.bomName}</span>
            <Tag color={bom?.status === 'Released' ? 'success' : 'default'}>{bom?.version}</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/boms')}>
              返回
            </Button>
            <Button icon={<CheckCircleOutlined />} onClick={handleValidate} loading={validationLoading}>
              数据校验
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'structure',
              label: 'BOM 结构',
              children: (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, maxWidth: 500 }}>
                    <Tree
                      showLine
                      expandedKeys={expandedKeys}
                      onExpand={(keys) => setExpandedKeys(keys)}
                      onSelect={handleSelect}
                      treeData={treeData}
                      height={600}
                      selectedKeys={selectedNode ? [selectedNode.id] : []}
                    />
                  </div>
                  <div style={{ flex: 2 }}>
                    {selectedNode ? (
                      <Card
                        title="节点详情"
                        size="small"
                        extra={
                          <Space>
                            <Button type="link" icon={<EditOutlined />} onClick={handleEdit}>
                              编辑
                            </Button>
                            <Popconfirm
                              title="确认删除此节点及其子节点？"
                              onConfirm={handleDeleteNode}
                            >
                              <Button type="link" danger icon={<DeleteOutlined />}>
                                删除
                              </Button>
                            </Popconfirm>
                          </Space>
                        }
                      >
                        <Descriptions column={2} size="small">
                          <Descriptions.Item label="物料编码">{selectedNode.materialCode || '-'}</Descriptions.Item>
                          <Descriptions.Item label="物料名称">{selectedNode.materialName || '-'}</Descriptions.Item>
                          <Descriptions.Item label="规格">{selectedNode.spec || '-'}</Descriptions.Item>
                          <Descriptions.Item label="材质">{selectedNode.materialType || '-'}</Descriptions.Item>
                          <Descriptions.Item label="用量">{selectedNode.qty} {selectedNode.unit}</Descriptions.Item>
                          <Descriptions.Item label="层级">{selectedNode.level}</Descriptions.Item>
                          <Descriptions.Item label="关键件">
                            {selectedNode.isKeyPart ? <Badge status="processing" text="是" /> : '否'}
                          </Descriptions.Item>
                          <Descriptions.Item label="状态">{selectedNode.status}</Descriptions.Item>
                        </Descriptions>
                      </Card>
                    ) : (
                      <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                        点击左侧节点查看详情
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'validation',
              label: '校验结果',
              children: (
                <Table
                  columns={validationColumns}
                  dataSource={validationResults}
                  rowKey="nodeId"
                  size="small"
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="编辑节点"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit}>
          <Form.Item name="materialCode" label="物料编码">
            <Input />
          </Form.Item>
          <Form.Item name="materialName" label="物料名称">
            <Input />
          </Form.Item>
          <Form.Item name="spec" label="规格">
            <Input />
          </Form.Item>
          <Form.Item name="materialType" label="材质">
            <Input />
          </Form.Item>
          <Form.Item name="qty" label="用量">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unit" label="单位">
            <Input />
          </Form.Item>
          <Form.Item name="isKeyPart" label="关键件" valuePropName="checked">
            <Input type="checkbox" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BOMTreePage;
