import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Tag, Card, Modal, Form, Input, InputNumber, message, Breadcrumb, Popconfirm, Descriptions, Badge } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { api } from '../api/client';

interface MBOMNode {
  id: string;
  bomId: string;
  materialCode?: string;
  materialName?: string;
  materialType?: string;
  qty: number;
  unit: string;
  level: number;
  nodeSequence: number;
  parentNodeId?: string;
  isKeyPart: boolean;
  status: string;
  processSpecId?: string;
  spec?: string;
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
  errors: { ruleCode: string; message: string }[];
  warnings: { ruleCode: string; message: string }[];
}

const BOMTreePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bom, setBom] = useState<BOMHeader | null>(null);
  const [nodes, setNodes] = useState<MBOMNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<MBOMNode | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();

  const fetchBomTree = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res: any = await api.getBomTree(id);
      setBom(res.data.bom);
      setNodes(res.data.nodes);
      // Auto expand root
      const rootNodes = res.data.nodes.filter((n: MBOMNode) => n.level === 0);
      setExpandedKeys(new Set(rootNodes.map((n: MBOMNode) => n.id)));
    } catch (error) {
      message.error('获取 BOM 结构失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBomTree();
  }, [id]);

  // Build tree structure
  const treeData = useMemo(() => {
    const roots: MBOMNode[] = [];
    const childrenMap = new Map<string, MBOMNode[]>();

    nodes.forEach((node) => {
      if (node.level === 0) {
        roots.push(node);
      } else {
        const parentId = node.parentNodeId || '';
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId)!.push(node);
      }
    });

    return { roots, childrenMap };
  }, [nodes]);

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedKeys(newExpanded);
  };

  const renderNode = (node: MBOMNode, depth: number = 0) => {
    const hasChildren = treeData.childrenMap.has(node.id);
    const isExpanded = expandedKeys.has(node.id);
    const isSelected = selectedNode?.id === node.id;

    return (
      <div key={node.id}>
        <div
          className={`node-item ${isSelected ? 'selected' : ''} ${node.processSpecId ? 'has-spec' : ''}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => setSelectedNode(node)}
        >
          {hasChildren && (
            <span className="node-expand" onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span className="node-expand" style={{ visibility: 'hidden' }}>●</span>}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ marginRight: 8 }}>{node.materialName || '未命名'}</span>
            <Tag className="tag-gray">{node.materialCode || '无编码'}</Tag>
            {node.isKeyPart && <Tag className="tag-primary">关键件</Tag>}
          </span>
          <span style={{ color: '#999', fontSize: 12 }}>
            {node.qty} {node.unit}
          </span>
        </div>
        {hasChildren && isExpanded && treeData.childrenMap.get(node.id)!.map(child => renderNode(child, depth + 1))}
      </div>
    );
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

  return (
    <>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/boms')}>
            返回
          </Button>
          <div className="header-title">
            {bom?.bomName || '加载中...'}
            {bom?.version && <Tag color="green" style={{ marginLeft: 8 }}>{bom.version}</Tag>}
          </div>
        </div>
        <div className="header-actions">
          <Button icon={<CheckCircleOutlined />}>数据校验</Button>
          <Button icon={<LinkOutlined />}>工艺关联</Button>
        </div>
      </header>

      <div className="content">
        <div className="page-header">
          <h2 className="page-title">BOM 结构</h2>
          <p className="page-desc">查看和编辑 BOM 物料清单结构</p>
        </div>

        <div className="split-view">
          <div className="split-left">
            <div className="split-left-header">
              <span className="card-title">结构树</span>
              <span style={{ fontSize: 12, color: '#999' }}>{nodes.length} 个节点</span>
            </div>
            <div className="split-left-body">
              {treeData.roots.map(node => renderNode(node))}
            </div>
          </div>

          <div className="split-right">
            <div className="split-right-header">
              <span className="card-title">节点详情</span>
              {selectedNode && (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={handleEdit}>
                    编辑
                  </Button>
                  <Popconfirm title="确认删除此节点及其子节点？" onConfirm={handleDeleteNode}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              )}
            </div>
            <div className="split-right-body">
              {selectedNode ? (
                <div className="detail-grid">
                  <div className="detail-item">
                    <div className="detail-label">物料编码</div>
                    <div className="detail-value">
                      <Tag color="blue">{selectedNode.materialCode || '-'}</Tag>
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">物料名称</div>
                    <div className="detail-value">{selectedNode.materialName || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">规格</div>
                    <div className="detail-value">{selectedNode.spec || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">材质</div>
                    <div className="detail-value">{selectedNode.materialType || '-'}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">用量</div>
                    <div className="detail-value">{selectedNode.qty} {selectedNode.unit}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">层级</div>
                    <div className="detail-value">{selectedNode.level}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">关键件</div>
                    <div className="detail-value">
                      {selectedNode.isKeyPart ? <Badge status="processing" text="是" /> : '否'}
                    </div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">状态</div>
                    <div className="detail-value">
                      <Tag color={selectedNode.status === 'Active' ? 'success' : 'default'}>
                        {selectedNode.status}
                      </Tag>
                    </div>
                  </div>
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="detail-label">工艺关联</div>
                    <div className="detail-value">
                      {selectedNode.processSpecId ? (
                        <Tag color="green">已关联工艺规程</Tag>
                      ) : (
                        <span style={{ color: '#999' }}>未关联</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📋</div>
                  <h3>未选择节点</h3>
                  <p>点击左侧结构树中的节点查看详情</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
        </Form>
      </Modal>
    </>
  );
};

export default BOMTreePage;
