import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Table,
  DatePicker,
  Space,
  Spin,
  Alert,
} from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { reportApi } from '../utils/ipc';

const { RangePicker } = DatePicker;
const { Title } = Typography;

// ============================================================
// 类型定义（与 ReportService.ReportRow 对应）
// ============================================================

interface ReportRow {
  bookTitle: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  editionName: string;
  locations: string;
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

// ============================================================
// 工具函数
// ============================================================

const formatPrice = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '-';
  return `¥${val.toFixed(2)}`;
};

const formatAmount = (val: number): string => `¥${val.toFixed(2)}`;

// ============================================================
// 组件
// ============================================================

const Report: React.FC = () => {
  const [data, setData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dr = dateRange
        ? {
            startDate: dateRange[0].format('YYYY-MM-DD'),
            endDate: dateRange[1].format('YYYY-MM-DD'),
          }
        : undefined;
      const result = (await reportApi.getData(dr)) as ReportRow[];
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取报表数据失败');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // 列定义
  // ============================================================

  const columns: ColumnsType<ReportRow> = [
    {
      title: '书名',
      dataIndex: 'bookTitle',
      key: 'bookTitle',
      width: 160,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 100,
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: 'ISBN',
      dataIndex: 'isbn',
      key: 'isbn',
      width: 140,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '版本',
      dataIndex: 'editionName',
      key: 'editionName',
      width: 100,
    },
    {
      title: '位置',
      dataIndex: 'locations',
      key: 'locations',
      width: 180,
      ellipsis: true,
    },
    {
      title: '库存数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 100,
      sorter: (a, b) => a.totalQuantity - b.totalQuantity,
      render: (val: number) => <span style={{ fontWeight: 'bold' }}>{val}</span>,
    },
    {
      title: '入库总量',
      dataIndex: 'inboundTotalQuantity',
      key: 'inboundTotalQuantity',
      width: 100,
      sorter: (a, b) => a.inboundTotalQuantity - b.inboundTotalQuantity,
    },
    {
      title: '入库总金额',
      dataIndex: 'inboundTotalAmount',
      key: 'inboundTotalAmount',
      width: 120,
      sorter: (a, b) => a.inboundTotalAmount - b.inboundTotalAmount,
      render: (val: number) => formatAmount(val),
    },
    {
      title: '出库总量',
      dataIndex: 'outboundTotalQuantity',
      key: 'outboundTotalQuantity',
      width: 100,
      sorter: (a, b) => a.outboundTotalQuantity - b.outboundTotalQuantity,
    },
    {
      title: '出库总金额',
      dataIndex: 'outboundTotalAmount',
      key: 'outboundTotalAmount',
      width: 120,
      sorter: (a, b) => a.outboundTotalAmount - b.outboundTotalAmount,
      render: (val: number) => formatAmount(val),
    },
    {
      title: '最近买入价',
      dataIndex: 'latestPurchasePrice',
      key: 'latestPurchasePrice',
      width: 110,
      render: (val: number | null) => formatPrice(val),
    },
    {
      title: '最近售出价',
      dataIndex: 'latestSellingPrice',
      key: 'latestSellingPrice',
      width: 110,
      render: (val: number | null) => formatPrice(val),
    },
    {
      title: '平均买入价',
      dataIndex: 'averagePurchasePrice',
      key: 'averagePurchasePrice',
      width: 110,
      render: (val: number | null) => formatPrice(val),
    },
    {
      title: '平均售出价',
      dataIndex: 'averageSellingPrice',
      key: 'averageSellingPrice',
      width: 110,
      render: (val: number | null) => formatPrice(val),
    },
    {
      title: '买入价范围',
      key: 'priceRange',
      width: 150,
      render: (_: unknown, record: ReportRow) =>
        record.purchasePriceMin !== null
          ? `${formatPrice(record.purchasePriceMin)} ~ ${formatPrice(record.purchasePriceMax)}`
          : '-',
    },
    {
      title: '总采购成本',
      dataIndex: 'totalPurchaseCost',
      key: 'totalPurchaseCost',
      width: 120,
      sorter: (a, b) => a.totalPurchaseCost - b.totalPurchaseCost,
      render: (val: number) => formatAmount(val),
    },
    {
      title: '总销售收入',
      dataIndex: 'totalSalesRevenue',
      key: 'totalSalesRevenue',
      width: 120,
      sorter: (a, b) => a.totalSalesRevenue - b.totalSalesRevenue,
      render: (val: number) => formatAmount(val),
    },
    {
      title: '净利润',
      dataIndex: 'netProfit',
      key: 'netProfit',
      width: 120,
      sorter: (a, b) => a.netProfit - b.netProfit,
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {formatAmount(val)}
        </span>
      ),
    },
  ];

  // ============================================================
  // Render
  // ============================================================

  return (
    <div>
      <Title level={4}>综合报表</Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 24 }}>
        <span>日期范围筛选：</span>
        <RangePicker
          value={dateRange}
          onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          allowClear
        />
      </Space>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(_, index) => `report-${index}`}
          size="small"
          scroll={{ x: 2200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      )}
    </div>
  );
};

export default Report;
