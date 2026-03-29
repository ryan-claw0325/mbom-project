import { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Badge, Drawer, List } from 'antd';
import { PlusOutlined, LinkOutlined, BellOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

interface ProcessSpec {
  id: string;
  specCode: string;
  specName: string;
  specType: string;
  materialCode?: string;
  version: string;
  status: string;
  operationCount: number;
  nodeRelCount: number;
}

interface NodeSpecRel {
  id: string;
  nodeId: string;
  specId: string;
  operationId?: string;
  assocType: string;
  assocDate: string;
  spec?: ProcessSpec;
  operation?: any;
  node?: any;
}

const ProcessAssocPage = () => {
  const [loading, setLoading] = useState(false);
  const [specs, setSpecs] = useState<ProcessSpec[]>([]);
  const [nodeSpecs, setNodeSpecs] = useState<NodeSpecRel[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [boms, setBoms] = useState<{ id: string; bomCode: string; bomName: string }[]>([]);
  const [nodes, setNodes] = useState<{ id: string; materialCode?: string; materialName?: string; bomId: string }[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [relModalOpen, setRelModalOpen] = useState(false);
  const [selectedSpec, setSelectedSpec] = useState<ProcessSpec | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [form] = Form.useForm();
  const [relForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('specs');

  const fetchSpecs = async () => {
    setLoading(true);
    try {
      const res: any = await api.getProcessSpecs();
      setSpecs(res.data);
    } catch (error) {
      message.error('获取工艺规程失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBoms = async () => {
    try {
      const res: any = await api.getBoms({ pageSize: 100 });
      setBoms(res.data.list);
    } catch (error) {
      message.error('获取 BOM 列表失败');
    }
  };

  const fetchNotifications = async () => {
    try {
      const res: any = await api.getNotifications(false);
      setNotifications(res.data);
    } catch (error) {
      message.error('获取通知失败');
    }
  };

  useEffect(() => {
    fetchSpecs();
    fetchBoms();
    fetchNotifications();
  }, []);

  const handleCreateSpec = async (values: any) => {
    try {
      await api.createProcessSpec(values);
      message.success('创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchSpecs();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteSpec = async (id: string) => {
    try {
      await api.deleteProcessSpec(id);
      message.success('删除成功');
      fetchSpecs();
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleCreateRel = async (values: any) => {
    if (!selectedSpec) return;
    try {
      await api.createNodeSpecRel({
        nodeId: values.nodeId,
        specId: selectedSpec.id,
        operationId: values.operationId,
        assocType: values.assocType || 'Primary',
      });
      message.success('关联成功');
      setRelModalOpen(false);
      relForm.resetFields();
      if (selectedSpec) {
        fetchNodeSpecs(selectedSpec.id);
      }
    } catch (error) {
      message.error('关联失败');
    }
  };

  const handleDeleteRel = async (id: string) => {
    try {
      await api.deleteNodeSpecRel(id);
      message.success('解除关联成功');
      if (selectedSpec) {
        fetchNodeSpecs(selectedSpec.id);
      }
    } catch (error) {
      message.error('解除关联失败');
    }
  };

  const fetchNodeSpecs = async (specId: string) => {
    try {
      const res: any = await api.getSpecNodes(specId);
      setNodeSpecs(res.data);
    } catch (error) {
      message.error('获取关联节点失败');
    }
  };

  const handleViewSpecRels = (spec: ProcessSpec) => {
    setSelectedSpec(spec);
    fetchNodeSpecs(spec.id);
    setActiveTab('rels');
  };

  const specColumns: ColumnsType<ProcessSpec> = [
    {
      title: '规程编码',
      dataIndex: 'specCode',
      width: 150,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: '规程名称',
      dataIndex: 'specName',
    },
    {
      title: '类型',
      dataIndex: 'specType',
      width: 100,
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'Effective' ? 'success' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: '工序数',
      dataIndex: 'operationCount',
      width: 80,
      align: 'center',
    },
    {
      title: '关联节点',
      dataIndex: 'nodeRelCount',
      width: 80,
      align: 'center',
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => handleViewSpecRels(record)}>
            关联节点
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteSpec(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const relColumns: ColumnsType<NodeSpecRel> = [
    {
      title: '节点物料编码',
      dataIndex: ['node', 'materialCode'],
      width: 150,
      render: (_, record) => record.node?.materialCode || '-',
    },
    {
      title: '节点物料名称',
      dataIndex: ['node', 'materialName'],
      render: (_, record) => record.node?.materialName || '-',
    },
    {
      title: '关联类型',
      dataIndex: 'assocType',
      width: 100,
      render: (type) => <Tag>{type}</Tag>,
    },
    {
      title: '关联时间',
      dataIndex: 'assocDate',
      width: 160,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button type="link" size="small" danger onClick={() => handleDeleteRel(record.id)}>
          解除
        </Button>
      ),
    },
  ];

  return (
    <>
      <header className="header">
        <div className="header-title">工艺关联</div>
        <div className="header-actions">
          <Badge count={notifications.filter((n) => !n.isRead).length}>
            <Button icon={<BellOutlined />} onClick={() => setNotificationsOpen(true)}>
              通知
            </Button>
          </Badge>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建规程
          </Button>
        </div>
      </header>
      <div className="content">
        <div className="page-header">
          <h2 className="page-title">工艺关联</h2>
          <p className="page-desc">管理工艺规程与 BOM 节点的关联关系</p>
        </div>

        <div className="card">
          <div className="card-body">
            {activeTab === 'specs' ? (
              <Table
                columns={specColumns}
                dataSource={specs}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<LinkOutlined />} onClick={() => setRelModalOpen(true)}>
                    添加关联
                  </Button>
                  <Button style={{ marginLeft: 8 }} onClick={() => setActiveTab('specs')}>
                    返回规程列表
                  </Button>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Tag color="blue">{selectedSpec?.specCode}</Tag>
                  <span>{selectedSpec?.specName}</span>
                </div>
                <Table
                  columns={relColumns}
                  dataSource={nodeSpecs}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </>
            )}
          </div>
        </div>

        <Modal
          title="新建工艺规程"
          open={createModalOpen}
          onCancel={() => {
            setCreateModalOpen(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleCreateSpec}>
            <Form.Item name="specCode" label="规程编码" rules={[{ required: true }]}>
              <Input placeholder="如 SPEC-MC-001" />
            </Form.Item>
            <Form.Item name="specName" label="规程名称" rules={[{ required: true }]}>
              <Input placeholder="如 机加工艺规程" />
            </Form.Item>
            <Form.Item name="specType" label="规程类型" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="Machining">机械加工</Select.Option>
                <Select.Option value="Assembly">装配</Select.Option>
                <Select.Option value="HeatTreat">热处理</Select.Option>
                <Select.Option value="Surface">表面处理</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="materialCode" label="适用物料编码">
              <Input placeholder="留空表示通用" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="关联节点"
          open={relModalOpen}
          onCancel={() => {
            setRelModalOpen(false);
            relForm.resetFields();
          }}
          onOk={() => relForm.submit()}
        >
          <Form form={relForm} layout="vertical" onFinish={handleCreateRel}>
            <Form.Item name="bomId" label="选择 BOM" rules={[{ required: true }]}>
              <Select placeholder="选择 BOM" onChange={async (bomId) => {
                const res: any = await api.getBomTree(bomId);
                setNodes(res.data.nodes);
              }}>
                {boms.map((b) => (
                  <Select.Option key={b.id} value={b.id}>{b.bomCode} - {b.bomName}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="nodeId" label="选择节点" rules={[{ required: true }]}>
              <Select placeholder="选择 BOM 节点">
                {nodes.map((n) => (
                  <Select.Option key={n.id} value={n.id}>
                    {n.materialCode || '无编码'} - {n.materialName || '未命名'}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="assocType" label="关联类型" initialValue="Primary">
              <Select>
                <Select.Option value="Primary">主要</Select.Option>
                <Select.Option value="Alternative">替代</Select.Option>
                <Select.Option value="Reference">参考</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        <Drawer
          title="变更通知"
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          width={400}
        >
          <List
            dataSource={notifications}
            renderItem={(item: any) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag color="orange">{item.changeType}</Tag>
                      <span>{item.specCode}</span>
                    </Space>
                  }
                  description={item.changeDesc || '工艺规程已更新'}
                />
              </List.Item>
            )}
            locale={{ emptyText: '暂无通知' }}
          />
        </Drawer>
      </div>
    </>
  );
};

export default ProcessAssocPage;
