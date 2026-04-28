import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout as AntLayout, Typography } from 'antd';
import Sidebar from './Sidebar';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  return (
    <AntLayout style={{ minHeight: '100vh', background: '#ede8dc' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: '#4a6741',
          height: 48,
          lineHeight: '48px',
        }}
      >
        <Typography.Title level={5} style={{ color: '#f5f0e8', margin: 0, fontWeight: 500 }}>
          书籍管理系统
        </Typography.Title>
      </Header>
      <AntLayout>
        <Sider
          width={180}
          style={{
            background: '#f5f0e8',
            borderRight: '1px solid #d4cdb8',
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
              background: '#faf6ee',
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
