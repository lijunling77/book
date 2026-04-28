import React, { useState } from 'react';
import { Typography, Button, Space, Alert, message, Card, Table, Select, Statistic, Row, Col } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ImportResultSummary, ImportFailureItem, ImportFileFormat } from '../../shared/types';
import { importApi } from '../utils/ipc';

const ImportBooks: React.FC = () => {
  const [templateFormat, setTemplateFormat] = useState<ImportFileFormat>('xlsx');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    try {
      const res = await importApi.template(templateFormat) as { filePath?: string; canceled?: boolean };
      if (res.canceled) return;
      if (res.filePath) message.success(`模板已保存：${res.filePath}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '下载模板失败');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const importResult = await importApi.books() as ImportResultSummary & { canceled?: boolean };
      if ((importResult as { canceled?: boolean }).canceled) {
        setImporting(false);
        return;
      }
      setResult(importResult);
      if (importResult.failureCount === 0) {
        message.success(`导入成功：共 ${importResult.successCount} 条记录`);
      } else {
        message.warning(`导入完成：成功 ${importResult.successCount} 条，失败 ${importResult.failureCount} 条`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '导入失败';
      setError(msg);
      message.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const failureColumns: ColumnsType<ImportFailureItem> = [
    { title: '行号', dataIndex: 'rowNumber', key: 'rowNumber', width: 80 },
    { title: '失败原因', dataIndex: 'reason', key: 'reason' },
  ];

  return (
    <div>
      <Typography.Title level={4}>数据导入</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Card title="下载导入模板" style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 160 }}
            value={templateFormat}
            onChange={setTemplateFormat}
            options={[
              { value: 'xlsx', label: 'Excel (.xlsx)' },
              { value: 'csv', label: 'CSV (.csv)' },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
        </Space>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          模板包含：书名、作者、描述 三列
        </div>
      </Card>

      <Card title="导入书籍数据" style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={importing}
          onClick={handleImport}
        >
          {importing ? '导入中...' : '选择文件并导入'}
        </Button>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          支持 .xlsx 和 .csv 格式文件
        </div>
      </Card>

      {result && (
        <Card title="导入结果">
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title="总记录数" value={result.totalCount} /></Col>
            <Col span={8}><Statistic title="成功" value={result.successCount} valueStyle={{ color: '#3f8600' }} /></Col>
            <Col span={8}><Statistic title="失败" value={result.failureCount} valueStyle={result.failureCount > 0 ? { color: '#cf1322' } : undefined} /></Col>
          </Row>
          {result.failures.length > 0 && (
            <>
              <Typography.Title level={5}>失败详情</Typography.Title>
              <Table columns={failureColumns} dataSource={result.failures} rowKey="rowNumber" pagination={false} size="small" />
            </>
          )}
        </Card>
      )}
    </div>
  );
};

export default ImportBooks;
