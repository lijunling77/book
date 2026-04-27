import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, message } from 'antd';
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
          editionId: values.editionId,
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
          <Select
            placeholder="请选择书籍"
            showSearch
            optionFilterProp="label"
            disabled={isEdit}
            onChange={handleBookChange}
            options={books.map((b) => ({ value: b.id, label: `${b.title} (${b.isbn})` }))}
          />
        </Form.Item>
        <Form.Item
          name="editionId"
          label="版本"
          rules={[{ required: true, message: '请选择版本' }]}
        >
          <Select
            placeholder={selectedBookId ? '请选择版本' : '请先选择书籍'}
            disabled={isEdit || !selectedBookId}
            options={editions.map((e) => ({ value: e.id, label: e.name }))}
          />
        </Form.Item>
        <Form.Item
          name="locationId"
          label="目标位置"
          rules={[{ required: true, message: '请选择位置' }]}
        >
          <Select
            placeholder="请选择位置"
            showSearch
            optionFilterProp="label"
            options={locations.map((l) => ({
              value: l.id,
              label: `${l.warehouse} - ${l.shelf} - ${l.layer}`,
            }))}
          />
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
  );
};

export default InboundForm;
