import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  HStack,
  Badge,
  Select,
  Spacer,
  Center,
  Spinner
} from '@chakra-ui/react';
import { AnyTradeEntry, StrategyType } from '../../types/tradeTracker';

// Import chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StatisticsChartProps {
  trades: AnyTradeEntry[];
  timeFrame?: string;
  strategyFilter?: StrategyType;
}

/**
 * StatisticsChart Component
 * 
 * This component visualizes trade performance data using charts.
 */
const StatisticsChart: React.FC<StatisticsChartProps> = ({ 
  trades, 
  timeFrame = 'all',
  strategyFilter
}) => {
  const [chartType, setChartType] = useState<'cumulative' | 'monthly' | 'strategy' | 'winLoss'>('cumulative');
  const [chartData, setChartData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  const lineColor = useColorModeValue('rgba(49, 130, 206, 1)', 'rgba(99, 179, 237, 1)');
  const gridColor = useColorModeValue('rgba(0, 0, 0, 0.1)', 'rgba(255, 255, 255, 0.1)');
  const textColor = useColorModeValue('rgba(0, 0, 0, 0.7)', 'rgba(255, 255, 255, 0.7)');
  
  // Filter trades based on time frame and strategy
  useEffect(() => {
    setIsLoading(true);
    
    // Filter trades based on time frame
    let filteredTrades = [...trades];
    
    // Only include closed trades with profit/loss data
    filteredTrades = filteredTrades.filter(trade => 
      trade.status === 'closed' && trade.profitLoss !== undefined
    );
    
    // Apply time frame filter
    const now = new Date();
    
    switch (timeFrame) {
      case 'ytd':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.exitDate || trade.entryDate) >= startOfYear
        );
        break;
      case '1m':
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.exitDate || trade.entryDate) >= oneMonthAgo
        );
        break;
      case '3m':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.exitDate || trade.entryDate) >= threeMonthsAgo
        );
        break;
      case '6m':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.exitDate || trade.entryDate) >= sixMonthsAgo
        );
        break;
      case '1y':
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        filteredTrades = filteredTrades.filter(trade => 
          new Date(trade.exitDate || trade.entryDate) >= oneYearAgo
        );
        break;
      default:
        // 'all' - no additional filtering
        break;
    }
    
    // Apply strategy filter
    if (strategyFilter) {
      filteredTrades = filteredTrades.filter(trade => trade.strategy === strategyFilter);
    }
    
    // Sort trades by date
    filteredTrades.sort((a, b) => {
      const dateA = new Date(a.exitDate || a.entryDate);
      const dateB = new Date(b.exitDate || b.entryDate);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Generate chart data based on chart type
    generateChartData(filteredTrades);
    
  }, [trades, timeFrame, strategyFilter, chartType]);
  
  // Generate chart data based on chart type
  const generateChartData = (filteredTrades: AnyTradeEntry[]) => {
    if (filteredTrades.length === 0) {
      setChartData(null);
      setIsLoading(false);
      return;
    }
    
    switch (chartType) {
      case 'cumulative':
        generateCumulativePnLChart(filteredTrades);
        break;
      case 'monthly':
        generateMonthlyPnLChart(filteredTrades);
        break;
      case 'strategy':
        generateStrategyComparisonChart(filteredTrades);
        break;
      case 'winLoss':
        generateWinLossChart(filteredTrades);
        break;
      default:
        generateCumulativePnLChart(filteredTrades);
    }
  };
  
  // Generate cumulative P&L chart
  const generateCumulativePnLChart = (filteredTrades: AnyTradeEntry[]) => {
    // Calculate cumulative P&L
    let cumulativePnL = 0;
    const labels: string[] = [];
    const data: number[] = [];
    
    filteredTrades.forEach(trade => {
      if (trade.profitLoss !== undefined) {
        cumulativePnL += trade.profitLoss;
        
        // Format date for label
        const date = new Date(trade.exitDate || trade.entryDate);
        const label = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: '2-digit'
        });
        
        labels.push(label);
        data.push(cumulativePnL);
      }
    });
    
    // Create chart data
    const chartData = {
      labels,
      datasets: [
        {
          label: 'Cumulative P&L',
          data,
          borderColor: lineColor,
          backgroundColor: 'rgba(49, 130, 206, 0.2)',
          fill: true,
          tension: 0.1
        }
      ]
    };
    
    setChartData(chartData);
    setIsLoading(false);
  };
  
  // Generate monthly P&L chart
  const generateMonthlyPnLChart = (filteredTrades: AnyTradeEntry[]) => {
    // Group trades by month
    const monthlyData: Record<string, number> = {};
    
    filteredTrades.forEach(trade => {
      if (trade.profitLoss !== undefined) {
        const date = new Date(trade.exitDate || trade.entryDate);
        const monthYear = date.toLocaleDateString('en-US', { 
          month: 'short', 
          year: 'numeric'
        });
        
        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = 0;
        }
        
        monthlyData[monthYear] += trade.profitLoss;
      }
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Create chart data
    const chartData = {
      labels: sortedMonths,
      datasets: [
        {
          label: 'Monthly P&L',
          data: sortedMonths.map(month => monthlyData[month]),
          backgroundColor: sortedMonths.map(month => 
            monthlyData[month] >= 0 ? 'rgba(72, 187, 120, 0.7)' : 'rgba(245, 101, 101, 0.7)'
          ),
          borderColor: sortedMonths.map(month => 
            monthlyData[month] >= 0 ? 'rgba(72, 187, 120, 1)' : 'rgba(245, 101, 101, 1)'
          ),
          borderWidth: 1
        }
      ]
    };
    
    setChartData(chartData);
    setIsLoading(false);
  };
  
  // Generate strategy comparison chart
  const generateStrategyComparisonChart = (filteredTrades: AnyTradeEntry[]) => {
    // Group trades by strategy
    const strategyData: Record<string, { pnl: number; count: number }> = {};
    
    filteredTrades.forEach(trade => {
      if (trade.profitLoss !== undefined) {
        const strategy = trade.strategy;
        
        if (!strategyData[strategy]) {
          strategyData[strategy] = { pnl: 0, count: 0 };
        }
        
        strategyData[strategy].pnl += trade.profitLoss;
        strategyData[strategy].count += 1;
      }
    });
    
    // Sort strategies by P&L
    const sortedStrategies = Object.keys(strategyData).sort((a, b) => 
      strategyData[b].pnl - strategyData[a].pnl
    );
    
    // Create chart data
    const chartData = {
      labels: sortedStrategies.map(strategy => strategy.replace('_', ' ')),
      datasets: [
        {
          label: 'P&L by Strategy',
          data: sortedStrategies.map(strategy => strategyData[strategy].pnl),
          backgroundColor: sortedStrategies.map(strategy => 
            strategyData[strategy].pnl >= 0 ? 'rgba(72, 187, 120, 0.7)' : 'rgba(245, 101, 101, 0.7)'
          ),
          borderColor: sortedStrategies.map(strategy => 
            strategyData[strategy].pnl >= 0 ? 'rgba(72, 187, 120, 1)' : 'rgba(245, 101, 101, 1)'
          ),
          borderWidth: 1
        }
      ]
    };
    
    setChartData(chartData);
    setIsLoading(false);
  };
  
  // Generate win/loss chart
  const generateWinLossChart = (filteredTrades: AnyTradeEntry[]) => {
    // Count wins and losses
    let wins = 0;
    let losses = 0;
    
    filteredTrades.forEach(trade => {
      if (trade.profitLoss !== undefined) {
        if (trade.profitLoss > 0) {
          wins++;
        } else {
          losses++;
        }
      }
    });
    
    // Create chart data
    const chartData = {
      labels: ['Winning Trades', 'Losing Trades'],
      datasets: [
        {
          data: [wins, losses],
          backgroundColor: ['rgba(72, 187, 120, 0.7)', 'rgba(245, 101, 101, 0.7)'],
          borderColor: ['rgba(72, 187, 120, 1)', 'rgba(245, 101, 101, 1)'],
          borderWidth: 1
        }
      ]
    };
    
    setChartData(chartData);
    setIsLoading(false);
  };
  
  // Chart options
  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor,
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor,
          callback: function(tickValue: string | number) {
            if (typeof tickValue === 'number') {
              return '$' + tickValue.toLocaleString();
            }
            return tickValue;
          }
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: textColor
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  };
  
  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor
        }
      },
      y: {
        grid: {
          color: gridColor
        },
        ticks: {
          color: textColor,
          callback: function(tickValue: string | number) {
            if (typeof tickValue === 'number') {
              return '$' + tickValue.toLocaleString();
            }
            return tickValue;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  };
  
  const pieChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw as number;
            const total = (context.chart.data.datasets[0].data as number[]).reduce((a, b) => (a as number) + (b as number), 0);
            const percentage = Math.round(value / (total as number) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };
  
  // Handle chart type change
  const handleChartTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setChartType(e.target.value as 'cumulative' | 'monthly' | 'strategy' | 'winLoss');
  };
  
  return (
    <Box>
      <Flex mb={4} alignItems="center">
        <HStack spacing={2}>
          <Badge 
            colorScheme={chartType === 'cumulative' ? 'brand' : 'gray'} 
            px={3} py={1} 
            borderRadius="full" 
            cursor="pointer"
            onClick={() => setChartType('cumulative')}
          >
            Cumulative P&L
          </Badge>
          <Badge 
            colorScheme={chartType === 'monthly' ? 'brand' : 'gray'} 
            px={3} py={1} 
            borderRadius="full" 
            cursor="pointer"
            onClick={() => setChartType('monthly')}
          >
            Monthly P&L
          </Badge>
          <Badge 
            colorScheme={chartType === 'strategy' ? 'brand' : 'gray'} 
            px={3} py={1} 
            borderRadius="full" 
            cursor="pointer"
            onClick={() => setChartType('strategy')}
          >
            By Strategy
          </Badge>
          <Badge 
            colorScheme={chartType === 'winLoss' ? 'brand' : 'gray'} 
            px={3} py={1} 
            borderRadius="full" 
            cursor="pointer"
            onClick={() => setChartType('winLoss')}
          >
            Win/Loss
          </Badge>
        </HStack>
        
        <Spacer />
        
        <Select
          value={chartType}
          onChange={handleChartTypeChange}
          width="auto"
          size="sm"
          display={{ base: 'block', md: 'none' }}
        >
          <option value="cumulative">Cumulative P&L</option>
          <option value="monthly">Monthly P&L</option>
          <option value="strategy">By Strategy</option>
          <option value="winLoss">Win/Loss</option>
        </Select>
      </Flex>
      
      <Box height="400px" position="relative">
        {isLoading ? (
          <Center height="100%">
            <Spinner size="xl" color="brand.500" />
          </Center>
        ) : chartData ? (
          <>
            {chartType === 'cumulative' && (
              <Line data={chartData} options={lineChartOptions} />
            )}
            {chartType === 'monthly' && (
              <Bar data={chartData} options={barChartOptions} />
            )}
            {chartType === 'strategy' && (
              <Bar data={chartData} options={barChartOptions} />
            )}
            {chartType === 'winLoss' && (
              <Bar data={chartData} options={pieChartOptions} />
            )}
          </>
        ) : (
          <Center height="100%">
            <Text color="gray.500">No data available for the selected filters</Text>
          </Center>
        )}
      </Box>
    </Box>
  );
};

export default StatisticsChart;