import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (open) {
      if (book) {
        form.setFieldsValue({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          category: book.category,
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
      if (isEdit && book) {
        const updateData: UpdateBookInput = {
          title: values.title,
          author: values.author,
          category: values.category,
          description: values.description || null,
        };
        await bookApi.update(book.id, updateData);
        message.success('书籍更新成功');
      } else {
        const createData: CreateBookInput = {
          title: values.title,
          author: values.author,
          isbn: values.isbn,
          category: values.category,
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
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑书籍' : '新增书籍'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
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
        <Form.Item
          name="author"
          label="作者"
          rules={[{ required: true, message: '请输入作者' }]}
        >
          <Input placeholder="请输入作者" />
        </Form.Item>
        <Form.Item
          name="isbn"
          label="ISBN"
          rules={[{ required: true, message: '请输入ISBN' }]}
        >
          <Input placeholder="请输入ISBN" disabled={isEdit} />
        </Form.Item>
        <Form.Item
          name="category"
          label="分类"
          rules={[{ required: true, message: '请输入分类' }]}
        >
          <Input placeholder="请输入分类" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={3} placeholder="请输入描述（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BookForm;
