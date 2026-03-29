import { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, message, Badge } from 'antd';
import { PlusOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

interface CheckRule {
  id: string;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  targetField?: string;
  errorMsg: string;
  severity: string;
  isActive: boolean;
  priority: number;
}

interface ValidationResult {
  nodeId: string;
  materialCode?: string;
  materialName?: string;
  level: number;
  errors: { ruleCode: string; message: string }[];
  warnings: { ruleCode: string; message: string }[];
}

const ValidationPage = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<CheckRule[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [boms, setBoms] = useState<{ id: string; bomCode: string; bomName: string }[]>([]);
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('rules');

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res: any = await api.getRules();
      setRules(res.data);
    } catch (error) {
      message.error('获取规则失败');
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

  useEffect(() => {
    fetchRules();
    fetchBoms();
  }, []);

  const handleCreateRule = async (values: any) => {
    try {
      await api.createRule(values);
      message.success('创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchRules();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await api.deleteRule(id);
      message.success('删除成功');
      fetchRules();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleExecuteValidation = async () => {
    if (!selectedBomId) {
      message.error('请选择 BOM');
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.executeValidation({ bomId: selectedBomId });
      setResults(res.data.details || []);
      setValidationSummary({
        totalNodes: res.data.totalNodes,
        passedNodes: res.data.passedNodes,
        errorCount: res.data.errorCount,
        warningCount: res.data.warningCount,
        passRate: res.data.passRate,
      });
      setActiveTab('results');
      message.success('校验完成');
    } catch (error) {
      message.error('校验失败');
    } finally {
      setLoading(false);
    }
  };

  const ruleColumns: ColumnsType<CheckRule> = [
    {
      title: '规则编码',
      dataIndex: 'ruleCode',
      width: 100,
      render: (code) => <Tag>{code}</Tag>,
    },
    {
      title: '规则名称',
      dataIndex: 'ruleName',
    },
    {
      title: '类型',
      dataIndex: 'ruleType',
      width: 100,
    },
    {
      title: '目标字段',
      dataIndex: 'targetField',
      width: 120,
    },
    {
      title: '错误信息',
      dataIndex: 'errorMsg',
    },
    {
      title: '级别',
      dataIndex: 'severity',
      width: 80,
      render: (sev) => (
        <Tag color={sev === 'Error' ? 'red' : 'orange'}>{sev}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 80,
      render: (active) => (
        <Badge status={active ? 'success' : 'default'} text={active ? '启用' : '禁用'} />
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button type="link" danger size="small" onClick={() => handleDeleteRule(record.id)}>
          删除
        </Button>
      ),
    },
  ];

  const resultColumns: ColumnsType<ValidationResult> = [
    {
      title: '物料编码',
      dataIndex: 'materialCode',
      width: 150,
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
        ) : <CheckCircleOutlined style={{ color: 'green' }} />,
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
    <>
      <header className="header">
        <div className="header-title">数据校验</div>
        <div className="header-actions">
          <Select
            placeholder="选择 BOM"
            style={{ width: 300 }}
            value={selectedBomId || undefined}
            onChange={(value) => setSelectedBomId(value)}
          >
            {boms.map((b) => (
              <Select.Option key={b.id} value={b.id}>
                {b.bomCode} - {b.bomName}
              </Select.Option>
            ))}
          </Select>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecuteValidation}
            loading={loading}
          >
            执行校验
          </Button>
        </div>
      </header>
      <div className="content">
        <div className="page-header">
          <h2 className="page-title">数据校验</h2>
          <p className="page-desc">内置 BOM 数据校验规则，自动拦截不合格数据，确保数据质量</p>
        </div>

        <div className="card">
          <div className="card-body">
            {activeTab === 'rules' ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                    新建规则
                  </Button>
                </div>
                <Table
                  columns={ruleColumns}
                  dataSource={rules}
                  rowKey="id"
                  loading={loading}
                  pagination={false}
                />
              </>
            ) : (
              <>
                {validationSummary && (
                  <div className="status-items">
                    <div className="status-item">
                      <div className="status-icon">📦</div>
                      <div className="status-info">
                        <h4>{validationSummary.totalNodes}</h4>
                        <p>总节点</p>
                      </div>
                    </div>
                    <div className="status-item">
                      <div className="status-icon">✅</div>
                      <div className="status-info">
                        <h4>{validationSummary.passedNodes}</h4>
                        <p>校验通过</p>
                      </div>
                    </div>
                    <div className="status-item">
                      <div className="status-icon">❌</div>
                      <div className="status-info">
                        <h4>{validationSummary.errorCount}</h4>
                        <p>校验失败</p>
                      </div>
                    </div>
                    <div className="status-item">
                      <div className="status-icon">⚠️</div>
                      <div className="status-info">
                        <h4>{validationSummary.warningCount}</h4>
                        <p>警告</p>
                      </div>
                    </div>
                  </div>
                )}
                <Table
                  columns={resultColumns}
                  dataSource={results}
                  rowKey="nodeId"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </>
            )}
          </div>
        </div>

        <Modal
          title="新建校验规则"
          open={createModalOpen}
          onCancel={() => {
            setCreateModalOpen(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleCreateRule}>
            <Form.Item name="ruleCode" label="规则编码" rules={[{ required: true }]}>
              <Input placeholder="如 R007" />
            </Form.Item>
            <Form.Item name="ruleName" label="规则名称" rules={[{ required: true }]}>
              <Input placeholder="如 物料名称非空" />
            </Form.Item>
            <Form.Item name="ruleType" label="规则类型" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="Mandatory">必填校验</Select.Option>
                <Select.Option value="Range">范围校验</Select.Option>
                <Select.Option value="Format">格式校验</Select.Option>
                <Select.Option value="Relationship">关联校验</Select.Option>
                <Select.Option value="Custom">自定义</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="targetField" label="目标字段">
              <Input placeholder="如 materialCode" />
            </Form.Item>
            <Form.Item name="errorMsg" label="错误信息" rules={[{ required: true }]}>
              <Input.TextArea placeholder="校验失败时显示的错误信息" />
            </Form.Item>
            <Form.Item name="severity" label="严重级别" initialValue="Error">
              <Select>
                <Select.Option value="Error">错误</Select.Option>
                <Select.Option value="Warning">警告</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
};

export default ValidationPage;
