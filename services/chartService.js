const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { logger } = require('../config');
const { formatCurrency, formatCurrencyShort } = require('../utils/formatter');
const { 
  getTransactions, 
  getDailyData, 
  getCategorySummary,
  getMonthlyComparisonData 
} = require('./transactionService');

// Alternative Chart Generation using QuickChart API (No Canvas Required)
async function generateQuickChart(userId, chartType, period = 'month') {
  try {
    let chartConfig = {};
    let filename = '';
    
    if (chartType === 'line') {
      const dailyData = await getDailyData(userId, period);
      if (dailyData.length === 0) return null;
      
      // Process data for chart
      const dates = [...new Set(dailyData.map(d => d.date))].sort();
      const incomeData = [];
      const expenseData = [];
      
      dates.forEach(date => {
        const income = dailyData.find(d => d.date === date && d.type === 'income')?.total || 0;
        const expense = dailyData.find(d => d.date === date && d.type === 'expense')?.total || 0;
        incomeData.push(income);
        expenseData.push(expense);
      });
      
      const totalIncome = incomeData.reduce((sum, val) => sum + val, 0);
      const totalExpense = expenseData.reduce((sum, val) => sum + val, 0);
      const netAmount = totalIncome - totalExpense;
      
      chartConfig = {
        type: 'line',
        data: {
          labels: dates.map(date => moment(date).format('DD/MM')),
          datasets: [
            {
              label: `Pemasukan (${formatCurrencyShort(totalIncome)})`,
              data: incomeData,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#10B981',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4
            },
            {
              label: `Pengeluaran (${formatCurrencyShort(totalExpense)})`,
              data: expenseData,
              borderColor: '#EF4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#EF4444',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 2,
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: [
                `Trend Keuangan - ${period.charAt(0).toUpperCase() + period.slice(1)}`,
                `Net: ${formatCurrencyShort(netAmount)} (${netAmount >= 0 ? '+' : ''}${((netAmount / Math.max(totalExpense, 1)) * 100).toFixed(1)}%)`
              ],
              font: {
                size: 16,
                weight: 'bold',
                family: 'Arial'
              },
              color: '#333333',
              padding: 20
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Tanggal',
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                color: '#333333',
                font: {
                  family: 'Arial'
                }
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Jumlah (IDR)',
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                callback: function(value) {
                  return formatCurrencyShort(value);
                },
                color: '#333333',
                font: {
                  size: 10,
                  family: 'Arial'
                }
              }
            }
          }
        }
      };
      
      filename = `line_chart_${userId}_${period}_${Date.now()}.png`;
      
    } else if (chartType === 'pie') {
      const categorySummary = await getCategorySummary(userId, period);
      const expenseData = categorySummary.filter(s => s.type === 'expense');
      
      if (expenseData.length === 0) return null;
      
      const labels = expenseData.map(s => s.category);
      const data = expenseData.map(s => s.total);
      const total = data.reduce((sum, val) => sum + val, 0);
      
      // Create labels with percentages
      const labelsWithPercentage = labels.map((label, index) => {
        const percentage = ((data[index] / total) * 100).toFixed(1);
        return `${label} (${percentage}%)`;
      });
      
      chartConfig = {
        type: 'doughnut',
        data: {
          labels: labelsWithPercentage,
          datasets: [{
            data: data,
            backgroundColor: [
              '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
              '#8B5CF6', '#EC4899', '#84CC16', '#6366F1', '#14B8A6'
            ],
            borderWidth: 3,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: [
                `Breakdown Pengeluaran - ${period.charAt(0).toUpperCase() + period.slice(1)}`,
                `Total: ${formatCurrencyShort(total)}`
              ],
              font: {
                size: 16,
                weight: 'bold',
                family: 'Arial'
              },
              color: '#333333',
              padding: 20
            },
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 11,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333',
                generateLabels: function(chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length) {
                    return data.labels.map((label, i) => {
                      const value = data.datasets[0].data[i];
                      return {
                        text: `${label} - ${formatCurrencyShort(value)}`,
                        fillStyle: data.datasets[0].backgroundColor[i],
                        strokeStyle: '#ffffff',
                        lineWidth: 2,
                        hidden: false,
                        index: i
                      };
                    });
                  }
                  return [];
                }
              }
            }
          }
        }
      };
      
      filename = `pie_chart_${userId}_expense_${period}_${Date.now()}.png`;
      
    } else if (chartType === 'bar') {
      const monthlyData = await getMonthlyComparisonData(userId);
      
      if (monthlyData.every(m => m.income === 0 && m.expense === 0)) {
        return null;
      }
      
      const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
      const totalExpense = monthlyData.reduce((sum, m) => sum + m.expense, 0);
      const netTotal = totalIncome - totalExpense;
      
      chartConfig = {
        type: 'bar',
        data: {
          labels: monthlyData.map(m => m.month),
          datasets: [
            {
              label: `Pemasukan (${formatCurrencyShort(totalIncome)})`,
              data: monthlyData.map(m => m.income),
              backgroundColor: '#10B981',
              borderColor: '#059669',
              borderWidth: 2,
              borderRadius: 4
            },
            {
              label: `Pengeluaran (${formatCurrencyShort(totalExpense)})`,
              data: monthlyData.map(m => m.expense),
              backgroundColor: '#EF4444',
              borderColor: '#DC2626',
              borderWidth: 2,
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: [
                'Perbandingan 3 Bulan Terakhir',
                `Net Total: ${formatCurrencyShort(netTotal)} (${netTotal >= 0 ? 'Surplus' : 'Defisit'})`
              ],
              font: {
                size: 16,
                weight: 'bold',
                family: 'Arial'
              },
              color: '#333333',
              padding: 20
            },
            legend: {
              display: true,
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: 'Bulan',
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              },
              grid: {
                display: false
              },
              ticks: {
                color: '#333333',
                font: {
                  family: 'Arial'
                }
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Jumlah (IDR)',
                font: {
                  size: 12,
                  weight: 'bold',
                  family: 'Arial'
                },
                color: '#333333'
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                callback: function(value) {
                  return formatCurrencyShort(value);
                },
                color: '#333333',
                font: {
                  size: 10,
                  family: 'Arial'
                }
              }
            }
          }
        }
      };
      
      filename = `bar_chart_${userId}_3months_${Date.now()}.png`;
    }
    
    // Generate chart using QuickChart API with white background
    const chartUrl = `https://quickchart.io/chart?backgroundColor=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}&width=800&height=600&format=png`;
    
    const response = await axios({
      method: 'get',
      url: chartUrl,
      responseType: 'stream',
      timeout: 10000 // 10 second timeout
    });
    
    const filepath = path.join('./uploads/charts', filename);
    const writer = fs.createWriteStream(filepath);
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info('Chart generated using QuickChart API with white background', { userId, chartType, filename });
        resolve(filepath);
      });
      writer.on('error', (error) => {
        logger.error('Error writing chart file', { error: error.message });
        reject(error);
      });
      
      // Add timeout handling
      setTimeout(() => {
        writer.destroy();
        reject(new Error('Chart generation timeout'));
      }, 15000);
    });
    
  } catch (error) {
    logger.error('Error generating chart with QuickChart', { userId, chartType, error: error.message });
    return null;
  }
}

