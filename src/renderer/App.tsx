import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BookList from './pages/BookList';
import InboundList from './pages/InboundList';
import OutboundList from './pages/OutboundList';
import StockList from './pages/StockList';
import PriceHistory from './pages/PriceHistory';
import ProfitReport from './pages/ProfitReport';
import StocktakingList from './pages/StocktakingList';
import StocktakingDetail from './pages/StocktakingDetail';
import ExportData from './pages/ExportData';
import ImportBooks from './pages/ImportBooks';
import BackupRestore from './pages/BackupRestore';
import Report from './pages/Report';

const eyeCareTheme = {
  token: {
    colorPrimary: '#5b7e9f',
    colorBgContainer: '#f7f8fa',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#eef1f5',
    colorText: '#2c3e50',
    colorTextSecondary: '#6b7b8d',
    colorBorder: '#d9dee4',
    colorBorderSecondary: '#e8ecf0',
    borderRadius: 6,
    fontSize: 14,
    controlOutline: 'transparent',
    controlOutlineWidth: 0,
  },
  components: {
    Table: {
      headerBg: '#e8ecf2',
      headerColor: '#2c3e50',
      rowHoverBg: '#edf0f5',
      borderColor: '#d9dee4',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: '#dce3ed',
      itemSelectedColor: '#3a6b9f',
      itemHoverBg: '#e4e9f0',
    },
    Card: {
      colorBgContainer: '#ffffff',
    },
    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
    Input: {
      colorBgContainer: '#ffffff',
      activeShadow: 'none',
    },
    Select: {
      colorBgContainer: '#ffffff',
    },
    DatePicker: {
      colorBgContainer: '#ffffff',
      activeShadow: 'none',
    },
    InputNumber: {
      colorBgContainer: '#ffffff',
      activeShadow: 'none',
    },
    Button: {
      controlOutline: 'transparent',
      controlTmpOutline: 'transparent',
    },
  },
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN} theme={eyeCareTheme}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="books" element={<BookList />} />
            <Route path="inbound" element={<InboundList />} />
            <Route path="outbound" element={<OutboundList />} />
            <Route path="stock" element={<StockList />} />
            <Route path="price-history" element={<PriceHistory />} />
            <Route path="profit" element={<ProfitReport />} />
            <Route path="stocktaking" element={<StocktakingList />} />
            <Route path="stocktaking/:id" element={<StocktakingDetail />} />
            <Route path="export" element={<ExportData />} />
            <Route path="import" element={<ImportBooks />} />
            <Route path="backup" element={<BackupRestore />} />
            <Route path="report" element={<Report />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
};

export default App;
