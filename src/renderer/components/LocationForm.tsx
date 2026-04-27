import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { Location, CreateLocationInput, UpdateLocationInput } from '../../shared/types';
import { locationApi } from '../utils/ipc';

interface LocationFormProps {
  open: boolean;
  location?: Location | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LocationForm: React.FC<LocationFormProps> = ({ open, location, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!location;

  useEffect(() => {
    if (open) {
      if (location) {
        form.setFieldsValue({
          warehouse: location.warehouse,
          shelf: location.shelf,
          layer: location.layer,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, location, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && location) {
        const updateData: UpdateLocationInput = {
          warehouse: values.warehouse,
          shelf: values.shelf,
          layer: values.layer,
        };
        await locationApi.update(location.id, updateData);
        message.success('位置更新成功');
      } else {
        const createData: CreateLocationInput = {
          warehouse: values.warehouse,
          shelf: values.shelf,
          layer: values.layer,
        };
        await locationApi.create(createData);
        message.success('位置创建成功');
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
      title={isEdit ? '编辑位置' : '新增位置'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="warehouse"
          label="仓库名称"
          rules={[{ required: true, message: '请输入仓库名称' }]}
        >
          <Input placeholder="请输入仓库名称" />
        </Form.Item>
        <Form.Item
          name="shelf"
          label="书架编号"
          rules={[{ required: true, message: '请输入书架编号' }]}
        >
          <Input placeholder="请输入书架编号" />
        </Form.Item>
        <Form.Item
          name="layer"
          label="层号"
          rules={[{ required: true, message: '请输入层号' }]}
        >
          <Input placeholder="请输入层号" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default LocationForm;
