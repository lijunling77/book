import React, { useState, useEffect } from 'react';
import { Typography, Table, Card, Statistic, Row, Col, Alert, Spin, Empty } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { profitApi } from '../utils/ipc';
import { CURRENCY_UNIT } from '../../shared/constants';

interface MonthlyProfit {
  month: string;
  totalPurchaseCost: number;
  totalSalesRevenue: number;
  netProfit: number;
}

const formatAmount = (val: number): string => `¥${val.toFixed(2)}`;

const ProfitReport: React.FC = () => {
  const [data, setData] = useState<MonthlyProfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    profitApi.monthly()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : '获取利润数据失败'))
      .finally(() => setLoading(false));
  }, []);

  // 计算总计
  const totalCost = data.reduce((sum, d) => sum + d.totalPurchaseCost, 0);
  const totalRevenue = data.reduce((sum, d) => sum + d.totalSalesRevenue, 0);
  const totalProfit = totalRevenue - totalCost;

  const columns: ColumnsType<MonthlyProfit> = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 120,
      render: (val: string) => val || '-',
    },
    {
      title: '采购成本',
      dataIndex: 'totalPurchaseCost',
      key: 'totalPurchaseCost',
      render: (val: number) => formatAmount(val),
      sorter: (a, b) => a.totalPurchaseCost - b.totalPurchaseCost,
    },
    {
      title: '销售收入',
      dataIndex: 'totalSalesRevenue',
      key: 'totalSalesRevenue',
      render: (val: number) => formatAmount(val),
      sorter: (a, b) => a.totalSalesRevenue - b.totalSalesRevenue,
    },
    {
      title: '净利润',
      dataIndex: 'netProfit',
      key: 'netProfit',
      render: (val: number) => (
        <span style={{ color: val >= 0 ? '#3f8600' : '#cf1322', fontWeight: 'bold' }}>
          {formatAmount(val)}
        </span>
      ),
      sorter: (a, b) => a.netProfit - b.netProfit,
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>利润统计（按月）</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="总采购成本"
                  value={totalCost}
                  prefix={<DollarOutlined />}
                  precision={2}
                  suffix={CURRENCY_UNIT}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="总销售收入"
                  value={totalRevenue}
                  prefix={<DollarOutlined />}
                  precision={2}
                  suffix={CURRENCY_UNIT}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="总净利润"
                  value={totalProfit}
                  prefix={<DollarOutlined />}
                  precision={2}
                  suffix={CURRENCY_UNIT}
                  valueStyle={totalProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>

          {data.length === 0 ? (
            <Empty description="暂无利润数据" />
          ) : (
            <Table
              columns={columns}
              dataSource={data}
              rowKey="month"
              pagination={false}
            />
          )}
        </>
      )}
    </div>
  );
};

export default ProfitReport;
