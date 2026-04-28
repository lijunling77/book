import React, { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Alert, Select, Input, Space, Tag, Switch, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StockView, StockSummaryView, Location } from '../../shared/types';
import { locationApi } from '../utils/ipc';
import { useStockStore } from '../stores/stockStore';
import { CURRENCY_UNIT } from '../../shared/constants';
import { formatPriceValue } from '../utils/format';

const StockList: React.FC = () => {
  const { stocks, summaryStocks, total, page, pageSize, loading, error, viewMode, filter, fetchStocks, fetchSummary, setViewMode, setFilter, setPage } = useStockStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [localBookTitle, setLocalBookTitle] = useState<string | undefined>(filter.bookTitle);
  const [localLocationId, setLocalLocationId] = useState<string | undefined>(filter.locationId);
  const [localStatus, setLocalStatus] = useState<string | undefined>();

  useEffect(() => { locationApi.list().then(setLocations).catch(() => {}); }, []);

  const loadData = useCallback(() => {
    if (viewMode === 'detail') fetchStocks(); else fetchSummary();
  }, [viewMode, fetchStocks, fetchSummary]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleQuery = () => {
    const newFilter = { bookTitle: localBookTitle, locationId: localLocationId, page: 1, pageSize };
    setFilter({ bookTitle: localBookTitle, locationId: localLocationId });
    setPage(1, pageSize);
    if (viewMode === 'detail') fetchStocks(newFilter); else fetchSummary(newFilter);
  };

  const handleReset = () => {
    setLocalBookTitle(undefined);
    setLocalLocationId(undefined);
    setLocalStatus(undefined);
    setFilter({ bookTitle: undefined, locationId: undefined });
    setPage(1, pageSize);
    const newFilter = { bookTitle: undefined, locationId: undefined, page: 1, pageSize };
    if (viewMode === 'detail') fetchStocks(newFilter); else fetchSummary(newFilter);
  };

  // 前端按状态过滤
  const filteredStocks = localStatus
    ? stocks.filter((s) => s.status === localStatus)
    : stocks;

  const priceRender = (val: number | null) => val !== null && val !== undefined ? `${formatPriceValue(val)} ${CURRENCY_UNIT}` : '-';

  const detailColumns: ColumnsType<StockView> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', sorter: (a, b) => a.bookTitle.localeCompare(b.bookTitle) },
    { title: '位置', key: 'location', render: (_: unknown, r: StockView) => `${r.warehouse}-${r.shelf}-${r.layer}` },
    { title: '库存数量', dataIndex: 'quantity', key: 'quantity', sorter: (a, b) => a.quantity - b.quantity, render: (val: number, record: StockView) => <span style={record.status === '缺货' ? { color: '#ff4d4f', fontWeight: 'bold' } : undefined}>{val}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (val: string) => val === '缺货' ? <Tag color="red">缺货</Tag> : <Tag color="green">正常</Tag> },
    { title: '最近买入价', dataIndex: 'latestPurchasePrice', key: 'latestPurchasePrice', sorter: (a, b) => (a.latestPurchasePrice ?? 0) - (b.latestPurchasePrice ?? 0), render: priceRender },
    { title: '最近售出价', dataIndex: 'latestSellingPrice', key: 'latestSellingPrice', sorter: (a, b) => (a.latestSellingPrice ?? 0) - (b.latestSellingPrice ?? 0), render: priceRender },
    { title: '买入价范围', key: 'priceRange', render: (_: unknown, r: StockView) => r.purchasePriceMin !== null ? `${formatPriceValue(r.purchasePriceMin)} ~ ${formatPriceValue(r.purchasePriceMax)}` : '-' },
    { title: '平均买入价', dataIndex: 'averagePurchasePrice', key: 'averagePurchasePrice', sorter: (a, b) => (a.averagePurchasePrice ?? 0) - (b.averagePurchasePrice ?? 0), render: priceRender },
    { title: '平均售出价', dataIndex: 'averageSellingPrice', key: 'averageSellingPrice', sorter: (a, b) => (a.averageSellingPrice ?? 0) - (b.averageSellingPrice ?? 0), render: priceRender },
  ];

  const summaryColumns: ColumnsType<StockSummaryView> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', sorter: (a, b) => a.bookTitle.localeCompare(b.bookTitle) },
    { title: '总库存', dataIndex: 'totalQuantity', key: 'totalQuantity', sorter: (a, b) => a.totalQuantity - b.totalQuantity, render: (val: number) => <span style={{ fontWeight: 'bold' }}>{val}</span> },
  ];

  return (
    <div>
      <Typography.Title level={4}>库存查询</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="按书名筛选" allowClear style={{ width: 200 }} value={localBookTitle} onChange={(e) => setLocalBookTitle(e.target.value || undefined)} />
        <Select placeholder="按位置筛选" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} value={localLocationId} onChange={(v) => setLocalLocationId(v)} options={locations.map((l) => ({ value: l.id, label: `${l.warehouse}-${l.shelf}-${l.layer}` }))} />
        {viewMode === 'detail' && (
          <Select
            placeholder="按状态筛选"
            allowClear
            style={{ width: 140 }}
            value={localStatus}
            onChange={(v) => setLocalStatus(v)}
            options={[
              { value: '正常', label: '正常' },
              { value: '缺货', label: '缺货' },
            ]}
          />
        )}
        <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
        <Space><span>汇总视图</span><Switch checked={viewMode === 'summary'} onChange={(checked) => setViewMode(checked ? 'summary' : 'detail')} /></Space>
      </Space>
      {viewMode === 'detail' ? (
        <Table columns={detailColumns} dataSource={filteredStocks} rowKey="stockId" loading={loading} scroll={{ x: 1200 }} pagination={{ current: page, pageSize, total: localStatus ? filteredStocks.length : total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p, ps); fetchStocks({ page: p, pageSize: ps }); } }} />
      ) : (
        <Table columns={summaryColumns} dataSource={summaryStocks} rowKey="bookId" loading={loading} pagination={false} />
      )}
    </div>
  );
};

export default StockList;
