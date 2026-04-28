import React, { useEffect, useState } from 'react';
import {
  Typography,
  Button,
  Space,
  Alert,
  message,
  Card,
  Descriptions,
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
    setBacking(true);
    setError(null);
    try {
      const info = await backupApi.create();
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

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    try {
      await backupApi.restore();
      message.success('数据恢复成功，请刷新页面查看最新数据');
      fetchLatest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '恢复失败';
      setError(msg);
      message.error(msg);
    } finally {
      setRestoring(false);
    }
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
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleBackup}
          loading={backing}
        >
          创建备份
        </Button>
      </Card>

      <Card title="恢复数据">
        <Alert
          message="注意"
          description="恢复操作将覆盖当前所有数据，请确保已备份当前数据。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Button
          icon={<CloudDownloadOutlined />}
          loading={restoring}
          danger
          onClick={handleRestore}
        >
          {restoring ? '恢复中...' : '恢复'}
        </Button>
      </Card>
    </div>
  );
};

export default BackupRestore;
