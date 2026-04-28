import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import BookList from './pages/BookList';
import BookDetail from './pages/BookDetail';
import LocationList from './pages/LocationList';
import InboundList from './pages/InboundList';
import OutboundList from './pages/OutboundList';
import StockList from './pages/StockList';
import PriceHistory from './pages/PriceHistory';
import ProfitReport from './pages/ProfitReport';
import AlertList from './pages/AlertList';
import StocktakingList from './pages/StocktakingList';
import StocktakingDetail from './pages/StocktakingDetail';
import LogList from './pages/LogList';
import ExportData from './pages/ExportData';
import ImportBooks from './pages/ImportBooks';
import BackupRestore from './pages/BackupRestore';
import Report from './pages/Report';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="books" element={<BookList />} />
            <Route path="books/:id" element={<BookDetail />} />
            <Route path="locations" element={<LocationList />} />
            <Route path="inbound" element={<InboundList />} />
            <Route path="outbound" element={<OutboundList />} />
            <Route path="stock" element={<StockList />} />
            <Route path="price-history" element={<PriceHistory />} />
            <Route path="profit" element={<ProfitReport />} />
            <Route path="alerts" element={<AlertList />} />
            <Route path="stocktaking" element={<StocktakingList />} />
            <Route path="stocktaking/:id" element={<StocktakingDetail />} />
            <Route path="logs" element={<LogList />} />
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