// Generate text-based chart (fallback)
async function generateTextChart(userId, chartType, period = 'month') {
  try {
    if (chartType === 'line') {
      const dailyData = await getDailyData(userId, period);
      const monthTransactions = await getTransactions(userId, period);
      const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      let chart = `📈 *TREND KEUANGAN ${period.toUpperCase()}*\n\n`;
      chart += `💰 Total Pemasukan: ${formatCurrency(income)}\n`;
      chart += `💸 Total Pengeluaran: ${formatCurrency(expense)}\n`;
      chart += `📊 Net Saldo: ${formatCurrency(income - expense)}\n\n`;
      
      if (dailyData.length > 0) {
        chart += `📅 *Trend Harian (7 hari terakhir):*\n`;
        const recentDays = dailyData.slice(-7);
        recentDays.forEach(day => {
          const date = moment(day.date).format('DD/MM');
          const type = day.type === 'income' ? '💰' : '💸';
          chart += `${date}: ${type} ${formatCurrency(day.total)}\n`;
        });
      }
      
      return chart;
      
    } else if (chartType === 'pie') {
      const categorySummary = await getCategorySummary(userId, period);
      const expenseData = categorySummary.filter(s => s.type === 'expense');
      const total = expenseData.reduce((sum, s) => sum + s.total, 0);
      
      let chart = `🥧 *BREAKDOWN PENGELUARAN ${period.toUpperCase()}*\n\n`;
      chart += `💸 Total: ${formatCurrency(total)}\n\n`;
      
      expenseData.forEach((category, i) => {
        const percentage = ((category.total / total) * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(percentage / 5));
        chart += `${i + 1}. ${category.category}: ${percentage}%\n`;
        chart += `   ${bar} ${formatCurrency(category.total)}\n\n`;
      });
      
      return chart;
      
    } else if (chartType === 'bar') {
      const currentMonth = await getTransactions(userId, 'month');
      const currentIncome = currentMonth.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const currentExpense = currentMonth.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      
      let chart = `📊 *PERBANDINGAN BULANAN*\n\n`;
      chart += `📅 Bulan Ini:\n`;
      chart += `💰 Pemasukan: ${formatCurrency(currentIncome)}\n`;
      chart += `💸 Pengeluaran: ${formatCurrency(currentExpense)}\n`;
      chart += `📈 Net: ${formatCurrency(currentIncome - currentExpense)}\n\n`;
      
      // Simple comparison bars
      const maxAmount = Math.max(currentIncome, currentExpense);
      const incomeBar = '█'.repeat(Math.round((currentIncome / maxAmount) * 20));
      const expenseBar = '█'.repeat(Math.round((currentExpense / maxAmount) * 20));
      
      chart += `💰 Pemasukan: ${incomeBar}\n`;
      chart += `💸 Pengeluaran: ${expenseBar}\n`;
      
      return chart;
    }
    
  } catch (error) {
    logger.error('Error generating text chart', { userId, chartType, error: error.message });
    return `❌ Gagal membuat ${chartType} chart`;
  }
}

// Clean up old chart files
function cleanupCharts() {
  try {
    const files = fs.readdirSync('./uploads/charts');
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    files.forEach(file => {
      const filepath = path.join('./uploads/charts', file);
      const stats = fs.statSync(filepath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filepath);
        logger.debug('Old chart file deleted', { file });
      }
    });
  } catch (error) {
    logger.error('Error cleaning up charts', { error: error.message });
  }
}

// Clean up charts every hour
setInterval(cleanupCharts, 60 * 60 * 1000);

module.exports = {
  generateQuickChart,
  generateTextChart,
  cleanupCharts
};