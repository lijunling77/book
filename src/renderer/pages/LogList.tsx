import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Typography,
  Select,
  DatePicker,
  Space,
  Alert,
  Tag,
  Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { OperationLog, LogFilter, OperationType, EntityType } from '../../shared/types';
import { logApi } from '../utils/ipc';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  OPERATION_TYPE_LABELS,
  ENTITY_TYPE_LABELS,
} from '../../shared/constants';
import { formatDateTime } from '../utils/format';

const { RangePicker } = DatePicker;

const operationTypeOptions = Object.entries(OPERATION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const entityTypeOptions = Object.entries(ENTITY_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const LogList: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(DEFAULT_PAGE);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterOperationType, setFilterOperationType] = useState<OperationType | undefined>();
  const [filterEntityType, setFilterEntityType] = useState<EntityType | undefined>();
  const [filterDateRange, setFilterDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareLog, setCompareLog] = useState<OperationLog | null>(null);

  const fetchLogs = useCallback(async (p?: number, ps?: number) => {
    setLoading(true);
    setError(null);
    try {
      const filter: LogFilter = {
        page: p ?? page,
        pageSize: ps ?? pageSize,
      };
      if (filterOperationType) filter.operationType = filterOperationType;
      if (filterEntityType) filter.entityType = filterEntityType;
      if (filterDateRange) {
        filter.dateRange = {
          startDate: filterDateRange[0].format('YYYY-MM-DD'),
          endDate: filterDateRange[1].format('YYYY-MM-DD'),
        };
      }
      const result = await logApi.list(filter);
      setLogs(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取操作日志失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterOperationType, filterEntityType, filterDateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleShowCompare = (log: OperationLog) => {
    setCompareLog(log);
    setCompareModalOpen(true);
  };

  const formatJson = (jsonStr: string | null): string => {
    if (!jsonStr) return '无';
    try {
      return JSON.stringify(JSON.parse(jsonStr), null, 2);
    } catch {
      return jsonStr;
    }
  };

  const operationColor = (type: string) => {
    switch (type) {
      case 'create': return 'green';
      case 'edit': return 'blue';
      case 'delete': return 'red';
      case 'stocktaking_adjust': return 'orange';
      default: return 'default';
    }
  };

  const columns: ColumnsType<OperationLog> = [
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: formatDateTime,
    },
    {
      title: '操作类型',
      dataIndex: 'operationType',
      key: 'operationType',
      width: 100,
      render: (val: string) => (
        <Tag color={operationColor(val)}>
          {OPERATION_TYPE_LABELS[val] ?? val}
        </Tag>
      ),
    },
    {
      title: '对象类型',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 100,
      render: (val: string) => ENTITY_TYPE_LABELS[val] ?? val,
    },
    {
      title: '对象标识',
      dataIndex: 'entityId',
      key: 'entityId',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: OperationLog) => (
        <a onClick={() => handleShowCompare(record)}>查看变更</a>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4}>操作日志</Typography.Title>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="操作类型"
          allowClear
          style={{ width: 140 }}
          value={filterOperationType}
          onChange={(v) => { setFilterOperationType(v); setPage(1); }}
          options={operationTypeOptions}
        />
        <Select
          placeholder="对象类型"
          allowClear
          style={{ width: 140 }}
          value={filterEntityType}
          onChange={(v) => { setFilterEntityType(v); setPage(1); }}
          options={entityTypeOptions}
        />
        <RangePicker
          value={filterDateRange}
          onChange={(dates) => {
            setFilterDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
            setPage(1);
          }}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            fetchLogs(p, ps);
          },
        }}
      />

      <Modal
        title="变更数据对比"
        open={compareModalOpen}
        onCancel={() => setCompareModalOpen(false)}
        footer={null}
        width={700}
      >
        {compareLog && (
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <Typography.Title level={5}>变更前</Typography.Title>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
                {formatJson(compareLog.beforeData)}
              </pre>
            </div>
            <div style={{ flex: 1 }}>
              <Typography.Title level={5}>变更后</Typography.Title>
              <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
                {formatJson(compareLog.afterData)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LogList;
