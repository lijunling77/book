import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Typography,
  Alert,
  Select,
  Input,
  Space,
  Tag,
  Switch,
  Modal,
  InputNumber,
  message,
} from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StockView, StockSummaryView, Location } from '../../shared/types';
import { stockApi, locationApi } from '../utils/ipc';
import { useStockStore } from '../stores/stockStore';
import { NO_DATA_TEXT, CURRENCY_UNIT } from '../../shared/constants';
import { formatPriceValue } from '../utils/format';

const StockList: React.FC = () => {
  const {
    stocks,
    summaryStocks,
    total,
    page,
    pageSize,
    loading,
    error,
    viewMode,
    filter,
    fetchStocks,
    fetchSummary,
    setViewMode,
    setFilter,
    setPage,
  } = useStockStore();

  const [locations, setLocations] = useState<Location[]>([]);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertEditionId, setAlertEditionId] = useState<string | null>('');
  const [alertThreshold, setAlertThreshold] = useState<number | null>(null);
  const [alertEditionLabel, setAlertEditionLabel] = useState('');

  useEffect(() => {
    locationApi.list().then(setLocations).catch(() => {});
  }, []);

  const loadData = useCallback(() => {
    if (viewMode === 'detail') {
      fetchStocks();
    } else {
      fetchSummary();
    }
  }, [viewMode, fetchStocks, fetchSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilter({ [key]: value });
    setPage(1, pageSize);
  };

  const handleSetAlert = (editionId: string | null, currentThreshold: number | null, label: string) => {
    setAlertEditionId(editionId);
    setAlertThreshold(currentThreshold);
    setAlertEditionLabel(label);
    setAlertModalOpen(true);
  };

  const handleSaveAlert = async () => {
    if (!alertEditionId) {
      message.error('版本信息缺失，无法设置预警');
      return;
    }
    try {
      await stockApi.setAlert(alertEditionId, alertThreshold);
      message.success('预警阈值设置成功');
      setAlertModalOpen(false);
      loadData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '设置失败');
    }
  };

  const priceRender = (val: number | null) =>
    val !== null && val !== undefined ? `${formatPriceValue(val)} ${CURRENCY_UNIT}` : NO_DATA_TEXT;

  const detailColumns: ColumnsType<StockView> = [
    {
      title: '封面',
      key: 'thumbnail',
      width: 60,
      render: (_: unknown, record: StockView) =>
        record.thumbnailPath ? (
          <img src={record.thumbnailPath} alt="封面" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>无图</div>
        ),
    },
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '版本', dataIndex: 'editionName', key: 'editionName' },
    {
      title: '位置',
      key: 'location',
      render: (_: unknown, r: StockView) => `${r.warehouse}-${r.shelf}-${r.layer}`,
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number, record: StockView) => (
        <span style={record.status === '缺货' ? { color: '#ff4d4f', fontWeight: 'bold' } : undefined}>
          {val}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string, record: StockView) => (
        <Space>
          {val === '缺货' ? <Tag color="red">缺货</Tag> : <Tag color="green">正常</Tag>}
          {record.isAlert && <Tag icon={<WarningOutlined />} color="warning">预警</Tag>}
        </Space>
      ),
    },
    { title: '最近买入价', dataIndex: 'latestPurchasePrice', key: 'latestPurchasePrice', render: priceRender },
    { title: '最近售出价', dataIndex: 'latestSellingPrice', key: 'latestSellingPrice', render: priceRender },
    { title: '买入价范围', key: 'priceRange', render: (_: unknown, r: StockView) => r.purchasePriceMin !== null ? `${formatPriceValue(r.purchasePriceMin)} ~ ${formatPriceValue(r.purchasePriceMax)}` : NO_DATA_TEXT },
    { title: '平均买入价', dataIndex: 'averagePurchasePrice', key: 'averagePurchasePrice', render: priceRender },
    { title: '平均售出价', dataIndex: 'averageSellingPrice', key: 'averageSellingPrice', render: priceRender },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: StockView) => (
        <a onClick={() => handleSetAlert(record.editionId, record.alertThreshold, `${record.bookTitle} - ${record.editionName}`)}>
          设置预警
        </a>
      ),
    },
  ];

  const summaryColumns: ColumnsType<StockSummaryView> = [
    {
      title: '封面',
      key: 'thumbnail',
      width: 60,
      render: (_: unknown, record: StockSummaryView) =>
        record.thumbnailPath ? (
          <img src={record.thumbnailPath} alt="封面" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div style={{ width: 40, height: 40, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999' }}>无图</div>
        ),
    },
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '版本', dataIndex: 'editionName', key: 'editionName' },
    { title: 'ISBN', dataIndex: 'isbn', key: 'isbn' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: '总库存',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (val: number) => <span style={{ fontWeight: 'bold' }}>{val}</span>,
    },
    {
      title: '预警阈值',
      dataIndex: 'alertThreshold',
      key: 'alertThreshold',
      render: (val: number | null) => val ?? '-',
    },
    {
      title: '状态',
      key: 'status',
      render: (_: unknown, record: StockSummaryView) =>
        record.isAlert ? <Tag icon={<WarningOutlined />} color="warning">预警</Tag> : <Tag color="green">正常</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: StockSummaryView) => (
        <a onClick={() => handleSetAlert(record.editionId, record.alertThreshold, `${record.bookTitle} - ${record.editionName}`)}>
          设置预警
        </a>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>库存查询</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="按书名筛选"
          allowClear
          style={{ width: 200 }}
          onSearch={(v) => handleFilterChange('bookTitle', v || undefined)}
        />
        <Input.Search
          placeholder="按分类筛选"
          allowClear
          style={{ width: 160 }}
          onSearch={(v) => handleFilterChange('category', v || undefined)}
        />
        <Input.Search
          placeholder="按版本名称筛选"
          allowClear
          style={{ width: 160 }}
          onSearch={(v) => handleFilterChange('editionName', v || undefined)}
        />
        <Select
          placeholder="按位置筛选"
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: 200 }}
          value={filter.locationId}
          onChange={(v) => handleFilterChange('locationId', v)}
          options={locations.map((l) => ({ value: l.id, label: `${l.warehouse}-${l.shelf}-${l.layer}` }))}
        />
        <Space>
          <span>汇总视图</span>
          <Switch
            checked={viewMode === 'summary'}
            onChange={(checked) => setViewMode(checked ? 'summary' : 'detail')}
          />
        </Space>
      </Space>

      {viewMode === 'detail' ? (
        <Table
          columns={detailColumns}
          dataSource={stocks}
          rowKey="stockId"
          loading={loading}
          scroll={{ x: 1400 }}
          rowClassName={(record) => (record.isAlert ? 'ant-table-row-warning' : '')}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p, ps);
              fetchStocks({ page: p, pageSize: ps });
            },
          }}
        />
      ) : (
        <Table
          columns={summaryColumns}
          dataSource={summaryStocks}
          rowKey={(r) => `${r.bookId}-${r.editionId}`}
          loading={loading}
          rowClassName={(record) => (record.isAlert ? 'ant-table-row-warning' : '')}
          pagination={false}
        />
      )}

      <Modal
        title={`设置预警阈值 - ${alertEditionLabel}`}
        open={alertModalOpen}
        onOk={handleSaveAlert}
        onCancel={() => setAlertModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8 }}>
          当库存总量低于或等于预警阈值时，系统将发出预警提示。设为空则取消预警。
        </div>
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={0}
          placeholder="输入预警阈值（留空取消预警）"
          value={alertThreshold}
          onChange={(v) => setAlertThreshold(v)}
        />
      </Modal>
    </div>
  );
};

export default StockList;
