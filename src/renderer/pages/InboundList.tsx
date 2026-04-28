import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, Typography, Popconfirm, message, Alert, DatePicker, Select } from 'antd';
import { PlusOutlined, UnorderedListOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { InboundRecord, InboundFilter, Book } from '../../shared/types';
import { inboundApi, bookApi } from '../utils/ipc';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, CURRENCY_UNIT } from '../../shared/constants';
import InboundForm from '../components/InboundForm';
import BatchInboundForm from '../components/BatchInboundForm';

const { RangePicker } = DatePicker;

const InboundList: React.FC = () => {
  const [records, setRecords] = useState<InboundRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InboundRecord | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [filterBookId, setFilterBookId] = useState<string | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const filterBookIdRef = React.useRef(filterBookId);
  const filterDateRangeRef = React.useRef(filterDateRange);
  filterBookIdRef.current = filterBookId;
  filterDateRangeRef.current = filterDateRange;

  const fetchRecords = useCallback(async (p?: number, ps?: number) => {
    setLoading(true); setError(null);
    try {
      const filter: InboundFilter = { page: p ?? page, pageSize: ps ?? pageSize };
      if (filterBookIdRef.current) filter.bookId = filterBookIdRef.current;
      if (filterDateRangeRef.current) filter.dateRange = { startDate: filterDateRangeRef.current[0].format('YYYY-MM-DD'), endDate: filterDateRangeRef.current[1].format('YYYY-MM-DD') };
      const result = await inboundApi.list(filter);
      setRecords(result.data);
      setTotal(result.total);
    } catch (err) { setError(err instanceof Error ? err.message : '获取入库记录失败'); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { bookApi.list({ page: 1, pageSize: 1000 }).then((r) => setBooks(r.data)).catch(() => {}); }, []);

  const handleDelete = async (id: string) => { try { await inboundApi.delete(id); message.success('入库记录删除成功'); fetchRecords(); } catch (err) { message.error(err instanceof Error ? err.message : '删除失败'); } };

  const columns: ColumnsType<InboundRecord & { bookTitle?: string }> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle', render: (val: string | undefined, record) => val || record.bookId, sorter: (a, b) => ((a as any).bookTitle || '').localeCompare((b as any).bookTitle || '') },
    { title: '入库日期', dataIndex: 'inboundDate', key: 'inboundDate', render: (val: string) => val ?? '-', sorter: (a, b) => (a.inboundDate || '').localeCompare(b.inboundDate || '') },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', sorter: (a, b) => a.quantity - b.quantity },
    { title: `买入价格（${CURRENCY_UNIT}）`, dataIndex: 'purchasePrice', key: 'purchasePrice', render: (val: number) => val?.toFixed(2) ?? '-', sorter: (a, b) => a.purchasePrice - b.purchasePrice },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier', render: (v: string | null) => v ?? '-' },
    { title: '操作', key: 'action', width: 160, render: (_: unknown, record: InboundRecord) => (<Space><a onClick={() => { setEditingRecord(record); setFormOpen(true); }}>编辑</a><Popconfirm title="确认删除" description="删除入库记录将减少对应库存数量，确定要删除吗？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消"><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm></Space>) },
  ];

  return (
    <div>
      <Typography.Title level={4}>入库管理</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="按书籍筛选" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} value={filterBookId} onChange={(v) => { setFilterBookId(v); }} options={books.map((b) => ({ value: b.id, label: b.title }))} />
        <RangePicker value={filterDateRange} onChange={(dates) => { setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null); }} />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); fetchRecords(1); }}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setFilterBookId(undefined); setFilterDateRange(null); filterBookIdRef.current = undefined; filterDateRangeRef.current = null; setPage(1); fetchRecords(1); }}>重置</Button>
      </Space>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button icon={<UnorderedListOutlined />} onClick={() => setBatchFormOpen(true)}>批量入库</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); setFormOpen(true); }}>新增入库</Button>
      </div>
      <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); fetchRecords(p, ps); } }} />
      <InboundForm open={formOpen} record={editingRecord} onClose={() => setFormOpen(false)} onSuccess={() => fetchRecords()} />
      <BatchInboundForm open={batchFormOpen} onClose={() => setBatchFormOpen(false)} onSuccess={() => fetchRecords()} />
    </div>
  );
};

export default InboundList;
