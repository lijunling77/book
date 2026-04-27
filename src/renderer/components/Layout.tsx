import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layout as AntLayout, Typography } from 'antd';
import Sidebar from './Sidebar';

const { Header, Sider, Content } = AntLayout;

const Layout: React.FC = () => {
  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: '#001529',
        }}
      >
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          书籍管理系统
        </Typography.Title>
      </Header>
      <AntLayout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Sidebar />
        </Sider>
        <AntLayout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: '#fff',
              borderRadius: 8,
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
