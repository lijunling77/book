import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Popconfirm, message, Modal, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LocationDict as LocationDictType } from '../../shared/types';
import { locationDictApi } from '../utils/ipc';

const LocationDict: React.FC = () => {
  const [locations, setLocations] = useState<LocationDictType[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const data = await locationDictApi.list();
      setLocations(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载位置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      message.warning('请输入位置名称');
      return;
    }
    setSubmitting(true);
    try {
      await locationDictApi.create(trimmed);
      message.success('位置创建成功');
      setNewName('');
      setModalOpen(false);
      fetchLocations();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await locationDictApi.delete(id);
      message.success('位置删除成功');
      fetchLocations();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ColumnsType<LocationDictType> = [
    {
      title: '位置名称',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: LocationDictType) => (
        <Popconfirm
          title="确认删除"
          description={`确定要删除位置「${record.name}」吗？`}
          onConfirm={() => handleDelete(record.id)}
          okText="确认"
          cancelText="取消"
        >
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>位置管理</Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新增位置
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={locations}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="新增位置"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); setNewName(''); }}
        okText="确定"
        confirmLoading={submitting}
        width={400}
        destroyOnClose
      >
        <Input
          placeholder="请输入位置名称，如 A架3层"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleCreate}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default LocationDict;
