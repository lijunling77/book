import React, { useEffect, useState } from 'react';
import { Table, Typography, Alert, Empty, Tag, Spin } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AlertStockUnit } from '../../shared/types';
import { stockApi } from '../utils/ipc';

const AlertList: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertStockUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    stockApi
      .alertList()
      .then(setAlerts)
      .catch((err) => setError(err instanceof Error ? err.message : '获取预警列表失败'))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<AlertStockUnit> = [
    {
      title: '封面',
      dataIndex: 'thumbnailPath',
      key: 'thumbnail',
      width: 60,
      render: (path: string | null) =>
        path ? (
          <img src={path} alt="封面" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>无图</div>
        ),
    },
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '版本', dataIndex: 'editionName', key: 'editionName' },
    {
      title: '当前总库存',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (val: number) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{val}</span>
      ),
    },
    { title: '预警阈值', dataIndex: 'alertThreshold', key: 'alertThreshold' },
    {
      title: '状态',
      key: 'status',
      render: () => <Tag icon={<WarningOutlined />} color="warning">预警中</Tag>,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Typography.Title level={4}>库存预警</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {alerts.length === 0 ? (
        <Empty description="当前无库存预警" />
      ) : (
        <Table
          columns={columns}
          dataSource={alerts}
          rowKey={(record) => `${record.bookId}-${record.editionId}`}
          pagination={false}
        />
      )}
    </div>
  );
};

export default AlertList;
