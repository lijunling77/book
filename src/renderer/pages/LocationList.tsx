import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Popconfirm,
  message,
  Alert,
  Modal,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Location, StockUnitAtLocation } from '../../shared/types';
import { locationApi } from '../utils/ipc';
import { useLocationStore } from '../stores/locationStore';
import LocationForm from '../components/LocationForm';

const LocationList: React.FC = () => {
  const { locations, loading, error, locationStock, locationStockLoading, fetchLocations, fetchLocationStock } =
    useLocationStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalTitle, setStockModalTitle] = useState('');

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleDelete = async (id: string) => {
    try {
      await locationApi.delete(id);
      message.success('位置删除成功');
      fetchLocations();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleEdit = (loc: Location) => {
    setEditingLocation(loc);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingLocation(null);
    setFormOpen(true);
  };

  const handleViewStock = async (loc: Location) => {
    setStockModalTitle(`${loc.warehouse} - ${loc.shelf} - ${loc.layer} 库存`);
    await fetchLocationStock(loc.id);
    setStockModalOpen(true);
  };

  const columns: ColumnsType<Location> = [
    { title: '仓库名称', dataIndex: 'warehouse', key: 'warehouse' },
    { title: '书架编号', dataIndex: 'shelf', key: 'shelf' },
    { title: '层号', dataIndex: 'layer', key: 'layer' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: unknown, record: Location) => (
        <Space>
          <a onClick={() => handleViewStock(record)}>查看库存</a>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <Popconfirm
            title="确认删除"
            description="确定要删除该位置吗？有库存时无法删除。"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const stockColumns: ColumnsType<StockUnitAtLocation> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '库存数量', dataIndex: 'quantity', key: 'quantity' },
  ];

  return (
    <div>
      <Typography.Title level={4}>位置管理</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增位置
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={locations}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <LocationForm
        open={formOpen}
        location={editingLocation}
        onClose={() => setFormOpen(false)}
        onSuccess={() => fetchLocations()}
      />

      <Modal
        title={stockModalTitle}
        open={stockModalOpen}
        onCancel={() => setStockModalOpen(false)}
        footer={null}
        width={600}
      >
        <Table
          columns={stockColumns}
          dataSource={locationStock}
          rowKey={(r) => `${r.bookId}`}
          loading={locationStockLoading}
          pagination={false}
          locale={{ emptyText: '该位置暂无库存' }}
        />
      </Modal>
    </div>
  );
};

export default LocationList;
