import React, { useState, useEffect } from 'react';
import { Upload, Button, message, Space, Image, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ImageEntityType } from '../../shared/types';
import { imageApi } from '../utils/ipc';
import { IMAGE_MAX_SIZE_BYTES, IMAGE_MAX_SIZE_MB, SUPPORTED_IMAGE_EXTENSIONS } from '../../shared/constants';

interface ImageUploadProps {
  entityType: ImageEntityType;
  entityId: string;
  onSuccess?: () => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ entityType, entityId, onSuccess }) => {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadImage = async () => {
    try {
      const path = await imageApi.get(entityType, entityId);
      setImagePath(path);
    } catch {
      setImagePath(null);
    }
  };

  useEffect(() => {
    if (entityId) {
      loadImage();
    }
  }, [entityType, entityId]);

  const handleUpload = async (file: File) => {
    // Validate file type
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext as typeof SUPPORTED_IMAGE_EXTENSIONS[number])) {
      message.error('图片格式不支持，请上传 JPG 或 PNG 格式的图片');
      return false;
    }

    // Validate file size
    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      message.error(`图片文件大小超过 ${IMAGE_MAX_SIZE_MB}MB，请压缩后重新上传`);
      return false;
    }

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await imageApi.upload(entityType, entityId, buffer, file.name);
      message.success('图片上传成功');
      loadImage();
      onSuccess?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await imageApi.delete(entityType, entityId);
      message.success('图片删除成功');
      setImagePath(null);
      onSuccess?.();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {imagePath ? (
        <Space direction="vertical" align="center">
          <Image
            src={imagePath}
            alt="封面"
            width={120}
            height={160}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjYwIiB5PSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxMiI+5peg5Zu+PC90ZXh0Pjwvc3ZnPg=="
          />
          <Space>
            <Upload
              accept=".jpg,.jpeg,.png"
              showUploadList={false}
              beforeUpload={handleUpload}
              disabled={loading}
            >
              <Button size="small" loading={loading}>替换</Button>
            </Upload>
            <Popconfirm
              title="确认删除图片？"
              onConfirm={handleDelete}
              okText="确认"
              cancelText="取消"
            >
              <Button size="small" danger icon={<DeleteOutlined />} loading={loading}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </Space>
      ) : (
        <Upload
          accept=".jpg,.jpeg,.png"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={loading}
        >
          <Button icon={<UploadOutlined />} loading={loading}>
            上传封面图片
          </Button>
        </Upload>
      )}
      <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
        支持 JPG/PNG 格式，最大 {IMAGE_MAX_SIZE_MB}MB
      </div>
    </div>
  );
};

export default ImageUpload;
