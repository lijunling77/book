import React, { useState, useEffect } from 'react';
import {
  Typography,
  Select,
  Space,
  DatePicker,
  Card,
  Statistic,
  Row,
  Col,
  Alert,
  Spin,
  Empty,
  Segmented,
} from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, Edition, ProfitDetail, DateRange } from '../../shared/types';
import { bookApi, profitApi } from '../utils/ipc';
import { CURRENCY_UNIT } from '../../shared/constants';

const { RangePicker } = DatePicker;

type ProfitMode = 'stockUnit' | 'book' | 'category';

const ProfitReport: React.FC = () => {
  const [mode, setMode] = useState<ProfitMode>('stockUnit');
  const [books, setBooks] = useState<Book[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();
  const [selectedEditionId, setSelectedEditionId] = useState<string | undefined>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const [profit, setProfit] = useState<ProfitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bookApi.list({ page: 1, pageSize: 1000 }).then((r) => {
      setBooks(r.data);
      const cats = [...new Set(r.data.map((b) => b.category))];
      setCategories(cats);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedBookId) {
      bookApi.getById(selectedBookId).then((b) => {
        setEditions(b.editions);
        setSelectedEditionId(undefined);
      }).catch(() => setEditions([]));
    } else {
      setEditions([]);
      setSelectedEditionId(undefined);
    }
  }, [selectedBookId]);

  const buildDateRange = (): DateRange | undefined => {
    if (!dateRange) return undefined;
    return {
      startDate: dateRange[0].format('YYYY-MM-DD'),
      endDate: dateRange[1].format('YYYY-MM-DD'),
    };
  };

  const fetchProfit = async () => {
    setLoading(true);
    setError(null);
    try {
      const dr = buildDateRange();
      let result: ProfitDetail;
      if (mode === 'stockUnit') {
        if (!selectedBookId || !selectedEditionId) return;
        result = await profitApi.byStockUnit(selectedBookId, selectedEditionId, dr);
      } else if (mode === 'book') {
        if (!selectedBookId) return;
        result = await profitApi.byBook(selectedBookId, dr);
      } else {
        if (!selectedCategory) return;
        result = await profitApi.byCategory(selectedCategory, dr);
      }
      setProfit(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取利润数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setProfit(null);
    const canFetch =
      (mode === 'stockUnit' && selectedBookId && selectedEditionId) ||
      (mode === 'book' && selectedBookId) ||
      (mode === 'category' && selectedCategory);
    if (canFetch) {
      fetchProfit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedBookId, selectedEditionId, selectedCategory, dateRange]);

  const handleModeChange = (val: string | number) => {
    setMode(val as ProfitMode);
    setSelectedBookId(undefined);
    setSelectedEditionId(undefined);
    setSelectedCategory(undefined);
    setProfit(null);
  };

  const canShowResult =
    (mode === 'stockUnit' && selectedBookId && selectedEditionId) ||
    (mode === 'book' && selectedBookId) ||
    (mode === 'category' && selectedCategory);

  return (
    <div>
      <Typography.Title level={4}>利润统计</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
        <Segmented
          options={[
            { label: '按库存单元', value: 'stockUnit' },
            { label: '按书籍', value: 'book' },
            { label: '按分类', value: 'category' },
          ]}
          value={mode}
          onChange={handleModeChange}
        />

        <Space wrap>
          {(mode === 'stockUnit' || mode === 'book') && (
            <Select
              placeholder="选择书籍"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 240 }}
              value={selectedBookId}
              onChange={setSelectedBookId}
              options={books.map((b) => ({ value: b.id, label: `${b.title} (${b.isbn})` }))}
            />
          )}
          {mode === 'stockUnit' && (
            <Select
              placeholder="选择版本"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 200 }}
              value={selectedEditionId}
              onChange={setSelectedEditionId}
              disabled={!selectedBookId}
              options={editions.map((e) => ({ value: e.id, label: e.name }))}
            />
          )}
          {mode === 'category' && (
            <Select
              placeholder="选择分类"
              allowClear
              showSearch
              style={{ width: 200 }}
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categories.map((c) => ({ value: c, label: c }))}
            />
          )}
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
        </Space>
      </Space>

      {!canShowResult ? (
        <Empty description="请选择查询条件以查看利润统计" />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : profit ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="总采购成本"
                value={profit.totalPurchaseCost}
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
                value={profit.totalSalesRevenue}
                prefix={<DollarOutlined />}
                precision={2}
                suffix={CURRENCY_UNIT}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="净利润"
                value={profit.netProfit}
                prefix={<DollarOutlined />}
                precision={2}
                suffix={CURRENCY_UNIT}
                valueStyle={profit.netProfit >= 0 ? { color: '#3f8600' } : { color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>
      ) : null}
    </div>
  );
};

export default ProfitReport;
