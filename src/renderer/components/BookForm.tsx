import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, AutoComplete, message } from 'antd';
import type { Book, CreateBookInput, UpdateBookInput } from '../../shared/types';
import { bookApi, locationDictApi } from '../utils/ipc';

interface BookFormProps {
  open: boolean;
  book?: Book | null;
  onClose: () => void;
  onSuccess: () => void;
}

const BookForm: React.FC<BookFormProps> = ({ open, book, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!book;
  const [submitting, setSubmitting] = useState(false);
  const [locationOptions, setLocationOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (open) {
      locationDictApi.list().then((locations) => {
        setLocationOptions(locations.map((loc) => ({ value: loc.name, label: loc.name })));
      }).catch(() => {
        // silently ignore - user can still type freely
      });

      if (book) {
        form.setFieldsValue({
          title: book.title,
          author: book.author ?? '',
          description: book.description ?? '',
          location: book.location ?? '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, book, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (isEdit && book) {
        const updateData: UpdateBookInput = {
          title: values.title,
          author: values.author || null,
          description: values.description || null,
          location: values.location || null,
        };
        await bookApi.update(book.id, updateData);
        message.success('书籍更新成功');
      } else {
        const createData: CreateBookInput = {
          title: values.title,
          author: values.author || null,
          description: values.description || null,
          location: values.location || null,
        };
        await bookApi.create(createData);
        message.success('书籍创建成功');
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑书籍' : '新增书籍'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="确定"
      confirmLoading={submitting}
      width={580}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="书名"
          rules={[{ required: true, message: '请输入书名' }]}
        >
          <Input placeholder="请输入书名" />
        </Form.Item>
        <Form.Item name="author" label="作者">
          <Input placeholder="请输入作者（可选）" />
        </Form.Item>
        <Form.Item name="location" label="存放位置">
          <AutoComplete
            placeholder="选择或输入位置（可选），如 A架3层"
            options={locationOptions}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="请输入描述（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BookForm;
