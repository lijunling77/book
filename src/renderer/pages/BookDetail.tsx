import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Descriptions,
  Table,
  Button,
  Space,
  Popconfirm,
  Spin,
  message,
  Alert,
  Card,
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Edition } from '../../shared/types';
import { editionApi, imageApi } from '../utils/ipc';
import { useBookStore } from '../stores/bookStore';
import EditionForm from '../components/EditionForm';

const BookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentBook, currentBookLoading, error, fetchBookById } = useBookStore();

  const [editionFormOpen, setEditionFormOpen] = useState(false);
  const [editingEdition, setEditingEdition] = useState<Edition | null>(null);
  const [bookCover, setBookCover] = useState<string | null>(null);
  const [editionCovers, setEditionCovers] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (id) {
      fetchBookById(id);
    }
  }, [id, fetchBookById]);

  useEffect(() => {
    if (currentBook) {
      imageApi.get('book', currentBook.id).then(setBookCover).catch(() => setBookCover(null));

      const loadEditionCovers = async () => {
        const map: Record<string, string | null> = {};
        await Promise.all(
          currentBook.editions.map(async (e) => {
            try {
              map[e.id] = await imageApi.thumbnail('edition', e.id);
            } catch {
              map[e.id] = null;
            }
          })
        );
        setEditionCovers(map);
      };
      loadEditionCovers();
    }
  }, [currentBook]);

  const handleDeleteEdition = async (editionId: string) => {
    try {
      await editionApi.delete(editionId);
      message.success('版本删除成功');
      if (id) fetchBookById(id);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleEditEdition = (edition: Edition) => {
    setEditingEdition(edition);
    setEditionFormOpen(true);
  };

  const handleAddEdition = () => {
    setEditingEdition(null);
    setEditionFormOpen(true);
  };

  const renderCover = (src: string | null) => {
    if (src) {
      return (
        <img
          src={src}
          alt="封面"
          style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
        />
      );
    }
    return (
      <div
        style={{
          width: 40,
          height: 40,
          background: '#f0f0f0',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#999',
        }}
      >
        无图
      </div>
    );
  };

  const editionColumns: ColumnsType<Edition> = [
    {
      title: '封面',
      key: 'cover',
      width: 60,
      render: (_: unknown, record: Edition) => {
        const cover = editionCovers[record.id] ?? bookCover;
        return renderCover(cover);
      },
    },
    { title: '版本名称', dataIndex: 'name', key: 'name' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Edition) => (
        <Space>
          <a onClick={() => handleEditEdition(record)}>编辑</a>
          <Popconfirm
            title="确认删除"
            description={`确定要删除版本"${record.name}"吗？`}
            onConfirm={() => handleDeleteEdition(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (currentBookLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentBook) {
    return <Alert message="书籍不存在" type="error" />;
  }

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/books')}
        style={{ marginBottom: 16 }}
      >
        返回列表
      </Button>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            {bookCover ? (
              <img
                src={bookCover}
                alt="封面"
                style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 8 }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 160,
                  background: '#f0f0f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                }}
              >
                暂无封面
              </div>
            )}
          </div>
          <Descriptions column={2} style={{ flex: 1 }}>
            <Descriptions.Item label="书名">{currentBook.title}</Descriptions.Item>
            <Descriptions.Item label="作者">{currentBook.author}</Descriptions.Item>
            <Descriptions.Item label="ISBN">{currentBook.isbn}</Descriptions.Item>
            <Descriptions.Item label="分类">{currentBook.category}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>
              {currentBook.description || '无'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          版本列表
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEdition}>
          新增版本
        </Button>
      </div>

      <Table
        columns={editionColumns}
        dataSource={currentBook.editions}
        rowKey="id"
        pagination={false}
      />

      {id && (
        <EditionForm
          open={editionFormOpen}
          bookId={id}
          edition={editingEdition}
          onClose={() => setEditionFormOpen(false)}
          onSuccess={() => fetchBookById(id)}
        />
      )}
    </div>
  );
};

export default BookDetail;
