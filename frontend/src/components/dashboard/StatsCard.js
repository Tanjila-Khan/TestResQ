import React from 'react';

const StatsCard = ({ title, value, icon: Icon, color, trend, trendValue, showProgress }) => {
  const getBackgroundColor = () => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50';
      case 'green':
        return 'bg-green-50';
      case 'purple':
        return 'bg-purple-50';
      case 'yellow':
        return 'bg-yellow-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getIconColor = () => {
    switch (color) {
      case 'blue':
        return 'text-blue-600';
      case 'green':
        return 'text-green-600';
      case 'purple':
        return 'text-purple-600';
      case 'yellow':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center">
        <div className={`${getBackgroundColor()} p-3 rounded-full`}>
          <Icon className={`w-6 h-6 ${getIconColor()}`} />
        </div>
        <div className="ml-4">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-gray-500">{trend}</span>
        {trendValue !== undefined && (
          <span className={`text-sm font-medium ${parseFloat(trendValue) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {parseFloat(trendValue) >= 0 ? '+' : ''}{parseFloat(trendValue).toFixed(1)}%
        </span>
        )}
      </div>
      {showProgress && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${Math.min(parseFloat(value), 100)}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCard; 