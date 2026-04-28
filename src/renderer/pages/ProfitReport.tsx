import React, { useState, useEffect } from 'react';
import { Typography, Select, Space, DatePicker, Card, Statistic, Row, Col, Alert, Spin, Empty } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, ProfitDetail, DateRange } from '../../shared/types';
import { bookApi, profitApi } from '../utils/ipc';
import { CURRENCY_UNIT } from '../../shared/constants';

const { RangePicker } = DatePicker;

const ProfitReport: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [profit, setProfit] = useState<ProfitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { bookApi.list({ page: 1, pageSize: 1000 }).then((r) => setBooks(r.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedBookId) { setProfit(null); return; }
    setLoading(true); setError(null);
    const dr: DateRange | undefined = dateRange ? { startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') } : undefined;
    profitApi.byBook(selectedBookId, dr)
      .then(setProfit)
      .catch((err) => setError(err instanceof Error ? err.message : '获取利润数据失败'))
      .finally(() => setLoading(false));
  }, [selectedBookId, dateRange]);

  return (
    <div>
      <Typography.Title level={4}>利润统计</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="选择书籍" allowClear showSearch optionFilterProp="label" style={{ width: 240 }} value={selectedBookId} onChange={setSelectedBookId} options={books.map((b) => ({ value: b.id, label: b.title }))} />
        <RangePicker value={dateRange} onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />
      </Space>
      {!selectedBookId ? <Empty description="请选择书籍以查看利润统计" /> : loading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div> : profit ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}><Card><Statistic title="总采购成本" value={profit.totalPurchaseCost} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card></Col>
          <Col xs={24} sm={8}><Card><Statistic title="总销售收入" value={profit.totalSalesRevenue} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} /></Card></Col>
          <Col xs={24} sm={8}><Card><Statistic title="净利润" value={profit.netProfit} prefix={<DollarOutlined />} precision={2} suffix={CURRENCY_UNIT} valueStyle={profit.netProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }} /></Card></Col>
        </Row>
      ) : null}
    </div>
  );
};

export default ProfitReport;
