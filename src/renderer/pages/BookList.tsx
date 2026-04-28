import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Typography, Popconfirm, message, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Book } from '../../shared/types';
import { bookApi } from '../utils/ipc';
import { useBookStore } from '../stores/bookStore';
import BookForm from '../components/BookForm';

const BookList: React.FC = () => {
  const { books, total, page, pageSize, loading, error, searchKeyword, fetchBooks, searchBooks, setPage } =
    useBookStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [localKeyword, setLocalKeyword] = useState(searchKeyword);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

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
    { title: '书名', dataIndex: 'title', key: 'title', width: 200, sorter: (a, b) => a.title.localeCompare(b.title) },
    { title: '作者', dataIndex: 'author', key: 'author', width: 120, render: (v: string | null) => v ?? '-', sorter: (a, b) => (a.author || '').localeCompare(b.author || '') },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string | null) => v ?? '-' },
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

      <Space style={{ marginBottom: 16 }} wrap>
        <Input
          placeholder="搜索书名、作者"
          allowClear
          value={localKeyword}
          onChange={(e) => setLocalKeyword(e.target.value)}
          style={{ width: 360 }}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={() => searchBooks(localKeyword)}>查询</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { setLocalKeyword(''); fetchBooks(); }}>重置</Button>
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
