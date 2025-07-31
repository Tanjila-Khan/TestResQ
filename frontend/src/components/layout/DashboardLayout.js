import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  // Determine active tab from path
  const path = location.pathname.split('/')[1] || 'dashboard';
  const [activeTab, setActiveTab] = useState(path);

  // Update activeTab and navigate when sidebar item is clicked
  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    navigate(`/${tab === 'dashboard' ? 'dashboard' : tab}`);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar activeTab={activeTab} setActiveTab={handleSetActiveTab} />
      <div className="flex-1 flex flex-col">
        <Header activeTab={activeTab} />
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 