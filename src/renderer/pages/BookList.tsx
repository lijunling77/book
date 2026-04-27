import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Space, Typography, Popconfirm, message, Alert } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Book } from '../../shared/types';
import { bookApi, imageApi } from '../utils/ipc';
import { useBookStore } from '../stores/bookStore';
import BookForm from '../components/BookForm';

const BookList: React.FC = () => {
  const navigate = useNavigate();
  const { books, total, page, pageSize, loading, error, searchKeyword, fetchBooks, searchBooks, setPage } =
    useBookStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});

  const loadThumbnails = useCallback(async (bookList: Book[]) => {
    const map: Record<string, string | null> = {};
    await Promise.all(
      bookList.map(async (b) => {
        try {
          map[b.id] = await imageApi.thumbnail('book', b.id);
        } catch {
          map[b.id] = null;
        }
      })
    );
    setThumbnails(map);
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    if (books.length > 0) {
      loadThumbnails(books);
    }
  }, [books, loadThumbnails]);

  const handleSearch = (value: string) => {
    searchBooks(value);
  };

  const handleDelete = async (id: string) => {
    try {
      await bookApi.delete(id);
      message.success('书籍删除成功');
      fetchBooks();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingBook(null);
    setFormOpen(true);
  };

  const columns: ColumnsType<Book> = [
    {
      title: '封面',
      key: 'thumbnail',
      width: 60,
      render: (_: unknown, record: Book) => {
        const src = thumbnails[record.id];
        return src ? (
          <img src={src} alt="封面" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
        ) : (
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
      },
    },
    {
      title: '书名',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Book) => (
        <a onClick={() => navigate(`/books/${record.id}`)}>{text}</a>
      ),
    },
    { title: '作者', dataIndex: 'author', key: 'author' },
    { title: 'ISBN', dataIndex: 'isbn', key: 'isbn' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: unknown, record: Book) => (
        <Space>
          <a onClick={() => handleEdit(record)}>编辑</a>
          <Popconfirm
            title="确认删除"
            description={`确定要删除《${record.title}》吗？`}
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>书籍管理</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索书名、作者、ISBN、分类"
          allowClear
          enterButton={<SearchOutlined />}
          defaultValue={searchKeyword}
          onSearch={handleSearch}
          style={{ width: 360 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增书籍
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={books}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p, ps);
            fetchBooks({ page: p, pageSize: ps });
          },
        }}
      />

      <BookForm
        open={formOpen}
        book={editingBook}
        onClose={() => setFormOpen(false)}
        onSuccess={() => fetchBooks()}
      />
    </div>
  );
};

export default BookList;
