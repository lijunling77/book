import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
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
          editionId: values.editionId || null,
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
    <>
      <Modal
        title={isEdit ? '编辑出库记录' : '新增出库记录'}
        open={open}
        onOk={handleOk}
        onCancel={onClose}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="书籍" required style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="bookId"
                noStyle
                rules={[{ required: true, message: '请选择书籍' }]}
              >
                <Select
                  placeholder="请选择书籍"
                  showSearch
                  optionFilterProp="label"
                  disabled={isEdit}
                  onChange={handleBookChange}
                  style={{ flex: 1 }}
                  options={books.map((b) => ({ value: b.id, label: `${b.title}${b.isbn ? ` (${b.isbn})` : ''}` }))}
                />
              </Form.Item>
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
          <Form.Item label="来源位置" required style={{ marginBottom: 0 }}>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="locationId"
                noStyle
                rules={[{ required: true, message: '请选择位置' }]}
              >
                <Select
                  placeholder="请选择位置"
                  showSearch
                  optionFilterProp="label"
                  style={{ flex: 1 }}
                  options={locations.map((l) => ({
                    value: l.id,
                    label: `${l.warehouse} - ${l.shelf} - ${l.layer}`,
                  }))}
                />
              </Form.Item>
              <Button icon={<PlusOutlined />} onClick={() => setQuickLocationOpen(true)}>
                快速新增
              </Button>
            </Space.Compact>
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

export default OutboundForm;
