import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout as AntLayout, Menu, Typography, theme } from 'antd';
import {
  HomeOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';

const { Header, Content } = AntLayout;
const { Title } = Typography;

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/boms',
      icon: <HomeOutlined />,
      label: 'BOM 管理',
    },
    {
      key: '/import',
      icon: <UploadOutlined />,
      label: 'EBOM 导入',
    },
    {
      key: '/validation',
      icon: <CheckCircleOutlined />,
      label: '数据校验',
    },
    {
      key: '/process',
      icon: <ApiOutlined />,
      label: '工艺关联',
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Title level={4} style={{ color: 'white', margin: 0 }}>
          🔧 MBOM 管理模块
        </Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname.split('/')[1] || '/boms']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </Header>
      <Content style={{ padding: '24px' }}>
        <div
          style={{
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            minHeight: 'calc(100vh - 112px)',
            padding: 24,
          }}
        >
          <Outlet />
        </div>
      </Content>
    </AntLayout>
  );
};

export default Layout;
