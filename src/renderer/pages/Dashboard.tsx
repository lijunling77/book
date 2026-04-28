import React, { useEffect } from 'react';
import { Card, Col, Row, Statistic, Typography, Spin, Alert } from 'antd';
import { DatabaseOutlined, ImportOutlined, ExportOutlined, DollarOutlined } from '@ant-design/icons';
import { CURRENCY_UNIT } from '../../shared/constants';
import { useDashboardStore } from '../stores/dashboardStore';

const Dashboard: React.FC = () => {
  const { data, loading, error, fetchData } = useDashboardStore();

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;

  const d = data ?? { totalStockQuantity: 0, todayInboundQuantity: 0, todayInboundAmount: 0, todayOutboundQuantity: 0, todayOutboundAmount: 0, monthlyProfit: 0 };

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
    </div>
  );
};

export default Dashboard;
