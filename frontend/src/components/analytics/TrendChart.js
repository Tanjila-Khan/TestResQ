import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { Calendar, Download, BarChart2, LineChart } from 'lucide-react';

const TrendChart = ({ 
  title, 
  data, 
  loading = false, 
  error = null,
  chartType = 'line',
  onChartTypeChange,
  onPeriodChange,
  period = '30d',
  height = 'h-64'
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [localChartType, setLocalChartType] = useState(chartType);

  const exportChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-chart.png`;
      link.href = chartRef.current.toDataURL('image/png');
      link.click();
    }
  };

  const handleChartTypeChange = (newType) => {
    setLocalChartType(newType);
    if (onChartTypeChange) {
      onChartTypeChange(newType);
    }
  };

  useEffect(() => {
    if (!data || !data.labels || !data.datasets || data.labels.length === 0) {
      console.warn('Invalid or empty chart data:', data);
      return;
    }

    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      
      const chartConfig = {
        type: localChartType,
        data: {
          labels: data.labels,
          datasets: data.datasets.map(dataset => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || dataset.borderColor + '20',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: true
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)',
                drawBorder: false
              },
              ticks: {
                color: '#6B7280',
                font: {
                  size: 12
                }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6B7280',
                font: {
                  size: 12
                },
                maxRotation: 45
              }
            }
          }
        }
      };

      chartInstance.current = new Chart(ctx, chartConfig);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, localChartType]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} flex items-center justify-center bg-gray-50 rounded`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading chart data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} flex items-center justify-center bg-gray-50 rounded`}>
          <div className="text-center">
            <p className="text-red-500 mb-2">Error loading chart</p>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.labels || data.labels.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} flex items-center justify-center bg-gray-50 rounded`}>
          <div className="text-center">
            <p className="text-gray-500 mb-2">No data available</p>
            <p className="text-gray-400 text-sm">Try selecting a different time period</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <Calendar size={16} className="text-gray-500" />
            <select
              value={period}
              onChange={(e) => onPeriodChange && onPeriodChange(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleChartTypeChange('line')}
              className={`p-1 rounded ${localChartType === 'line' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LineChart size={16} />
            </button>
            <button
              onClick={() => handleChartTypeChange('bar')}
              className={`p-1 rounded ${localChartType === 'bar' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart2 size={16} />
            </button>
          </div>
          <button
            onClick={exportChart}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
            title="Export chart"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className={height}>
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

export default TrendChart; 