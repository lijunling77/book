import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout as AntLayout, Typography } from 'antd';
import Sidebar from './Sidebar';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  return (
    <AntLayout style={{ minHeight: '100vh', background: '#eef1f5' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: '#3d5a80',
          height: 48,
          lineHeight: '48px',
        }}
      >
        <Typography.Title level={5} style={{ color: '#f0f4f8', margin: 0, fontWeight: 500 }}>
          书籍管理系统
        </Typography.Title>
      </Header>
      <AntLayout>
        <Sider
          width={180}
          style={{
            background: '#f7f8fa',
            borderRight: '1px solid #d9dee4',
          }}
        >
          <Sidebar />
        </Sider>
        <AntLayout style={{ padding: '16px' }}>
          <Content
            style={{
              padding: 20,
              margin: 0,
              minHeight: 280,
              background: '#ffffff',
              borderRadius: 6,
              overflow: 'auto',
            }}
          >
            <Outlet />
          </Content>
        </AntLayout>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
