import { useState } from 'react';
import { Card, Upload, Button, Steps, Table, Select, Space, Input, message, Alert, Tag } from 'antd';
import { UploadOutlined, FileExcelOutlined, CheckCircleOutlined, ArrowRightOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { api } from '../api/client';

const { Option } = Select;

interface ParsedData {
  headers: string[];
  rows: any[];
  totalRows: number;
  unmappedFields: string[];
}

const EBOMImportPage = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [sourceType, setSourceType] = useState<string>('excel');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [bomName, setBomName] = useState('');
  const [fieldMappings, setFieldMappings] = useState<{ sourceField: string; targetField: string; transform: string }[]>([]);
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<any>(null);

  const standardFields = [
    { value: 'materialName', label: '物料名称' },
    { value: 'materialCode', label: '物料编码' },
    { value: 'qty', label: '用量' },
    { value: 'unit', label: '单位' },
    { value: 'level', label: '层级' },
    { value: 'materialType', label: '材质' },
    { value: 'spec', label: '规格' },
  ];

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);

    try {
      const res: any = await api.uploadFile(formData);
      setFileId(res.data.fileId);
      message.success('文件上传成功');

      const parseRes: any = await api.parseFile({ fileId: res.data.fileId, sourceType });
      setParsedData(parseRes.data);
      setCurrentStep(1);

      const autoMappings: typeof fieldMappings = [];
      parseRes.data.headers.forEach((header: string) => {
        const matched = standardFields.find((sf) =>
          header.includes(sf.label) || header.toLowerCase().includes(sf.value.toLowerCase())
        );
        if (matched) {
          autoMappings.push({
            sourceField: header,
            targetField: matched.value,
            transform: matched.value === 'qty' || matched.value === 'level' ? 'toNumber' : 'direct',
          });
        }
      });
      setFieldMappings(autoMappings);
    } catch (error) {
      message.error('上传失败');
    }
    return false;
  };

  const handleConvert = async () => {
    if (!fileId || !bomName) {
      message.error('请填写 BOM 名称');
      return;
    }

    setConverting(true);
    try {
      const res: any = await api.convertEBOM({
        fileId,
        sourceType,
        bomName,
        fieldMappings,
        createBom: true,
      });
      setConversionResult(res.data);
      setCurrentStep(2);
      message.success('转换成功');
    } catch (error) {
      message.error('转换失败');
    } finally {
      setConverting(false);
    }
  };

  const previewColumns = parsedData
    ? parsedData.headers.slice(0, 6).map((h) => ({
        title: h,
        dataIndex: h,
        key: h,
        ellipsis: true,
      }))
    : [];

  return (
    <>
      <header className="header">
        <div className="header-title">EBOM 导入</div>
      </header>
      <div className="content">
        <div className="page-header">
          <h2 className="page-title">EBOM 多格式导入</h2>
          <p className="page-desc">支持 Excel、Word、Teamcenter XML 格式，自动解析并转换为 MBOM</p>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="steps-container">
              <Steps
                current={currentStep}
                size="small"
                items={[
                  { title: '上传文件', icon: <UploadOutlined /> },
                  { title: '字段映射', icon: <FileExcelOutlined /> },
                  { title: '完成', icon: <CheckCircleOutlined /> },
                ]}
              />
            </div>

            {currentStep === 0 && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div className="filter-item">
                  <label>文件类型:</label>
                  <Select value={sourceType} onChange={setSourceType} style={{ width: 200 }}>
                    <Option value="excel">Excel (.xlsx/.xls)</Option>
                    <Option value="tc-xml">Teamcenter XML</Option>
                    <Option value="word">Word (.docx)</Option>
                  </Select>
                </div>

                <Upload.Dragger
                  fileList={fileList}
                  onChange={({ fileList }) => setFileList(fileList)}
                  beforeUpload={handleUpload}
                  maxCount={1}
                  accept={sourceType === 'excel' ? '.xlsx,.xls' : sourceType === 'word' ? '.docx' : '.xml'}
                >
                  <p className="upload-icon">📁</p>
                  <p className="upload-text">点击或拖拽文件到此处上传</p>
                  <p style={{ color: '#999', fontSize: 12 }}>支持 Excel、Word、Teamcenter XML 格式</p>
                </Upload.Dragger>
              </Space>
            )}

            {currentStep === 1 && parsedData && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="文件解析成功"
                  description={`共 ${parsedData.totalRows} 行数据，已识别字段: ${parsedData.headers.length}`}
                  type="success"
                  showIcon
                />

                {parsedData.unmappedFields.length > 0 && (
                  <Alert
                    message="未识别字段"
                    description={
                      <Space>
                        {parsedData.unmappedFields.map((f) => (
                          <Tag key={f}>{f}</Tag>
                        ))}
                      </Space>
                    }
                    type="warning"
                    showIcon
                  />
                )}

                <div>
                  <h4 style={{ marginBottom: 12 }}>数据预览（前 5 行）</h4>
                  <Table
                    columns={previewColumns}
                    dataSource={parsedData.rows.slice(0, 5).map((r, i) => ({ ...r, key: i }))}
                    size="small"
                    scroll={{ x: true }}
                    pagination={false}
                  />
                </div>

                <div>
                  <h4 style={{ marginBottom: 12 }}>字段映射配置</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {parsedData.headers.map((header) => (
                      <Space key={header}>
                        <span style={{ width: 200 }}>{header}</span>
                        <ArrowRightOutlined />
                        <Select
                          value={fieldMappings.find((m) => m.sourceField === header)?.targetField}
                          onChange={(value) => {
                            setFieldMappings((prev) => {
                              const filtered = prev.filter((m) => m.sourceField !== header);
                              return [...filtered, { sourceField: header, targetField: value, transform: 'direct' }];
                            });
                          }}
                          style={{ width: 150 }}
                          placeholder="选择目标字段"
                          allowClear
                        >
                          {standardFields.map((sf) => (
                            <Option key={sf.value} value={sf.value}>{sf.label}</Option>
                          ))}
                        </Select>
                      </Space>
                    ))}
                  </Space>
                </div>

                <div>
                  <h4 style={{ marginBottom: 12 }}>BOM 名称</h4>
                  <Input
                    value={bomName}
                    onChange={(e) => setBomName(e.target.value)}
                    placeholder="输入新建 BOM 的名称"
                    style={{ width: 400 }}
                  />
                </div>

                <Space>
                  <Button onClick={() => setCurrentStep(0)}>上一步</Button>
                  <Button type="primary" onClick={handleConvert} loading={converting}>
                    开始转换
                  </Button>
                </Space>
              </Space>
            )}

            {currentStep === 2 && conversionResult && (
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Alert
                  message="导入成功"
                  description={
                    <Space direction="vertical">
                      <span>BOM 编码: {conversionResult.bomCode}</span>
                      <span>已转换 {conversionResult.itemsConverted} 条数据</span>
                    </Space>
                  }
                  type="success"
                  showIcon
                />

                <Space>
                  <Button type="primary" onClick={() => window.location.href = `/boms/${conversionResult.taskId}`}>
                    查看 BOM
                  </Button>
                  <Button onClick={() => {
                    setCurrentStep(0);
                    setFileList([]);
                    setParsedData(null);
                    setFileId(null);
                    setBomName('');
                    setFieldMappings([]);
                    setConversionResult(null);
                  }}>
                    继续导入
                  </Button>
                </Space>
              </Space>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EBOMImportPage;
