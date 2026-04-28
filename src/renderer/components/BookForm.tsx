import React, { useEffect, useState, useRef } from 'react';
import { Modal, Form, Input, Button, Space, Tag, Upload, message, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { Book, CreateBookInput, UpdateBookInput } from '../../shared/types';
import { bookApi, editionApi, imageApi } from '../utils/ipc';
import { IMAGE_MAX_SIZE_BYTES, IMAGE_MAX_SIZE_MB, SUPPORTED_IMAGE_EXTENSIONS } from '../../shared/constants';
import ImageUpload from './ImageUpload';

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

  // 新增模式：本地暂存的版本名称列表（还没提交到后端）
  const [pendingEditions, setPendingEditions] = useState<string[]>([]);
  const [newEditionName, setNewEditionName] = useState('');

  // 新增模式：本地暂存的封面图片
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);

  useEffect(() => {
    if (open) {
      setPendingEditions([]);
      setNewEditionName('');
      setPendingImage(null);
      if (book) {
        form.setFieldsValue({
          title: book.title,
          author: book.author ?? '',
          isbn: book.isbn ?? '',
          category: book.category ?? '',
          description: book.description ?? '',
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, book, form]);

  const handleAddPendingEdition = () => {
    const name = newEditionName.trim();
    if (!name) return;
    if (pendingEditions.includes(name)) {
      message.warning('该版本已添加');
      return;
    }
    setPendingEditions((prev) => [...prev, name]);
    setNewEditionName('');
  };

  const handleRemovePendingEdition = (name: string) => {
    setPendingEditions((prev) => prev.filter((n) => n !== name));
  };

  const handleSelectImage = (file: File) => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext as typeof SUPPORTED_IMAGE_EXTENSIONS[number])) {
      message.error('图片格式不支持，请上传 JPG 或 PNG');
      return false;
    }
    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      message.error(`图片大小超过 ${IMAGE_MAX_SIZE_MB}MB`);
      return false;
    }
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
    return false;
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (isEdit && book) {
        // 编辑模式：只更新基本信息
        const updateData: UpdateBookInput = {
          title: values.title,
          author: values.author || null,
          category: values.category || null,
          description: values.description || null,
        };
        await bookApi.update(book.id, updateData);
        message.success('书籍更新成功');
      } else {
        // 新增模式：创建书籍 + 版本 + 图片，一次搞定
        const createData: CreateBookInput = {
          title: values.title,
          author: values.author || null,
          isbn: values.isbn || null,
          category: values.category || null,
          description: values.description || null,
        };
        const created = await bookApi.create(createData);

        // 创建版本
        for (const editionName of pendingEditions) {
          try {
            await editionApi.create({ bookId: created.id, name: editionName });
          } catch {
            // 版本创建失败不阻塞
          }
        }

        // 上传图片
        if (pendingImage) {
          try {
            const arrayBuffer = await pendingImage.file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await imageApi.upload('book', created.id, buffer, pendingImage.file.name);
          } catch {
            // 图片上传失败不阻塞
          }
        }

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
        {/* 编辑模式：显示已有封面的上传组件 */}
        {isEdit && book && (
          <>
            <Divider orientation="left" plain>封面图片</Divider>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
              <ImageUpload entityType="book" entityId={book.id} onSuccess={onSuccess} />
            </div>
            <Divider orientation="left" plain>基本信息</Divider>
          </>
        )}

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
        <Form.Item name="isbn" label="ISBN">
          <Input placeholder="请输入ISBN（可选）" disabled={isEdit} />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Input placeholder="请输入分类（可选）" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="请输入描述（可选）" />
        </Form.Item>

        {/* 新增模式：版本和图片 */}
        {!isEdit && (
          <>
            <Divider orientation="left" plain>版本（可选）</Divider>
            <Space style={{ marginBottom: 8 }}>
              <Input
                placeholder="如：精装、平装、签名本"
                value={newEditionName}
                onChange={(e) => setNewEditionName(e.target.value)}
                onPressEnter={handleAddPendingEdition}
                style={{ width: 260 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleAddPendingEdition}>
                添加
              </Button>
            </Space>
            {pendingEditions.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {pendingEditions.map((name) => (
                  <Tag
                    key={name}
                    color="blue"
                    closable
                    onClose={() => handleRemovePendingEdition(name)}
                    style={{ marginBottom: 4 }}
                  >
                    {name}
                  </Tag>
                ))}
              </div>
            )}

            <Divider orientation="left" plain>封面图片（可选）</Divider>
            {pendingImage ? (
              <Space direction="vertical" align="center" style={{ width: '100%' }}>
                <img
                  src={pendingImage.preview}
                  alt="预览"
                  style={{ width: 100, height: 130, objectFit: 'cover', borderRadius: 4 }}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    URL.revokeObjectURL(pendingImage.preview);
                    setPendingImage(null);
                  }}
                >
                  移除
                </Button>
              </Space>
            ) : (
              <Upload
                accept=".jpg,.jpeg,.png"
                showUploadList={false}
                beforeUpload={handleSelectImage}
              >
                <Button icon={<UploadOutlined />}>选择封面图片</Button>
              </Upload>
            )}
            <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
              支持 JPG/PNG，最大 {IMAGE_MAX_SIZE_MB}MB
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
};

export default BookForm;
