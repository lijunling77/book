import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Table, DatePicker, Space, Spin, Alert, Button, Input, message } from 'antd';
import { DownloadOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { reportApi } from '../utils/ipc';
import type { ExportFormat } from '../../shared/types';

const { RangePicker } = DatePicker;
const { Title } = Typography;

interface ReportRow {
  bookTitle: string;
  author: string | null;
  locations: string | null;
  totalQuantity: number;
  inboundTotalQuantity: number;
  inboundTotalAmount: number;
  outboundTotalQuantity: number;
  outboundTotalAmount: number;
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

const formatPrice = (val: number | null | undefined): string => val === null || val === undefined ? '-' : `¥${val.toFixed(2)}`;
const formatAmount = (val: number): string => `¥${val.toFixed(2)}`;

const Report: React.FC = () => {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [filterTitle, setFilterTitle] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [localDateRange, setLocalDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const dr = dateRange ? { startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') } : undefined;
      const result = await reportApi.export(dr, format);
      if (result.canceled) return;
      if (result.filePath) message.success(`导出成功：${result.filePath}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const dr = dateRange ? { startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') } : undefined;
      setData((await reportApi.getData(dr)) as ReportRow[]);
    } catch (err) { setError(err instanceof Error ? err.message : '获取报表数据失败'); }
    finally { setLoading(false); }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = data.filter((row) => {
    if (filterTitle && !row.bookTitle.includes(filterTitle)) return false;
    if (filterLocation && !(row.locations || '').includes(filterLocation)) return false;
    return true;
  });

  const handleQuery = () => {
    setDateRange(localDateRange);
  };

  const handleReset = () => {
    setFilterTitle('');
    setFilterLocation('');
    setLocalDateRange(null);
    setDateRange(null);
  };

  const columns: ColumnsType<ReportRow> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', width: 200 },
    { title: '作者', dataIndex: 'author', key: 'author', width: 100, render: (v: string | null) => v ?? '-' },
    { title: '位置', dataIndex: 'locations', key: 'locations', width: 140, render: (v: string | null) => v ?? '-' },
    { title: '库存数量', dataIndex: 'totalQuantity', key: 'totalQuantity', width: 100, sorter: (a, b) => a.totalQuantity - b.totalQuantity, render: (val: number) => <span style={{ fontWeight: 'bold' }}>{val}</span> },
    { title: '入库总量', dataIndex: 'inboundTotalQuantity', key: 'inboundTotalQuantity', width: 100, sorter: (a, b) => a.inboundTotalQuantity - b.inboundTotalQuantity },
    { title: '入库总金额', dataIndex: 'inboundTotalAmount', key: 'inboundTotalAmount', width: 120, sorter: (a, b) => a.inboundTotalAmount - b.inboundTotalAmount, render: formatAmount },
    { title: '出库总量', dataIndex: 'outboundTotalQuantity', key: 'outboundTotalQuantity', width: 100, sorter: (a, b) => a.outboundTotalQuantity - b.outboundTotalQuantity },
    { title: '出库总金额', dataIndex: 'outboundTotalAmount', key: 'outboundTotalAmount', width: 120, sorter: (a, b) => a.outboundTotalAmount - b.outboundTotalAmount, render: formatAmount },
    { title: '最近买入价', dataIndex: 'latestPurchasePrice', key: 'latestPurchasePrice', width: 110, render: formatPrice },
    { title: '最近售出价', dataIndex: 'latestSellingPrice', key: 'latestSellingPrice', width: 110, render: formatPrice },
    { title: '平均买入价', dataIndex: 'averagePurchasePrice', key: 'averagePurchasePrice', width: 110, render: formatPrice },
    { title: '平均售出价', dataIndex: 'averageSellingPrice', key: 'averageSellingPrice', width: 110, render: formatPrice },
    { title: '买入价范围', key: 'priceRange', width: 150, render: (_: unknown, record: ReportRow) => record.purchasePriceMin !== null ? `${formatPrice(record.purchasePriceMin)} ~ ${formatPrice(record.purchasePriceMax)}` : '-' },
    { title: '总采购成本', dataIndex: 'totalPurchaseCost', key: 'totalPurchaseCost', width: 120, sorter: (a, b) => a.totalPurchaseCost - b.totalPurchaseCost, render: formatAmount },
    { title: '总销售收入', dataIndex: 'totalSalesRevenue', key: 'totalSalesRevenue', width: 120, sorter: (a, b) => a.totalSalesRevenue - b.totalSalesRevenue, render: formatAmount },
    { title: '净利润', dataIndex: 'netProfit', key: 'netProfit', width: 120, sorter: (a, b) => a.netProfit - b.netProfit, render: (val: number) => <span style={{ color: val >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>{formatAmount(val)}</span> },
  ];

  return (
    <div>
      <Title level={4}>综合报表</Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索书名"
          allowClear
          style={{ width: 200 }}
          value={filterTitle}
          onChange={(e) => setFilterTitle(e.target.value)}
        />
        <Input
          placeholder="搜索位置"
          allowClear
          style={{ width: 200 }}
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
        />
        <RangePicker value={localDateRange} onChange={(dates) => setLocalDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} allowClear />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleQuery}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
      </Space>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Space>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => handleExport('xlsx')}>导出 Excel</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => handleExport('csv')}>导出 CSV</Button>
        </Space>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : (
        <Table columns={columns} dataSource={filteredData} rowKey={(_, index) => `report-${index}`} size="small" scroll={{ x: 1800 }} pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (total) => `共 ${total} 条` }} />
      )}
    </div>
  );
};

export default Report;
