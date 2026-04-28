import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Typography, Button, Tag, Alert, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StocktakingTask } from '../../shared/types';
import { stocktakingApi } from '../utils/ipc';
import { STOCKTAKING_STATUS_LABELS } from '../../shared/constants';
import { formatDateTime } from '../utils/format';

const StocktakingList: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<StocktakingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTasks = async () => { setLoading(true); setError(null); try { setTasks(await stocktakingApi.list()); } catch (err) { setError(err instanceof Error ? err.message : '获取盘点任务列表失败'); } finally { setLoading(false); } };

  useEffect(() => { fetchTasks(); }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      await stocktakingApi.create({ scopeType: 'all', scopeValue: 'all' });
      message.success('盘点任务创建成功');
      fetchTasks();
    } catch (err) { if (err instanceof Error) message.error(err.message); }
    finally { setCreating(false); }
  };

  const columns: ColumnsType<StocktakingTask> = [
    { title: '盘点范围', key: 'scopeValue', render: () => '所有库存' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (val: string) => <Tag color={val === 'completed' ? 'green' : 'blue'}>{STOCKTAKING_STATUS_LABELS[val] ?? val}</Tag>, sorter: (a, b) => a.status.localeCompare(b.status) },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: formatDateTime, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt) },
    { title: '完成时间', dataIndex: 'completedAt', key: 'completedAt', render: (val: string | null) => val ? formatDateTime(val) : '-', sorter: (a, b) => (a.completedAt || '').localeCompare(b.completedAt || '') },
    { title: '操作', key: 'action', width: 100, render: (_: unknown, record: StocktakingTask) => <a onClick={() => navigate(`/stocktaking/${record.id}`)}>查看详情</a> },
  ];

  return (
    <div>
      <Typography.Title level={4}>库存盘点</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={handleCreate}>盘点所有库存</Button>
      </div>
      <Table columns={columns} dataSource={tasks} rowKey="id" loading={loading} pagination={false} />
    </div>
  );
};

export default StocktakingList;
