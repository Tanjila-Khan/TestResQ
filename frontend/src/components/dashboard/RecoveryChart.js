import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import { Download, BarChart2, LineChart, PieChart } from 'lucide-react';

const RecoveryChart = ({ data, chartType, onChartTypeChange }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const exportChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'cart-recovery-chart.png';
      link.href = chartRef.current.toDataURL('image/png');
      link.click();
    }
  };

  useEffect(() => {
    if (!data || !data.labels || !data.datasets) {
      console.warn('Invalid chart data format:', data);
      return;
    }

    // Only use the first two datasets (Abandoned and Recovered)
    const datasets = data.datasets.slice(0, 2);

    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      
      const chartConfig = {
        type: chartType,
        data: {
          labels: data.labels,
          datasets: datasets.map(dataset => ({
            ...dataset,
            backgroundColor: dataset.borderColor + '40', // Add 40% opacity
            borderWidth: 1,
            tension: 0.4
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Carts'
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              },
              grid: {
                display: false
              }
            }
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
              mode: 'index',
              intersect: false,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              titleColor: '#000',
              bodyColor: '#000',
              borderColor: '#ddd',
              borderWidth: 1,
              padding: 12,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed.y !== null) {
                    label += context.parsed.y;
                  }
                  return label;
                }
              }
            }
          },
          interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
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
  }, [data, chartType]);

  return (
    <div className="relative">
      <div className="absolute top-0 right-0 flex space-x-2 p-4">
        <button
          onClick={() => onChartTypeChange('bar')}
          className={`p-2 rounded-md ${chartType === 'bar' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
          title="Bar Chart"
        >
          <BarChart2 size={20} />
        </button>
        <button
          onClick={() => onChartTypeChange('line')}
          className={`p-2 rounded-md ${chartType === 'line' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
          title="Line Chart"
        >
          <LineChart size={20} />
        </button>
        <button
          onClick={() => onChartTypeChange('pie')}
          className={`p-2 rounded-md ${chartType === 'pie' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
          title="Pie Chart"
        >
          <PieChart size={20} />
        </button>
        <button
          onClick={exportChart}
          className="p-2 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
          title="Export Chart"
        >
          <Download size={20} />
        </button>
      </div>
      <div className="h-64 mt-12">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
};

export default RecoveryChart; 