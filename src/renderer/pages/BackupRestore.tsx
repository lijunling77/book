import React, { useEffect, useState } from 'react';
import {
  Typography,
  Button,
  Space,
  Alert,
  message,
  Card,
  Descriptions,
  Input,
  Upload,
  Popconfirm,
  Empty,
} from 'antd';
import { SaveOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import type { BackupInfo } from '../../shared/types';
import { backupApi } from '../utils/ipc';
import { formatDateTime } from '../utils/format';

const BackupRestore: React.FC = () => {
  const [latestBackup, setLatestBackup] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupPath, setBackupPath] = useState('');
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fetchLatest = async () => {
    setLoading(true);
    try {
      const info = await backupApi.latest();
      setLatestBackup(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取备份信息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  const handleBackup = async () => {
    if (!backupPath.trim()) {
      message.warning('请输入备份路径');
      return;
    }
    setBacking(true);
    setError(null);
    try {
      const info = await backupApi.create(backupPath.trim());
      message.success(`备份成功：${info.filePath}`);
      setLatestBackup(info);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '备份失败';
      setError(msg);
      message.error(msg);
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async (file: File) => {
    const filePath = (file as unknown as { path: string }).path;
    if (!filePath) {
      message.error('无法获取文件路径');
      return false;
    }
    setRestoring(true);
    setError(null);
    try {
      await backupApi.restore(filePath);
      message.success('数据恢复成功，请刷新页面查看最新数据');
      fetchLatest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '恢复失败';
      setError(msg);
      message.error(msg);
    } finally {
      setRestoring(false);
    }
    return false;
  };

  return (
    <div>
      <Typography.Title level={4}>备份恢复</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Card title="最近备份信息" style={{ marginBottom: 16 }}>
        {latestBackup ? (
          <Descriptions>
            <Descriptions.Item label="备份时间">{formatDateTime(latestBackup.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="备份路径">{latestBackup.filePath}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description="暂无备份记录" />
        )}
      </Card>

      <Card title="创建备份" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="输入备份文件保存路径"
            style={{ width: 400 }}
            value={backupPath}
            onChange={(e) => setBackupPath(e.target.value)}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleBackup}
            loading={backing}
          >
            创建备份
          </Button>
        </Space>
        <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
          请输入完整的文件路径，例如：/Users/username/backup/books.db
        </div>
      </Card>

      <Card title="恢复数据">
        <Alert
          message="注意"
          description="恢复操作将覆盖当前所有数据，请确保已备份当前数据。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Upload
          accept=".db,.sqlite,.sqlite3"
          showUploadList={false}
          beforeUpload={handleRestore}
          disabled={restoring}
        >
          <Button
            icon={<CloudDownloadOutlined />}
            loading={restoring}
            danger
          >
            {restoring ? '恢复中...' : '选择备份文件并恢复'}
          </Button>
        </Upload>
      </Card>
    </div>
  );
};

export default BackupRestore;
