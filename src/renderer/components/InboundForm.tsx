import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, AutoComplete, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, InboundRecord, CreateInboundInput, UpdateInboundInput } from '../../shared/types';
import { bookApi, inboundApi, locationDictApi } from '../utils/ipc';

interface InboundFormProps {
  open: boolean;
  record?: InboundRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

const InboundForm: React.FC<InboundFormProps> = ({ open, record, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!record;
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookTitle, setQuickBookTitle] = useState('');
  const [quickBookAuthor, setQuickBookAuthor] = useState('');
  const [quickBookDesc, setQuickBookDesc] = useState('');
  const [quickBookLoading, setQuickBookLoading] = useState(false);
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      loadBooks();
      locationDictApi.list().then((locs) => {
        setLocationOptions(locs.map((l) => ({ value: l.name, label: l.name })));
      }).catch(() => {});
      if (record) {
        form.setFieldsValue({
          bookId: record.bookId,
          inboundDate: record.inboundDate ? dayjs(record.inboundDate) : undefined,
          quantity: record.quantity,
          purchasePrice: record.purchasePrice,
          supplier: record.supplier ?? '',
          location: '',
        });
        // 加载选中书籍的当前位置
        const book = books.find((b) => b.id === record.bookId);
        if (book) {
          setSelectedBook(book);
          form.setFieldValue('location', book.location ?? '');
        }
      } else {
        form.resetFields();
        form.setFieldValue('inboundDate', dayjs());
        setSelectedBook(null);
      }
    }
  }, [open, record, form]);

  const loadBooks = async () => { try { const r = await bookApi.list({ page: 1, pageSize: 1000 }); setBooks(r.data); } catch {} };

  const handleQuickCreateBook = async () => {
    const title = quickBookTitle.trim();
    if (!title) { message.warning('请输入书名'); return; }
    setQuickBookLoading(true);
    try {
      const created = await bookApi.create({ title, author: quickBookAuthor || null, description: quickBookDesc || null });
      message.success('书籍创建成功');
      await loadBooks();
      form.setFieldValue('bookId', created.id);
      setQuickBookOpen(false);
      setQuickBookTitle('');
      setQuickBookAuthor('');
      setQuickBookDesc('');
    } catch (err) { message.error(err instanceof Error ? err.message : '创建书籍失败'); }
    finally { setQuickBookLoading(false); }
  };

  const handleBookChange = (bookId: string) => {
    const book = books.find((b) => b.id === bookId);
    setSelectedBook(book ?? null);
    if (book) {
      form.setFieldValue('location', book.location ?? '');
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const dateStr = values.inboundDate ? values.inboundDate.format('YYYY-MM-DD') : '';
      const bookId = isEdit && record ? record.bookId : values.bookId;

      // 如果位置有变化，更新书籍位置
      const newLocation = values.location?.trim() || null;
      const currentBook = books.find((b) => b.id === bookId);
      if (currentBook && newLocation !== (currentBook.location ?? null)) {
        await bookApi.update(bookId, { location: newLocation });
      }

      if (isEdit && record) {
        const updateData: UpdateInboundInput = { inboundDate: dateStr, quantity: values.quantity, purchasePrice: values.purchasePrice, supplier: values.supplier || null };
        await inboundApi.update(record.id, updateData);
        message.success('入库记录更新成功');
      } else {
        const createData: CreateInboundInput = { bookId: values.bookId, inboundDate: dateStr, quantity: values.quantity, purchasePrice: values.purchasePrice, supplier: values.supplier || null };
        await inboundApi.create(createData);
        message.success('入库记录创建成功');
      }
      onSuccess();
      onClose();
    } catch (err) { if (err instanceof Error) message.error(err.message); }
  };

  return (
    <>
      <Modal title={isEdit ? '编辑入库记录' : '新增入库记录'} open={open} onOk={handleOk} onCancel={onClose} destroyOnClose width={600}>
        <Form form={form} layout="vertical">
          <Form.Item label="书籍" required style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="bookId" noStyle rules={[{ required: true, message: '请选择书籍' }]}>
                <Select placeholder="请选择书籍" showSearch optionFilterProp="label" disabled={isEdit} onChange={handleBookChange} style={{ flex: 1 }} options={books.map((b) => ({ value: b.id, label: b.title }))} />
              </Form.Item>
              {!isEdit && <Button icon={<PlusOutlined />} onClick={() => setQuickBookOpen(true)}>快速新增</Button>}
            </Space.Compact>
          </Form.Item>
          <Form.Item name="location" label="存放位置">
            <AutoComplete
              placeholder="选择或输入位置（可选）"
              options={locationOptions}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              allowClear
            />
          </Form.Item>
          <Form.Item name="inboundDate" label="入库日期" rules={[{ required: true, message: '请选择入库日期' }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="quantity" label="数量" rules={[{ required: true, message: '请输入数量' }, { type: 'number', min: 1, message: '数量必须大于0' }]}><InputNumber min={1} style={{ width: '100%' }} placeholder="请输入数量" /></Form.Item>
          <Form.Item name="purchasePrice" label="买入价格（元）" rules={[{ required: true, message: '请输入买入价格' }, { type: 'number', min: 0, message: '价格不能为负' }]}><InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入买入价格" /></Form.Item>
          <Form.Item name="supplier" label="供应商"><Input placeholder="请输入供应商（可选）" /></Form.Item>
        </Form>
      </Modal>
      <Modal title="快速新增书籍" open={quickBookOpen} onOk={handleQuickCreateBook} onCancel={() => { setQuickBookOpen(false); setQuickBookTitle(''); setQuickBookAuthor(''); setQuickBookDesc(''); }} confirmLoading={quickBookLoading} width={480} destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="书名" required>
            <Input placeholder="请输入书名" value={quickBookTitle} onChange={(e) => setQuickBookTitle(e.target.value)} />
          </Form.Item>
          <Form.Item label="作者">
            <Input placeholder="请输入作者（可选）" value={quickBookAuthor} onChange={(e) => setQuickBookAuthor(e.target.value)} />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea rows={2} placeholder="请输入描述（可选）" value={quickBookDesc} onChange={(e) => setQuickBookDesc(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default InboundForm;
