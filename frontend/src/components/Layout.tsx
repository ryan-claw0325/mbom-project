import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Typography } from 'antd';
import '../styles/enterprise.css';

const { Title } = Typography;

const menuItems = [
  { key: '/boms', icon: '🏠', label: 'BOM 管理' },
  { key: '/import', icon: '📤', label: 'EBOM 导入' },
  { key: '/validation', icon: '✅', label: '数据校验' },
  { key: '/process', icon: '🔗', label: '工艺关联' },
];

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = '/' + (location.pathname.split('/')[1] || 'boms');

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Title level={4} style={{ color: 'white', margin: 0 }}>🔧 MBOM</Title>
          <span>管理模块</span>
        </div>
        <ul className="sidebar-nav">
          {menuItems.map((item) => (
            <li
              key={item.key}
              className={currentPath === item.key ? 'active' : ''}
              onClick={() => navigate(item.key)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
