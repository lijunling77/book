import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Col, Row, Statistic, Table, Typography, Empty, Spin, Alert } from 'antd';
import {
  DatabaseOutlined,
  AlertOutlined,
  ImportOutlined,
  ExportOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AlertStockUnit } from '../../shared/types';
import { CURRENCY_UNIT, ERROR_MESSAGES } from '../../shared/constants';
import { useDashboardStore } from '../stores/dashboardStore';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, loading, error, fetchData } = useDashboardStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const alertColumns: ColumnsType<AlertStockUnit> = [
    {
      title: '封面',
      dataIndex: 'thumbnailPath',
      key: 'thumbnail',
      width: 60,
      render: (path: string | null) =>
        path ? (
          <img src={path} alt="封面" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#999',
            }}
          >
            无图
          </div>
        ),
    },
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '版本', dataIndex: 'editionName', key: 'editionName' },
    {
      title: '当前库存',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (val: number) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{val}</span>
      ),
    },
    { title: '预警阈值', dataIndex: 'alertThreshold', key: 'alertThreshold' },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  const d = data ?? {
    totalStockQuantity: 0,
    alertStockUnitCount: 0,
    todayInboundQuantity: 0,
    todayInboundAmount: 0,
    todayOutboundQuantity: 0,
    todayOutboundAmount: 0,
    monthlyProfit: 0,
    alertStockUnits: [],
  };

  return (
    <div>
      <Typography.Title level={4}>仪表盘</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总库存量"
              value={d.totalStockQuantity}
              prefix={<DatabaseOutlined />}
              suffix="册"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="预警库存单元"
              value={d.alertStockUnitCount}
              prefix={<AlertOutlined />}
              valueStyle={d.alertStockUnitCount > 0 ? { color: '#ff4d4f' } : undefined}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日入库数量"
              value={d.todayInboundQuantity}
              prefix={<ImportOutlined />}
              suffix="册"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日入库金额"
              value={d.todayInboundAmount}
              prefix={<DollarOutlined />}
              precision={2}
              suffix={CURRENCY_UNIT}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日出库数量"
              value={d.todayOutboundQuantity}
              prefix={<ExportOutlined />}
              suffix="册"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日出库金额"
              value={d.todayOutboundAmount}
              prefix={<DollarOutlined />}
              precision={2}
              suffix={CURRENCY_UNIT}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="本月利润"
              value={d.monthlyProfit}
              prefix={<DollarOutlined />}
              precision={2}
              suffix={CURRENCY_UNIT}
              valueStyle={d.monthlyProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Typography.Title level={5} style={{ marginTop: 24 }}>
        库存预警列表
      </Typography.Title>

      {d.alertStockUnits.length === 0 ? (
        <Empty description={ERROR_MESSAGES.NO_STOCK_ALERT} />
      ) : (
        <Table
          columns={alertColumns}
          dataSource={d.alertStockUnits}
          rowKey={(record) => `${record.bookId}-${record.editionId}`}
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/stock?bookId=${record.bookId}&editionId=${record.editionId}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}
    </div>
  );
};

export default Dashboard;
