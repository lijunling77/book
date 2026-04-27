import React from 'react';
import { Modal, Typography, Descriptions } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  details?: { label: string; value: React.ReactNode }[];
  onConfirm: () => void;
  onCancel: () => void;
  confirmLoading?: boolean;
  danger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  onConfirm,
  onCancel,
  confirmLoading,
  danger = true,
}) => {
  return (
    <Modal
      open={open}
      title={
        <span>
          <ExclamationCircleOutlined style={{ color: danger ? '#ff4d4f' : '#faad14', marginRight: 8 }} />
          {title}
        </span>
      }
      onOk={onConfirm}
      onCancel={onCancel}
      okText="确认"
      cancelText="取消"
      okButtonProps={{ danger }}
      confirmLoading={confirmLoading}
    >
      {description && (
        <Typography.Paragraph style={{ marginBottom: details ? 16 : 0 }}>
          {description}
        </Typography.Paragraph>
      )}
      {details && details.length > 0 && (
        <Descriptions bordered size="small" column={1}>
          {details.map((d, i) => (
            <Descriptions.Item key={i} label={d.label}>
              {d.value}
            </Descriptions.Item>
          ))}
        </Descriptions>
      )}
    </Modal>
  );
};

export default ConfirmDialog;
