import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import BOMListPage from './pages/BOMListPage';
import BOMTreePage from './pages/BOMTreePage';
import EBOMImportPage from './pages/EBOMImportPage';
import ValidationPage from './pages/ValidationPage';
import ProcessAssocPage from './pages/ProcessAssocPage';
import './styles/enterprise.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#2563eb',
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/boms" replace />} />
              <Route path="boms" element={<BOMListPage />} />
              <Route path="boms/:id" element={<BOMTreePage />} />
              <Route path="import" element={<EBOMImportPage />} />
              <Route path="validation" element={<ValidationPage />} />
              <Route path="process" element={<ProcessAssocPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
