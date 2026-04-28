import React, { useEffect, useState } from 'react';
import { Typography, Select, DatePicker, Space, Button, Alert, message, Card } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Book, Location, ExportFormat } from '../../shared/types';
import { exportApi, bookApi, locationApi } from '../utils/ipc';

const { RangePicker } = DatePicker;
type ExportType = 'inbound' | 'outbound' | 'stock' | 'profit';

const ExportData: React.FC = () => {
  const [exportType, setExportType] = useState<ExportType>('inbound');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filterBookId, setFilterBookId] = useState<string | undefined>();
  const [filterLocationId, setFilterLocationId] = useState<string | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  useEffect(() => { bookApi.list({ page: 1, pageSize: 1000 }).then((r) => setBooks(r.data)).catch(() => {}); locationApi.list().then(setLocations).catch(() => {}); }, []);

  const handleExport = async () => {
    setExporting(true); setError(null);
    try {
      const dateRange = filterDateRange ? { startDate: filterDateRange[0].format('YYYY-MM-DD'), endDate: filterDateRange[1].format('YYYY-MM-DD') } : undefined;
      let filePath: string;
      if (exportType === 'inbound') filePath = await exportApi.inbound({ bookId: filterBookId, locationId: filterLocationId, dateRange }, format);
      else if (exportType === 'outbound') filePath = await exportApi.outbound({ bookId: filterBookId, locationId: filterLocationId, dateRange }, format);
      else if (exportType === 'stock') filePath = await exportApi.stock({ bookTitle: undefined, locationId: filterLocationId }, format);
      else filePath = await exportApi.profit({ dateRange }, format);
      message.success(`导出成功：${filePath}`);
    } catch (err) { const msg = err instanceof Error ? err.message : '导出失败'; setError(msg); message.error(msg); }
    finally { setExporting(false); }
  };

  return (
    <div>
      <Typography.Title level={4}>数据导出</Typography.Title>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space wrap>
            <div><div style={{ marginBottom: 4, fontWeight: 500 }}>导出类型</div><Select style={{ width: 200 }} value={exportType} onChange={(v) => { setExportType(v); setFilterBookId(undefined); setFilterLocationId(undefined); setFilterDateRange(null); }} options={[{ value: 'inbound', label: '入库记录' }, { value: 'outbound', label: '出库记录' }, { value: 'stock', label: '库存信息' }, { value: 'profit', label: '利润统计' }]} /></div>
            <div><div style={{ marginBottom: 4, fontWeight: 500 }}>导出格式</div><Select style={{ width: 160 }} value={format} onChange={setFormat} options={[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV (.csv)' }]} /></div>
          </Space>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>筛选条件</div>
            <Space wrap>
              {(exportType === 'inbound' || exportType === 'outbound') && <Select placeholder="按书籍筛选" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} value={filterBookId} onChange={setFilterBookId} options={books.map((b) => ({ value: b.id, label: b.title }))} />}
              {(exportType === 'inbound' || exportType === 'outbound' || exportType === 'stock') && <Select placeholder="按位置筛选" allowClear showSearch optionFilterProp="label" style={{ width: 200 }} value={filterLocationId} onChange={setFilterLocationId} options={locations.map((l) => ({ value: l.id, label: `${l.warehouse}-${l.shelf}-${l.layer}` }))} />}
              {(exportType === 'inbound' || exportType === 'outbound' || exportType === 'profit') && <RangePicker value={filterDateRange} onChange={(dates) => setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)} />}
            </Space>
          </div>
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>导出</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { setFilterBookId(undefined); setFilterLocationId(undefined); setFilterDateRange(null); }}>重置</Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
};

export default ExportData;
