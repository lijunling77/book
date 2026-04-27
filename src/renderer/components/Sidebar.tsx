import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  EnvironmentOutlined,
  ImportOutlined,
  ExportOutlined,
  DatabaseOutlined,
  DollarOutlined,
  LineChartOutlined,
  AlertOutlined,
  AuditOutlined,
  FileTextOutlined,
  DownloadOutlined,
  UploadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

type MenuItem = Required<MenuProps>['items'][number];

const menuItems: MenuItem[] = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/books', icon: <BookOutlined />, label: '书籍管理' },
  { key: '/locations', icon: <EnvironmentOutlined />, label: '位置管理' },
  { key: '/inbound', icon: <ImportOutlined />, label: '入库管理' },
  { key: '/outbound', icon: <ExportOutlined />, label: '出库管理' },
  { key: '/stock', icon: <DatabaseOutlined />, label: '库存查询' },
  { key: '/price-history', icon: <DollarOutlined />, label: '价格历史' },
  { key: '/profit', icon: <LineChartOutlined />, label: '利润统计' },
  { key: '/alerts', icon: <AlertOutlined />, label: '库存预警' },
  { key: '/stocktaking', icon: <AuditOutlined />, label: '库存盘点' },
  { key: '/logs', icon: <FileTextOutlined />, label: '操作日志' },
  { key: '/export', icon: <DownloadOutlined />, label: '数据导出' },
  { key: '/import', icon: <UploadOutlined />, label: '数据导入' },
  { key: '/backup', icon: <SaveOutlined />, label: '备份恢复' },
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = menuItems
    .filter((item): item is MenuItem & { key: string } => item !== null && 'key' in item)
    .reduce((best, item) => {
      const key = item.key as string;
      if (location.pathname === key || (key !== '/' && location.pathname.startsWith(key))) {
        if (key.length > (best?.length ?? 0)) return key;
      }
      return best;
    }, '/' as string);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ height: '100%', borderRight: 0 }}
    />
  );
};

export default Sidebar;
