import React, { useEffect, useState } from 'react';
import { Modal, Input, InputNumber, DatePicker, Select, Button, Space, Table, message, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, CreateInboundInput, BatchResultSummary } from '../../shared/types';
import { bookApi, inboundApi } from '../utils/ipc';

interface BatchInboundFormProps { open: boolean; onClose: () => void; onSuccess: () => void; }
interface InboundRow { key: number; bookId?: string; inboundDate?: dayjs.Dayjs; quantity?: number; purchasePrice?: number; supplier?: string; location?: string; }

const BatchInboundForm: React.FC<BatchInboundFormProps> = ({ open, onClose, onSuccess }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [rows, setRows] = useState<InboundRow[]>([{ key: 1 }]);
  const [nextKey, setNextKey] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BatchResultSummary | null>(null);
  const [unifiedDate, setUnifiedDate] = useState<dayjs.Dayjs | null>(dayjs());

  useEffect(() => { if (open) { loadBooks(); setRows([{ key: 1, inboundDate: dayjs() }]); setNextKey(2); setResult(null); setUnifiedDate(dayjs()); } }, [open]);

  const loadBooks = async () => { try { const r = await bookApi.list({ page: 1, pageSize: 1000 }); setBooks(r.data); } catch {} };

  const updateRow = (key: number, field: string, value: unknown) => {
    setRows((prev) => prev.map((r) => r.key !== key ? r : { ...r, [field]: value }));
  };
  const addRow = () => { setRows((prev) => [...prev, { key: nextKey, inboundDate: unifiedDate ?? undefined }]); setNextKey((k) => k + 1); };
  const removeRow = (key: number) => { setRows((prev) => prev.filter((r) => r.key !== key)); };

  const handleSubmit = async () => {
    const inputs: CreateInboundInput[] = [];
    for (const row of rows) {
      if (!row.bookId || !row.inboundDate || !row.quantity || row.purchasePrice == null) { message.warning('请填写所有必填字段'); return; }
      inputs.push({ bookId: row.bookId, inboundDate: row.inboundDate.format('YYYY-MM-DD'), quantity: row.quantity, purchasePrice: row.purchasePrice, supplier: row.supplier || null, location: row.location?.trim() || null });
    }
    setSubmitting(true);
    try {
      const summary = await inboundApi.batchCreate(inputs);
      setResult(summary);
      if (summary.failureCount === 0) { message.success(`批量入库成功，共 ${summary.successCount} 条`); onSuccess(); }
      else { message.warning(`成功 ${summary.successCount} 条，失败 ${summary.failureCount} 条`); }
    } catch (err) { message.error(err instanceof Error ? err.message : '批量入库失败'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal title="批量入库" open={open} onCancel={onClose} width={900} footer={result ? <Button onClick={onClose}>关闭</Button> : <Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={submitting} onClick={handleSubmit}>提交</Button></Space>} destroyOnClose>
      {result ? (
        <div>
          <Alert type={result.failureCount === 0 ? 'success' : 'warning'} message={`处理完成：成功 ${result.successCount} 条，失败 ${result.failureCount} 条`} style={{ marginBottom: 16 }} />
          {result.failures.length > 0 && <Table size="small" dataSource={result.failures} rowKey="index" pagination={false} columns={[{ title: '序号', dataIndex: 'index', render: (v: number) => v + 1 }, { title: '失败原因', dataIndex: 'reason' }]} />}
        </div>
      ) : (
        <div>
          <Space style={{ marginBottom: 16 }} align="center">
            <span>统一日期：</span>
            <DatePicker
              value={unifiedDate}
              onChange={(date) => {
                setUnifiedDate(date);
                if (date) {
                  setRows((prev) => prev.map((r) => ({ ...r, inboundDate: date })));
                }
              }}
              placeholder="选择统一日期"
              allowClear
            />
          </Space>
          {rows.map((row) => (
            <Space key={row.key} style={{ display: 'flex', marginBottom: 8 }} align="start" wrap>
              <Select placeholder="书籍" style={{ width: 180 }} showSearch optionFilterProp="label" value={row.bookId} onChange={(v) => updateRow(row.key, 'bookId', v)} options={books.map((b) => ({ value: b.id, label: b.title }))} />
              <DatePicker placeholder="日期" value={row.inboundDate} onChange={(v) => updateRow(row.key, 'inboundDate', v)} />
              <InputNumber placeholder="数量" min={1} style={{ width: 80 }} value={row.quantity} onChange={(v) => updateRow(row.key, 'quantity', v)} />
              <InputNumber placeholder="价格" min={0} step={0.01} precision={2} style={{ width: 100 }} value={row.purchasePrice} onChange={(v) => updateRow(row.key, 'purchasePrice', v)} />
              <Input placeholder="供应商" style={{ width: 100 }} value={row.supplier} onChange={(e) => updateRow(row.key, 'supplier', e.target.value)} />
              <Input placeholder="位置" style={{ width: 100 }} value={row.location} onChange={(e) => updateRow(row.key, 'location', e.target.value)} />
              {rows.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(row.key)} />}
            </Space>
          ))}
          <Button type="dashed" onClick={addRow} icon={<PlusOutlined />} style={{ width: '100%' }}>添加一行</Button>
        </div>
      )}
    </Modal>
  );
};

export default BatchInboundForm;
