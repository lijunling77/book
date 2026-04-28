import React, { useState, useEffect } from 'react';
import { Typography, Table, Card, Statistic, Row, Col, Alert, Spin, Empty, Segmented } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { profitApi } from '../utils/ipc';
import { CURRENCY_UNIT } from '../../shared/constants';

interface ProfitRow {
  period: string;
  inboundQuantity: number;
  outboundQuantity: number;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

const formatAmount = (val: number): string => `¥${val.toFixed(2)}`;

const ProfitReport: React.FC = () => {
  const [mode, setMode] = useState<'monthly' | 'yearly'>('monthly');
  const [data, setData] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetch = mode === 'monthly'
      ? profitApi.monthly().then((rows) => rows.map((r) => ({ ...r, period: r.month })))
      : profitApi.yearly().then((rows) => rows.map((r) => ({ ...r, period: r.year })));

    fetch
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '获取利润数据失败'))
      .finally(() => setLoading(false));
  }, [mode]);

  const totalCost = data.reduce((sum, d) => sum + d.totalPurchaseCost, 0);
  const totalRevenue = data.reduce((sum, d) => sum + d.totalSalesRevenue, 0);
  const totalProfit = totalRevenue - totalCost;

  const columns: ColumnsType<ProfitRow> = [
    { title: mode === 'monthly' ? '月份' : '年份', dataIndex: 'period', key: 'period', width: 120, sorter: (a, b) => a.period.localeCompare(b.period) },
    { title: '入库数量', dataIndex: 'inboundQuantity', key: 'inboundQuantity', sorter: (a, b) => a.inboundQuantity - b.inboundQuantity },
    { title: '出库数量', dataIndex: 'outboundQuantity', key: 'outboundQuantity', sorter: (a, b) => a.outboundQuantity - b.outboundQuantity },
    { title: '采购成本', dataIndex: 'totalPurchaseCost', key: 'totalPurchaseCost', render: formatAmount, sorter: (a, b) => a.totalPurchaseCost - b.totalPurchaseCost },
    { title: '销售收入', dataIndex: 'totalSalesRevenue', key: 'totalSalesRevenue', render: formatAmount, sorter: (a, b) => a.totalSalesRevenue - b.totalSalesRevenue },
    { title: '净利润', dataIndex: 'netProfit', key: 'netProfit', render: (val: number) => <span style={{ color: val >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>{formatAmount(val)}</span>, sorter: (a, b) => a.netProfit - b.netProfit },
  ];

  return (
    <div>
      <Typography.Title level={4}>利润统计</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Segmented
        options={[
          { label: '按月', value: 'monthly' },
          { label: '按年', value: 'yearly' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'monthly' | 'yearly')}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card><Statistic title="总采购成本" value={totalCost} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="总销售收入" value={totalRevenue} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card><Statistic title="总净利润" value={totalProfit} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} valueStyle={totalProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }} /></Card>
            </Col>
          </Row>
          {data.length === 0 ? (
            <Empty description="暂无利润数据" />
          ) : (
            <Table columns={columns} dataSource={data} rowKey="period" pagination={false} />
          )}
        </>
      )}
    </div>
  );
};

export default ProfitReport;
