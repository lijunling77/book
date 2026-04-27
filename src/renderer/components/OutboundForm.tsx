import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, message } from 'antd';
import dayjs from 'dayjs';
import type { Book, Edition, Location, OutboundRecord, CreateOutboundInput, UpdateOutboundInput } from '../../shared/types';
import { bookApi, outboundApi, locationApi } from '../utils/ipc';

interface OutboundFormProps {
  open: boolean;
  record?: OutboundRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

const OutboundForm: React.FC<OutboundFormProps> = ({ open, record, onClose, onSuccess }) => {
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
          outboundDate: record.outboundDate ? dayjs(record.outboundDate) : undefined,
          quantity: record.quantity,
          sellingPrice: record.sellingPrice,
          buyer: record.buyer ?? '',
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
      setLocations(await locationApi.list());
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
      const dateStr = values.outboundDate ? values.outboundDate.format('YYYY-MM-DD') : '';

      if (isEdit && record) {
        const updateData: UpdateOutboundInput = {
          locationId: values.locationId,
          outboundDate: dateStr,
          quantity: values.quantity,
          sellingPrice: values.sellingPrice,
          buyer: values.buyer || null,
        };
        await outboundApi.update(record.id, updateData);
        message.success('出库记录更新成功');
      } else {
        const createData: CreateOutboundInput = {
          bookId: values.bookId,
          editionId: values.editionId,
          locationId: values.locationId,
          outboundDate: dateStr,
          quantity: values.quantity,
          sellingPrice: values.sellingPrice,
          buyer: values.buyer || null,
        };
        await outboundApi.create(createData);
        message.success('出库记录创建成功');
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
      title={isEdit ? '编辑出库记录' : '新增出库记录'}
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
          label="来源位置"
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
          name="outboundDate"
          label="出库日期"
          rules={[{ required: true, message: '请选择出库日期' }]}
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
          name="sellingPrice"
          label="售出价格（元）"
          rules={[
            { required: true, message: '请输入售出价格' },
            { type: 'number', min: 0, message: '价格不能为负' },
          ]}
        >
          <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} placeholder="请输入售出价格" />
        </Form.Item>
        <Form.Item name="buyer" label="买家">
          <Input placeholder="请输入买家（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default OutboundForm;
