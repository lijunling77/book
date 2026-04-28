import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { Book, CreateBookInput, UpdateBookInput } from '../../shared/types';
import { bookApi } from '../utils/ipc';

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

  useEffect(() => {
    if (open) {
      if (book) {
        form.setFieldsValue({
          title: book.title,
          author: book.author ?? '',
          description: book.description ?? '',
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
        };
        await bookApi.update(book.id, updateData);
        message.success('书籍更新成功');
      } else {
        const createData: CreateBookInput = {
          title: values.title,
          author: values.author || null,
          description: values.description || null,
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
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="请输入描述（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BookForm;
