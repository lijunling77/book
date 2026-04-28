import React, { useEffect } from 'react';
import { Card, Col, Row, Statistic, Typography, Spin, Alert, Table } from 'antd';
import { DatabaseOutlined, ImportOutlined, ExportOutlined, DollarOutlined } from '@ant-design/icons';
import { CURRENCY_UNIT } from '../../shared/constants';
import { useDashboardStore } from '../stores/dashboardStore';
import type { RecentInboundItem, RecentOutboundItem } from '../../shared/types';

const Dashboard: React.FC = () => {
  const { data, loading, error, fetchData } = useDashboardStore();

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const d = data ?? { totalStockQuantity: 0, todayInboundQuantity: 0, todayInboundAmount: 0, todayOutboundQuantity: 0, todayOutboundAmount: 0, monthlyProfit: 0, recentInbound: [], recentOutbound: [] };

  const inboundColumns = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', ellipsis: true },
    { title: '入库日期', dataIndex: 'inboundDate', key: 'inboundDate', width: 110 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 70 },
    { title: `买入价格（${CURRENCY_UNIT}）`, dataIndex: 'purchasePrice', key: 'purchasePrice', width: 120, render: (v: number) => v?.toFixed(2) ?? '-' },
    { title: '位置', dataIndex: 'location', key: 'location', width: 100, render: (v: string | null) => v ?? '-' },
  ];

  const outboundColumns = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', ellipsis: true },
    { title: '出库日期', dataIndex: 'outboundDate', key: 'outboundDate', width: 110 },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 70 },
    { title: `售出价格（${CURRENCY_UNIT}）`, dataIndex: 'sellingPrice', key: 'sellingPrice', width: 120, render: (v: number) => v?.toFixed(2) ?? '-' },
    { title: '买家', dataIndex: 'buyer', key: 'buyer', width: 100, render: (v: string | null) => v ?? '-' },
  ];

  return (
    <div>
      <Typography.Title level={4}>仪表盘</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="总库存量" value={d.totalStockQuantity} prefix={<DatabaseOutlined />} suffix="册" /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日入库数量" value={d.todayInboundQuantity} prefix={<ImportOutlined />} suffix="册" /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日入库金额" value={d.todayInboundAmount} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日出库数量" value={d.todayOutboundQuantity} prefix={<ExportOutlined />} suffix="册" /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日出库金额" value={d.todayOutboundAmount} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="本月利润" value={d.monthlyProfit} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} valueStyle={d.monthlyProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="最近入库记录" size="small">
            <Table<RecentInboundItem>
              columns={inboundColumns}
              dataSource={d.recentInbound}
              rowKey={(_, index) => `inbound-${index}`}
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无入库记录' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近出库记录" size="small">
            <Table<RecentOutboundItem>
              columns={outboundColumns}
              dataSource={d.recentOutbound}
              rowKey={(_, index) => `outbound-${index}`}
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无出库记录' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
