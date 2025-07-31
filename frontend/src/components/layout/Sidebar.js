import React from 'react';
import { Clock, ShoppingCart, Mail, Users, MessageSquare, Tag, Activity, Settings } from 'lucide-react';
import cartresqLogo from '../../assets/cartresq-logo.jpg';
import icon from '../../assets/icon.png';

const Sidebar = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Clock },
    { id: 'carts', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'campaigns', label: 'Email Campaigns', icon: Mail },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: MessageSquare },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-center mb-1">
          <img src={icon} alt="CartResQ Icon" className="w-8 h-8 mr-2" style={{background: 'transparent'}} />
          <h1 className="text-lg font-semibold text-blue-600">CartResQ</h1>
        </div>
        <p className="text-sm text-gray-500 text-center">Abandoned Cart Recovery</p>
      </div>
      
      <nav className="px-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button 
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar; 