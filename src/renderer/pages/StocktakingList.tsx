import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Typography, Button, Modal, Form, Select, Tag, Alert, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StocktakingTask, Location } from '../../shared/types';
import { stocktakingApi, locationApi } from '../utils/ipc';
import { STOCKTAKING_STATUS_LABELS } from '../../shared/constants';
import { formatDateTime } from '../utils/format';

const StocktakingList: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<StocktakingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form] = Form.useForm();

  const fetchTasks = async () => { setLoading(true); setError(null); try { setTasks(await stocktakingApi.list()); } catch (err) { setError(err instanceof Error ? err.message : '获取盘点任务列表失败'); } finally { setLoading(false); } };

  useEffect(() => { fetchTasks(); locationApi.list().then(setLocations).catch(() => {}); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await stocktakingApi.create({ scopeType: 'location', scopeValue: values.locationId });
      message.success('盘点任务创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchTasks();
    } catch (err) { if (err instanceof Error) message.error(err.message); }
    finally { setCreating(false); }
  };

  const columns: ColumnsType<StocktakingTask> = [
    { title: '盘点范围', key: 'scopeValue', render: (_: unknown, record: StocktakingTask) => { const loc = locations.find((l) => l.id === record.scopeValue); return loc ? `${loc.warehouse}-${loc.shelf}-${loc.layer}` : record.scopeValue; } },
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建盘点任务</Button>
      </div>
      <Table columns={columns} dataSource={tasks} rowKey="id" loading={loading} pagination={false} />
      <Modal title="创建盘点任务" open={createModalOpen} onOk={handleCreate} onCancel={() => { setCreateModalOpen(false); form.resetFields(); }} confirmLoading={creating} okText="创建" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="locationId" label="选择位置" rules={[{ required: true, message: '请选择位置' }]}>
            <Select placeholder="选择盘点位置" showSearch optionFilterProp="label" options={locations.map((l) => ({ value: l.id, label: `${l.warehouse}-${l.shelf}-${l.layer}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StocktakingList;
