import { create } from 'zustand';
import type { Book, PaginationInput, SearchBookQuery } from '../../shared/types';
import { bookApi } from '../utils/ipc';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../shared/constants';

interface BookState {
  books: Book[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  searchKeyword: string;

  fetchBooks: (pagination?: PaginationInput) => Promise<void>;
  searchBooks: (keyword: string) => Promise<void>;
  setPage: (page: number, pageSize: number) => void;
  reset: () => void;
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  total: 0,
  page: DEFAULT_PAGE,
  pageSize: DEFAULT_PAGE_SIZE,
  loading: false,
  error: null,
  searchKeyword: '',

  fetchBooks: async (pagination?: PaginationInput) => {
    set({ loading: true, error: null });
    try {
      const { page, pageSize } = get();
      const p = pagination ?? { page, pageSize };
      const result = await bookApi.list(p);
      set({
        books: result.data,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '获取书籍列表失败' });
    }
  },

  searchBooks: async (keyword: string) => {
    set({ loading: true, error: null, searchKeyword: keyword });
    try {
      if (!keyword.trim()) {
        const { page, pageSize } = get();
        const result = await bookApi.list({ page, pageSize });
        set({ books: result.data, total: result.total, loading: false });
        return;
      }
      const query: SearchBookQuery = { keyword };
      const books = await bookApi.search(query);
      set({ books, total: books.length, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '搜索书籍失败' });
    }
  },

  setPage: (page: number, pageSize: number) => {
    set({ page, pageSize });
  },

  reset: () => {
    set({ searchKeyword: '', page: DEFAULT_PAGE, pageSize: DEFAULT_PAGE_SIZE });
  },
}));
