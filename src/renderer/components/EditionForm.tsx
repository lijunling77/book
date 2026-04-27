import React, { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import type { Edition, CreateEditionInput, UpdateEditionInput } from '../../shared/types';
import { editionApi } from '../utils/ipc';

interface EditionFormProps {
  open: boolean;
  bookId: string;
  edition?: Edition | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EditionForm: React.FC<EditionFormProps> = ({ open, bookId, edition, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const isEdit = !!edition;

  useEffect(() => {
    if (open) {
      if (edition) {
        form.setFieldsValue({ name: edition.name });
      } else {
        form.resetFields();
      }
    }
  }, [open, edition, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && edition) {
        const updateData: UpdateEditionInput = { name: values.name };
        await editionApi.update(edition.id, updateData);
        message.success('版本更新成功');
      } else {
        const createData: CreateEditionInput = { bookId, name: values.name };
        await editionApi.create(createData);
        message.success('版本创建成功');
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
      title={isEdit ? '编辑版本' : '新增版本'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="版本名称"
          rules={[{ required: true, message: '请输入版本名称' }]}
        >
          <Input placeholder="如：精装、平装、签名本、限量版" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditionForm;
