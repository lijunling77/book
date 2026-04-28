import React, { useEffect, useState } from 'react';
import { Typography, Table, Alert, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Book, PurchasePriceHistory, SellingPriceHistory, PriceStats } from '../../shared/types';
import { bookApi, priceApi } from '../utils/ipc';
import { CURRENCY_UNIT, NO_DATA_TEXT } from '../../shared/constants';
import { formatPriceValue, formatDate } from '../utils/format';

interface BookPriceRow {
  bookId: string;
  bookTitle: string;
  author: string | null;
  latestPurchasePrice: number | null;
  latestSellingPrice: number | null;
  averagePurchasePrice: number | null;
  averageSellingPrice: number | null;
  purchasePriceMin: number | null;
  purchasePriceMax: number | null;
}

const priceRender = (val: number | null) =>
  val !== null && val !== undefined ? `¥${formatPriceValue(val)}` : NO_DATA_TEXT;

const PriceHistory: React.FC = () => {
  const [rows, setRows] = useState<BookPriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    bookApi.list({ page: 1, pageSize: 1000 })
      .then(async (result) => {
        const bookRows: BookPriceRow[] = [];
        for (const book of result.data) {
          try {
            const stats = await priceApi.stats(book.id);
            bookRows.push({
              bookId: book.id,
              bookTitle: book.title,
              author: book.author,
              latestPurchasePrice: stats.latestPurchasePrice,
              latestSellingPrice: stats.latestSellingPrice,
              averagePurchasePrice: stats.averagePurchasePrice,
              averageSellingPrice: stats.averageSellingPrice,
              purchasePriceMin: stats.purchasePriceMin,
              purchasePriceMax: stats.purchasePriceMax,
            });
          } catch {
            bookRows.push({
              bookId: book.id,
              bookTitle: book.title,
              author: book.author,
              latestPurchasePrice: null,
              latestSellingPrice: null,
              averagePurchasePrice: null,
              averageSellingPrice: null,
              purchasePriceMin: null,
              purchasePriceMax: null,
            });
          }
        }
        setRows(bookRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取数据失败'))
      .finally(() => setLoading(false));
  }, []);

  const columns: ColumnsType<BookPriceRow> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', width: 200, sorter: (a, b) => a.bookTitle.localeCompare(b.bookTitle) },
    { title: '作者', dataIndex: 'author', key: 'author', width: 120, render: (v: string | null) => v ?? '-' },
    { title: '最近买入价', dataIndex: 'latestPurchasePrice', key: 'latestPurchasePrice', render: priceRender, sorter: (a, b) => (a.latestPurchasePrice ?? 0) - (b.latestPurchasePrice ?? 0) },
    { title: '最近售出价', dataIndex: 'latestSellingPrice', key: 'latestSellingPrice', render: priceRender, sorter: (a, b) => (a.latestSellingPrice ?? 0) - (b.latestSellingPrice ?? 0) },
    { title: '平均买入价', dataIndex: 'averagePurchasePrice', key: 'averagePurchasePrice', render: priceRender, sorter: (a, b) => (a.averagePurchasePrice ?? 0) - (b.averagePurchasePrice ?? 0) },
    { title: '平均售出价', dataIndex: 'averageSellingPrice', key: 'averageSellingPrice', render: priceRender, sorter: (a, b) => (a.averageSellingPrice ?? 0) - (b.averageSellingPrice ?? 0) },
    {
      title: '买入价范围',
      key: 'priceRange',
      render: (_: unknown, r: BookPriceRow) =>
        r.purchasePriceMin !== null ? `¥${formatPriceValue(r.purchasePriceMin)} ~ ¥${formatPriceValue(r.purchasePriceMax)}` : NO_DATA_TEXT,
    },
  ];

  const expandedRowRender = (record: BookPriceRow) => <ExpandedDetail bookId={record.bookId} />;

  return (
    <div>
      <Typography.Title level={4}>价格历史</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : rows.length === 0 ? (
        <Empty description="暂无书籍数据" />
      ) : (
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="bookId"
          expandable={{
            expandedRowRender,
            expandIconColumnIndex: columns.length,
          }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      )}
    </div>
  );
};

/** 展开的买入/售出详情 */
const ExpandedDetail: React.FC<{ bookId: string }> = ({ bookId }) => {
  const [purchaseHistory, setPurchaseHistory] = useState<PurchasePriceHistory[]>([]);
  const [sellingHistory, setSellingHistory] = useState<SellingPriceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([priceApi.purchaseHistory(bookId), priceApi.sellingHistory(bookId)])
      .then(([ph, sh]) => { setPurchaseHistory(ph); setSellingHistory(sh); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) return <Spin size="small" />;

  const purchaseColumns: ColumnsType<PurchasePriceHistory> = [
    { title: '入库日期', dataIndex: 'inboundDate', key: 'inboundDate', render: formatDate },
    { title: `买入价格（${CURRENCY_UNIT}）`, dataIndex: 'purchasePrice', key: 'purchasePrice', render: (v: number) => formatPriceValue(v) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', render: (v: string | null) => v ?? '-' },
  ];

  const sellingColumns: ColumnsType<SellingPriceHistory> = [
    { title: '出库日期', dataIndex: 'outboundDate', key: 'outboundDate', render: formatDate },
    { title: `售出价格（${CURRENCY_UNIT}）`, dataIndex: 'sellingPrice', key: 'sellingPrice', render: (v: number) => formatPriceValue(v) },
    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
    { title: '买家', dataIndex: 'buyer', key: 'buyer', render: (v: string | null) => v ?? '-' },
  ];

  return (
    <div style={{ padding: '8px 0' }}>
      <Typography.Text strong>买入记录</Typography.Text>
      <Table
        columns={purchaseColumns}
        dataSource={purchaseHistory}
        rowKey="inboundRecordId"
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无买入记录' }}
        style={{ marginBottom: 16, marginTop: 8 }}
      />
      <Typography.Text strong>售出记录</Typography.Text>
      <Table
        columns={sellingColumns}
        dataSource={sellingHistory}
        rowKey="outboundRecordId"
        pagination={false}
        size="small"
        locale={{ emptyText: '暂无售出记录' }}
        style={{ marginTop: 8 }}
      />
    </div>
  );
};

export default PriceHistory;
