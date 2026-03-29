import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Space, Tag, Modal, Form, Select, message, Table, Card } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { api } from '../api/client';

interface BOM {
  id: string;
  bomCode: string;
  bomName: string;
  bomType: string;
  productModel?: string;
  version: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  nodeCount: number;
}

const statusColors: Record<string, string> = {
  Draft: 'default',
  UnderReview: 'processing',
  Released: 'success',
  Change: 'warning',
};

const BOMListPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [boms, setBoms] = useState<BOM[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchBoms = async () => {
    setLoading(true);
    try {
      const res: any = await api.getBoms({
        page: pagination.current,
        pageSize: pagination.pageSize,
        keyword: searchKeyword,
      });
      setBoms(res.data.list);
      setPagination((prev) => ({
        ...prev,
        total: res.data.pagination.total,
      }));
    } catch (error) {
      message.error('获取 BOM 列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoms();
  }, [pagination.current, pagination.pageSize, searchKeyword]);

  const handleCreate = async (values: any) => {
    try {
      await api.createBom(values);
      message.success('创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchBoms();
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除吗？',
      onOk: async () => {
        try {
          await api.deleteBom(id);
          message.success('删除成功');
          fetchBoms();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const columns: ColumnsType<BOM> = [
    {
      title: 'BOM 编码',
      dataIndex: 'bomCode',
      width: 180,
      render: (code) => <Tag color="blue">{code}</Tag>,
    },
    {
      title: 'BOM 名称',
      dataIndex: 'bomName',
    },
    {
      title: '产品型号',
      dataIndex: 'productModel',
      width: 120,
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
        <Tag color={statusColors[status] || 'default'}>{status}</Tag>
      ),
    },
    {
      title: '节点数',
      dataIndex: 'nodeCount',
      width: 80,
      align: 'center',
    },
    {
      title: '创建人',
      dataIndex: 'createdBy',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/boms/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => {
              api.duplicateBom(record.id, {
                newBomCode: `${record.bomCode}-COPY`,
                newBomName: `${record.bomName} (副本)`,
              }).then(() => {
                message.success('复制成功');
                fetchBoms();
              });
            }}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <header className="header">
        <div className="header-title">BOM 管理</div>
        <div className="header-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建 BOM
          </Button>
        </div>
      </header>
      <div className="content">
        <div className="page-header">
          <h2 className="page-title">BOM 列表</h2>
          <p className="page-desc">管理所有制造BOM，支持创建、编辑、复制和删除操作</p>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="filter-bar">
              <div className="filter-item">
                <Input.Search
                  placeholder="搜索 BOM 编码或名称"
                  allowClear
                  enterButton={<SearchOutlined />}
                  style={{ width: 300 }}
                  onSearch={(value) => {
                    setSearchKeyword(value);
                    setPagination((prev) => ({ ...prev, current: 1 }));
                  }}
                />
              </div>
            </div>

            <Table
              columns={columns}
              dataSource={boms}
              rowKey="id"
              loading={loading}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total }),
              }}
            />
          </div>
        </div>

        <Modal
          title="新建 BOM"
          open={createModalOpen}
          onCancel={() => {
            setCreateModalOpen(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
        >
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item name="bomCode" label="BOM 编码" rules={[{ required: true }]}>
              <Input placeholder="如 MBOM-2026-0001" />
            </Form.Item>
            <Form.Item name="bomName" label="BOM 名称" rules={[{ required: true }]}>
              <Input placeholder="如 发动机总成 MBOM" />
            </Form.Item>
            <Form.Item name="bomType" label="BOM 类型" initialValue="MBOM">
              <Select>
                <Select.Option value="MBOM">MBOM</Select.Option>
                <Select.Option value="EBOM">EBOM</Select.Option>
                <Select.Option value="PBOM">PBOM</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="productModel" label="产品型号">
              <Input placeholder="如 型号A" />
            </Form.Item>
            <Form.Item name="createdBy" label="创建人">
              <Input placeholder="创建人姓名" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
};

export default BOMListPage;
