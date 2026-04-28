import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BookList from './pages/BookList';
import LocationList from './pages/LocationList';
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
    colorPrimary: '#5b8c5a',
    colorBgContainer: '#f5f0e8',
    colorBgElevated: '#faf6ee',
    colorBgLayout: '#ede8dc',
    colorText: '#3d3929',
    colorTextSecondary: '#6b6452',
    colorBorder: '#d4cdb8',
    colorBorderSecondary: '#e0d9c8',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Table: {
      headerBg: '#e8e2d2',
      headerColor: '#3d3929',
      rowHoverBg: '#ece6d6',
      borderColor: '#d4cdb8',
    },
    Menu: {
      itemBg: '#f5f0e8',
      itemSelectedBg: '#ddd6c2',
      itemSelectedColor: '#3d5a3d',
      itemHoverBg: '#ece6d6',
    },
    Card: {
      colorBgContainer: '#faf6ee',
    },
    Modal: {
      contentBg: '#faf6ee',
      headerBg: '#faf6ee',
    },
    Input: {
      colorBgContainer: '#fdfaf2',
    },
    Select: {
      colorBgContainer: '#fdfaf2',
    },
    DatePicker: {
      colorBgContainer: '#fdfaf2',
    },
    InputNumber: {
      colorBgContainer: '#fdfaf2',
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
            <Route path="locations" element={<LocationList />} />
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
