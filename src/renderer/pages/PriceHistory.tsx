import React, { useEffect, useState } from 'react';
import { Typography, Select, Space, Table, Card, Statistic, Row, Col, Alert, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Book, PurchasePriceHistory, SellingPriceHistory, PriceStats } from '../../shared/types';
import { bookApi, priceApi } from '../utils/ipc';
import { CURRENCY_UNIT, NO_DATA_TEXT } from '../../shared/constants';
import { formatPriceValue, formatDate } from '../utils/format';

const PriceHistory: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();
  const [purchaseHistory, setPurchaseHistory] = useState<PurchasePriceHistory[]>([]);
  const [sellingHistory, setSellingHistory] = useState<SellingPriceHistory[]>([]);
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { bookApi.list({ page: 1, pageSize: 1000 }).then((r) => setBooks(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedBookId) {
      setLoading(true); setError(null);
      Promise.all([priceApi.purchaseHistory(selectedBookId), priceApi.sellingHistory(selectedBookId), priceApi.stats(selectedBookId)])
        .then(([ph, sh, st]) => { setPurchaseHistory(ph); setSellingHistory(sh); setStats(st); })
        .catch((err) => setError(err instanceof Error ? err.message : '获取价格历史失败'))
        .finally(() => setLoading(false));
    } else { setPurchaseHistory([]); setSellingHistory([]); setStats(null); }
  }, [selectedBookId]);

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

  const priceDisplay = (val: number | null) => val !== null && val !== undefined ? `${formatPriceValue(val)} ${CURRENCY_UNIT}` : NO_DATA_TEXT;

  return (
    <div>
      <Typography.Title level={4}>价格历史</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="选择书籍" allowClear showSearch optionFilterProp="label" style={{ width: 240 }} value={selectedBookId} onChange={setSelectedBookId} options={books.map((b) => ({ value: b.id, label: b.title }))} />
      </Space>
      {!selectedBookId ? <Empty description="请选择书籍以查看价格历史" /> : loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : (
        <>
          {stats && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="平均买入价格" value={priceDisplay(stats.averagePurchasePrice)} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="平均售出价格" value={priceDisplay(stats.averageSellingPrice)} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="最近买入价格" value={priceDisplay(stats.latestPurchasePrice)} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="最近售出价格" value={priceDisplay(stats.latestSellingPrice)} /></Card></Col>
            </Row>
          )}
          <Typography.Title level={5}>买入价格历史</Typography.Title>
          <Table columns={purchaseColumns} dataSource={purchaseHistory} rowKey="inboundRecordId" pagination={false} locale={{ emptyText: '暂无买入记录' }} style={{ marginBottom: 24 }} />
          <Typography.Title level={5}>售出价格历史</Typography.Title>
          <Table columns={sellingColumns} dataSource={sellingHistory} rowKey="outboundRecordId" pagination={false} locale={{ emptyText: '暂无售出记录' }} />
        </>
      )}
    </div>
  );
};

export default PriceHistory;
