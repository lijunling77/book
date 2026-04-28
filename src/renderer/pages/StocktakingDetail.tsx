import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  Typography,
  Button,
  InputNumber,
  Space,
  Tag,
  Alert,
  message,
  Spin,
  Card,
  Statistic,
  Row,
  Col,
  Empty,
  Modal,
  Descriptions,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { StocktakingItemView, StocktakingDetail as StocktakingDetailType, StocktakingReport } from '../../shared/types';
import { stocktakingApi } from '../utils/ipc';
import {
  STOCKTAKING_STATUS_LABELS,
  STOCKTAKING_ITEM_STATUS_LABELS,
} from '../../shared/constants';
import { formatDateTime } from '../utils/format';

const StocktakingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<StocktakingDetailType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualValues, setActualValues] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<StocktakingReport | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const result = await stocktakingApi.getDetail(id);
      setDetail(result);
      const vals: Record<string, number | null> = {};
      result.items.forEach((item) => {
        vals[item.id] = item.actualQuantity;
      });
      setActualValues(vals);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取盘点详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleSaveActual = async () => {
    if (!id) return;
    const items = Object.entries(actualValues)
      .filter(([, val]) => val !== null && val !== undefined)
      .map(([itemId, actualQuantity]) => ({
        itemId,
        actualQuantity: actualQuantity!,
      }));

    if (items.length === 0) {
      message.warning('请至少录入一个库存单元的实际数量');
      return;
    }

    setSaving(true);
    try {
      await stocktakingApi.recordActual(id, items);
      message.success('实际数量保存成功');
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAndConfirm = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // Step 1: Save any unsaved actual values
      const items = Object.entries(actualValues)
        .filter(([, val]) => val !== null && val !== undefined)
        .map(([itemId, actualQuantity]) => ({
          itemId,
          actualQuantity: actualQuantity!,
        }));

      if (items.length > 0) {
        await stocktakingApi.recordActual(id, items);
      }

      // Step 2: Submit to generate report
      const result = await stocktakingApi.submit(id);
      setReport(result);

      // Step 3: Show confirmation modal with report
      setConfirmModalOpen(true);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await stocktakingApi.confirm(id);
      message.success('盘点已确认，库存已调整');
      setConfirmModalOpen(false);
      setReport(null);
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '确认失败');
    } finally {
      setSaving(false);
    }
  };

  const isCompleted = detail?.task.status === 'completed';

  const statusColor = (status: string | null) => {
    if (status === 'surplus') return 'green';
    if (status === 'deficit') return 'red';
    if (status === 'match') return 'blue';
    return 'default';
  };

  const columns: ColumnsType<StocktakingItemView> = [
    { title: '书名', dataIndex: 'bookTitle', key: 'bookTitle' },
    { title: '版本', dataIndex: 'editionName', key: 'editionName' },
    {
      title: '位置',
      key: 'location',
      render: (_: unknown, r: StocktakingItemView) => `${r.warehouse}-${r.shelf}-${r.layer}`,
    },
    { title: '系统数量', dataIndex: 'systemQuantity', key: 'systemQuantity' },
    {
      title: '实际数量',
      key: 'actualQuantity',
      render: (_: unknown, record: StocktakingItemView) =>
        isCompleted ? (
          <span>{record.actualQuantity ?? '-'}</span>
        ) : (
          <InputNumber
            min={0}
            precision={0}
            value={actualValues[record.id]}
            onChange={(val) =>
              setActualValues((prev) => ({ ...prev, [record.id]: val }))
            }
            placeholder="输入实际数量"
            style={{ width: 120 }}
          />
        ),
    },
    {
      title: '差异',
      dataIndex: 'variance',
      key: 'variance',
      render: (val: number | null) =>
        val !== null && val !== undefined ? (
          <span style={{ color: val > 0 ? '#3f8600' : val < 0 ? '#cf1322' : undefined, fontWeight: 'bold' }}>
            {val > 0 ? `+${val}` : val}
          </span>
        ) : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string | null) =>
        val ? (
          <Tag color={statusColor(val)}>
            {STOCKTAKING_ITEM_STATUS_LABELS[val] ?? val}
          </Tag>
        ) : (
          <Tag>未录入</Tag>
        ),
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  if (!detail) {
    return <Empty description="盘点任务不存在" />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/stocktaking')}>
          返回列表
        </Button>
      </Space>

      <Typography.Title level={4}>盘点详情</Typography.Title>

      <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="范围类型">
          {detail.task.scopeType === 'location' ? '按位置' : '按分类'}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={isCompleted ? 'green' : 'blue'}>
            {STOCKTAKING_STATUS_LABELS[detail.task.status] ?? detail.task.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">{formatDateTime(detail.task.createdAt)}</Descriptions.Item>
        {detail.task.completedAt && (
          <Descriptions.Item label="完成时间">{formatDateTime(detail.task.completedAt)}</Descriptions.Item>
        )}
      </Descriptions>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {detail.items.length === 0 ? (
        <Empty description="盘点范围内无库存单元数据" />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={detail.items}
            rowKey="id"
            pagination={false}
          />

          {!isCompleted && (
            <Space style={{ marginTop: 16 }}>
              <Button onClick={handleSaveActual} loading={saving}>
                保存实际数量
              </Button>
              <Button type="primary" onClick={handleSubmitAndConfirm} loading={saving}>
                提交并调整库存
              </Button>
            </Space>
          )}
        </>
      )}

      {/* Confirmation modal with report */}
      <Modal
        title="盘点报告确认"
        open={confirmModalOpen}
        onCancel={() => setConfirmModalOpen(false)}
        width={600}
        footer={
          <Space>
            <Button onClick={() => setConfirmModalOpen(false)}>取消</Button>
            <Button type="primary" danger onClick={handleConfirm} loading={saving}>
              确认调整
            </Button>
          </Space>
        }
      >
        {report && (
          <>
            <Alert
              message="确认后将根据实际数量调整库存，此操作不可撤销。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
              <Col span={6}><Statistic title="总项数" value={report.totalItems} /></Col>
              <Col span={6}><Statistic title="盘盈" value={report.surplusCount} valueStyle={{ color: '#3f8600' }} /></Col>
              <Col span={6}><Statistic title="盘亏" value={report.deficitCount} valueStyle={{ color: '#cf1322' }} /></Col>
              <Col span={6}><Statistic title="一致" value={report.matchCount} /></Col>
            </Row>
            {report.unrecordedCount > 0 && (
              <Alert
                message={`有 ${report.unrecordedCount} 个库存单元尚未录入实际数量`}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default StocktakingDetail;
