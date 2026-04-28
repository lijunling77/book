import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, Edition, Location, InboundRecord, CreateInboundInput, UpdateInboundInput } from '../../shared/types';
import { bookApi, inboundApi, locationApi } from '../utils/ipc';

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
  const [editions, setEditions] = useState<Edition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();

  // Quick-create book
  const [quickBookOpen, setQuickBookOpen] = useState(false);
  const [quickBookTitle, setQuickBookTitle] = useState('');
  const [quickBookLoading, setQuickBookLoading] = useState(false);

  // Quick-create location
  const [quickLocationOpen, setQuickLocationOpen] = useState(false);
  const [quickLocationForm] = Form.useForm();
  const [quickLocationLoading, setQuickLocationLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadBooks();
      loadLocations();
      if (record) {
        form.setFieldsValue({
          bookId: record.bookId,
          editionId: record.editionId,
          locationId: record.locationId,
          inboundDate: record.inboundDate ? dayjs(record.inboundDate) : undefined,
          quantity: record.quantity,
          purchasePrice: record.purchasePrice,
          supplier: record.supplier ?? '',
        });
        setSelectedBookId(record.bookId);
        loadEditions(record.bookId);
      } else {
        form.resetFields();
        setSelectedBookId(undefined);
        setEditions([]);
      }
    }
  }, [open, record, form]);

  const loadBooks = async () => {
    try {
      const result = await bookApi.list({ page: 1, pageSize: 1000 });
      setBooks(result.data);
    } catch {
      // ignore
    }
  };

  const loadLocations = async () => {
    try {
      const locs = await locationApi.list();
      setLocations(locs);
    } catch {
      // ignore
    }
  };

  const loadEditions = async (bookId: string) => {
    try {
      const book = await bookApi.getById(bookId);
      setEditions(book.editions);
    } catch {
      setEditions([]);
    }
  };

  const handleBookChange = (bookId: string) => {
    setSelectedBookId(bookId);
    form.setFieldValue('editionId', undefined);
    loadEditions(bookId);
  };

  const handleQuickCreateBook = async () => {
    const title = quickBookTitle.trim();
    if (!title) {
      message.warning('请输入书名');
      return;
    }
    setQuickBookLoading(true);
    try {
      const created = await bookApi.create({ title });
      message.success('书籍创建成功');
      await loadBooks();
      form.setFieldValue('bookId', created.id);
      handleBookChange(created.id);
      setQuickBookOpen(false);
      setQuickBookTitle('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建书籍失败');
    } finally {
      setQuickBookLoading(false);
    }
  };

  const handleQuickCreateLocation = async () => {
    try {
      const values = await quickLocationForm.validateFields();
      setQuickLocationLoading(true);
      const created = await locationApi.create({
        warehouse: values.warehouse,
        shelf: values.shelf,
        layer: values.layer,
      });
      message.success('位置创建成功');
      await loadLocations();
      form.setFieldValue('locationId', created.id);
      setQuickLocationOpen(false);
      quickLocationForm.resetFields();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setQuickLocationLoading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const dateStr = values.inboundDate ? values.inboundDate.format('YYYY-MM-DD') : '';

      if (isEdit && record) {
        const updateData: UpdateInboundInput = {
          locationId: values.locationId,
          inboundDate: dateStr,
          quantity: values.quantity,
          purchasePrice: values.purchasePrice,
          supplier: values.supplier || null,
        };
        await inboundApi.update(record.id, updateData);
        message.success('入库记录更新成功');
      } else {
        const createData: CreateInboundInput = {
          bookId: values.bookId,
          editionId: values.editionId || null,
          locationId: values.locationId,
          inboundDate: dateStr,
          quantity: values.quantity,
          purchasePrice: values.purchasePrice,
          supplier: values.supplier || null,
        };
        await inboundApi.create(createData);
        message.success('入库记录创建成功');
      }
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  return (
    <>
      <Modal
        title={isEdit ? '编辑入库记录' : '新增入库记录'}
        open={open}
        onOk={handleOk}
        onCancel={onClose}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="bookId"
            label="书籍"
            rules={[{ required: true, message: '请选择书籍' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Select
                placeholder="请选择书籍"
                showSearch
                optionFilterProp="label"
                disabled={isEdit}
                onChange={handleBookChange}
                value={form.getFieldValue('bookId')}
                style={{ flex: 1 }}
                options={books.map((b) => ({ value: b.id, label: `${b.title} (${b.isbn})` }))}
              />
              {!isEdit && (
                <Button icon={<PlusOutlined />} onClick={() => setQuickBookOpen(true)}>
                  快速新增
                </Button>
              )}
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="editionId"
            label="版本"
          >
            <Select
              placeholder={selectedBookId ? '请选择版本（可选）' : '请先选择书籍'}
              disabled={isEdit || !selectedBookId}
              allowClear
              options={editions.map((e) => ({ value: e.id, label: e.name }))}
            />
          </Form.Item>
          <Form.Item
            name="locationId"
            label="目标位置"
            rules={[{ required: true, message: '请选择位置' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Select
                placeholder="请选择位置"
                showSearch
                optionFilterProp="label"
                value={form.getFieldValue('locationId')}
                style={{ flex: 1 }}
                options={locations.map((l) => ({
                  value: l.id,
                  label: `${l.warehouse} - ${l.shelf} - ${l.layer}`,
                }))}
              />
              <Button icon={<PlusOutlined />} onClick={() => setQuickLocationOpen(true)}>
                快速新增
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="inboundDate"
            label="入库日期"
            rules={[{ required: true, message: '请选择入库日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 1, message: '数量必须大于0' },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="请输入数量" />
          </Form.Item>
          <Form.Item
            name="purchasePrice"
            label="买入价格（元）"
            rules={[
              { required: true, message: '请输入买入价格' },
              { type: 'number', min: 0, message: '价格不能为负' },
            ]}
          >
            <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入买入价格" />
          </Form.Item>
          <Form.Item name="supplier" label="供应商">
            <Input placeholder="请输入供应商（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick-create book modal */}
      <Modal
        title="快速新增书籍"
        open={quickBookOpen}
        onOk={handleQuickCreateBook}
        onCancel={() => { setQuickBookOpen(false); setQuickBookTitle(''); }}
        confirmLoading={quickBookLoading}
        width={400}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="书名" required>
            <Input
              placeholder="请输入书名"
              value={quickBookTitle}
              onChange={(e) => setQuickBookTitle(e.target.value)}
              onPressEnter={handleQuickCreateBook}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick-create location modal */}
      <Modal
        title="快速新增位置"
        open={quickLocationOpen}
        onOk={handleQuickCreateLocation}
        onCancel={() => { setQuickLocationOpen(false); quickLocationForm.resetFields(); }}
        confirmLoading={quickLocationLoading}
        width={400}
        destroyOnClose
      >
        <Form form={quickLocationForm} layout="vertical">
          <Form.Item
            name="warehouse"
            label="仓库名称"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input placeholder="请输入仓库名称" />
          </Form.Item>
          <Form.Item
            name="shelf"
            label="书架编号"
            rules={[{ required: true, message: '请输入书架编号' }]}
          >
            <Input placeholder="请输入书架编号" />
          </Form.Item>
          <Form.Item
            name="layer"
            label="层号"
            rules={[{ required: true, message: '请输入层号' }]}
          >
            <Input placeholder="请输入层号" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default InboundForm;
