import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Typography,
  Button,
  Modal,
  Form,
  Select,
  Space,
  Tag,
  Alert,
  message,
  Spin,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StocktakingTask, Location, Book } from '../../shared/types';
import { stocktakingApi, locationApi, bookApi } from '../utils/ipc';
import {
  STOCKTAKING_STATUS_LABELS,
} from '../../shared/constants';
import { formatDateTime } from '../utils/format';

const StocktakingList: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<StocktakingTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form] = Form.useForm();

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await stocktakingApi.list();
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取盘点任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    locationApi.list().then(setLocations).catch(() => {});
    bookApi.list({ page: 1, pageSize: 1000 }).then((r) => {
      const cats = [...new Set(r.data.map((b) => b.category).filter((c): c is string => c !== null))];
      setCategories(cats);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      await stocktakingApi.create({
        scopeType: values.scopeType,
        scopeValue: values.scopeType === 'location'
          ? JSON.stringify(values.locationIds)
          : JSON.stringify(values.categories),
      });
      message.success('盘点任务创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      fetchTasks();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const scopeType = Form.useWatch('scopeType', form);

  const parseScopeValue = (task: StocktakingTask): string => {
    try {
      const values = JSON.parse(task.scopeValue);
      if (task.scopeType === 'location') {
        const ids = values as string[];
        return ids.map((id) => {
          const loc = locations.find((l) => l.id === id);
          return loc ? `${loc.warehouse}-${loc.shelf}-${loc.layer}` : id;
        }).join(', ');
      }
      return (values as string[]).join(', ');
    } catch {
      return task.scopeValue;
    }
  };

  const columns: ColumnsType<StocktakingTask> = [
    {
      title: '盘点范围类型',
      dataIndex: 'scopeType',
      key: 'scopeType',
      render: (val: string) => val === 'location' ? '按位置' : '按分类',
    },
    {
      title: '盘点范围',
      key: 'scopeValue',
      render: (_: unknown, record: StocktakingTask) => parseScopeValue(record),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <Tag color={val === 'completed' ? 'green' : 'blue'}>
          {STOCKTAKING_STATUS_LABELS[val] ?? val}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime,
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (val: string | null) => val ? formatDateTime(val) : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: StocktakingTask) => (
        <a onClick={() => navigate(`/stocktaking/${record.id}`)}>查看详情</a>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>库存盘点</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          创建盘点任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="创建盘点任务"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); form.resetFields(); }}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="scopeType" label="盘点范围类型" rules={[{ required: true, message: '请选择盘点范围类型' }]}>
            <Select
              placeholder="选择范围类型"
              options={[
                { value: 'location', label: '按位置' },
                { value: 'category', label: '按分类' },
              ]}
            />
          </Form.Item>

          {scopeType === 'location' && (
            <Form.Item name="locationIds" label="选择位置" rules={[{ required: true, message: '请选择至少一个位置' }]}>
              <Select
                mode="multiple"
                placeholder="选择盘点位置"
                showSearch
                optionFilterProp="label"
                options={locations.map((l) => ({
                  value: l.id,
                  label: `${l.warehouse}-${l.shelf}-${l.layer}`,
                }))}
              />
            </Form.Item>
          )}

          {scopeType === 'category' && (
            <Form.Item name="categories" label="选择分类" rules={[{ required: true, message: '请选择至少一个分类' }]}>
              <Select
                mode="multiple"
                placeholder="选择盘点分类"
                showSearch
                options={categories.map((c) => ({ value: c, label: c }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default StocktakingList;
