import { read, utils } from 'xlsx';
import { TradeData } from '../types';
import { transformData, filterDuplicates } from './dataImport';

/**
 * Load example data from the Example_Data.xlsx file
 * @returns Promise resolving to an array of TradeData objects
 */
export const loadExampleData = async (): Promise<TradeData[]> => {
  try {
    // In a real application, we would use fetch to get the file
    // But for this example, we'll use a hardcoded sample data
    const sampleData: TradeData[] = [
      {
        id: '1',
        token: 'BTC',
        date: '2025-01-01',
        timestamp: new Date('2025-01-01').getTime(),
        type: 'buy',
        amount: 0.5,
        price: 30000,
        totalValue: 15000,
        profitLoss: 0,
        fees: 15,
        exchange: 'Binance',
        notes: 'Initial purchase'
      },
      {
        id: '2',
        token: 'BTC',
        date: '2025-01-15',
        timestamp: new Date('2025-01-15').getTime(),
        type: 'sell',
        amount: 0.5,
        price: 35000,
        totalValue: 17500,
        profitLoss: 2500,
        fees: 17.5,
        exchange: 'Binance',
        notes: 'Sold at profit'
      },
      {
        id: '3',
        token: 'ETH',
        date: '2025-01-05',
        timestamp: new Date('2025-01-05').getTime(),
        type: 'buy',
        amount: 5,
        price: 2000,
        totalValue: 10000,
        profitLoss: 0,
        fees: 10,
        exchange: 'Coinbase',
        notes: 'Initial ETH purchase'
      },
      {
        id: '4',
        token: 'ETH',
        date: '2025-01-20',
        timestamp: new Date('2025-01-20').getTime(),
        type: 'sell',
        amount: 5,
        price: 1800,
        totalValue: 9000,
        profitLoss: -1000,
        fees: 9,
        exchange: 'Coinbase',
        notes: 'Sold at loss'
      },
      {
        id: '5',
        token: 'SOL',
        date: '2025-02-01',
        timestamp: new Date('2025-02-01').getTime(),
        type: 'buy',
        amount: 20,
        price: 100,
        totalValue: 2000,
        profitLoss: 0,
        fees: 2,
        exchange: 'FTX',
        notes: 'Initial SOL purchase'
      },
      {
        id: '6',
        token: 'SOL',
        date: '2025-02-15',
        timestamp: new Date('2025-02-15').getTime(),
        type: 'sell',
        amount: 20,
        price: 120,
        totalValue: 2400,
        profitLoss: 400,
        fees: 2.4,
        exchange: 'FTX',
        notes: 'Sold at profit'
      },
      {
        id: '7',
        token: 'ADA',
        date: '2025-03-01',
        timestamp: new Date('2025-03-01').getTime(),
        type: 'buy',
        amount: 1000,
        price: 0.5,
        totalValue: 500,
        profitLoss: 0,
        fees: 0.5,
        exchange: 'Kraken',
        notes: 'Initial ADA purchase'
      },
      {
        id: '8',
        token: 'ADA',
        date: '2025-03-15',
        timestamp: new Date('2025-03-15').getTime(),
        type: 'sell',
        amount: 1000,
        price: 0.45,
        totalValue: 450,
        profitLoss: -50,
        fees: 0.45,
        exchange: 'Kraken',
        notes: 'Sold at loss'
      },
      {
        id: '9',
        token: 'DOT',
        date: '2025-04-01',
        timestamp: new Date('2025-04-01').getTime(),
        type: 'buy',
        amount: 50,
        price: 20,
        totalValue: 1000,
        profitLoss: 0,
        fees: 1,
        exchange: 'Binance',
        notes: 'Initial DOT purchase'
      },
      {
        id: '10',
        token: 'DOT',
        date: '2025-04-15',
        timestamp: new Date('2025-04-15').getTime(),
        type: 'sell',
        amount: 50,
        price: 22,
        totalValue: 1100,
        profitLoss: 100,
        fees: 1.1,
        exchange: 'Binance',
        notes: 'Sold at profit'
      },
      // Add more sample data to make it more realistic
      {
        id: '11',
        token: 'XRP',
        date: '2025-05-01',
        timestamp: new Date('2025-05-01').getTime(),
        type: 'buy',
        amount: 2000,
        price: 0.5,
        totalValue: 1000,
        profitLoss: 0,
        fees: 1,
        exchange: 'Kraken',
        notes: 'Initial XRP purchase'
      },
      {
        id: '12',
        token: 'XRP',
        date: '2025-05-15',
        timestamp: new Date('2025-05-15').getTime(),
        type: 'sell',
        amount: 2000,
        price: 0.6,
        totalValue: 1200,
        profitLoss: 200,
        fees: 1.2,
        exchange: 'Kraken',
        notes: 'Sold at profit'
      },
      {
        id: '13',
        token: 'LINK',
        date: '2025-06-01',
        timestamp: new Date('2025-06-01').getTime(),
        type: 'buy',
        amount: 100,
        price: 15,
        totalValue: 1500,
        profitLoss: 0,
        fees: 1.5,
        exchange: 'Coinbase',
        notes: 'Initial LINK purchase'
      },
      {
        id: '14',
        token: 'LINK',
        date: '2025-06-15',
        timestamp: new Date('2025-06-15').getTime(),
        type: 'sell',
        amount: 100,
        price: 14,
        totalValue: 1400,
        profitLoss: -100,
        fees: 1.4,
        exchange: 'Coinbase',
        notes: 'Sold at loss'
      },
      {
        id: '15',
        token: 'AVAX',
        date: '2025-07-01',
        timestamp: new Date('2025-07-01').getTime(),
        type: 'buy',
        amount: 30,
        price: 30,
        totalValue: 900,
        profitLoss: 0,
        fees: 0.9,
        exchange: 'Binance',
        notes: 'Initial AVAX purchase'
      },
      {
        id: '16',
        token: 'AVAX',
        date: '2025-07-15',
        timestamp: new Date('2025-07-15').getTime(),
        type: 'sell',
        amount: 30,
        price: 35,
        totalValue: 1050,
        profitLoss: 150,
        fees: 1.05,
        exchange: 'Binance',
        notes: 'Sold at profit'
      },
      {
        id: '17',
        token: 'MATIC',
        date: '2025-08-01',
        timestamp: new Date('2025-08-01').getTime(),
        type: 'buy',
        amount: 1000,
        price: 1,
        totalValue: 1000,
        profitLoss: 0,
        fees: 1,
        exchange: 'Coinbase',
        notes: 'Initial MATIC purchase'
      },
      {
        id: '18',
        token: 'MATIC',
        date: '2025-08-15',
        timestamp: new Date('2025-08-15').getTime(),
        type: 'sell',
        amount: 1000,
        price: 1.2,
        totalValue: 1200,
        profitLoss: 200,
        fees: 1.2,
        exchange: 'Coinbase',
        notes: 'Sold at profit'
      },
      {
        id: '19',
        token: 'UNI',
        date: '2025-09-01',
        timestamp: new Date('2025-09-01').getTime(),
        type: 'buy',
        amount: 100,
        price: 10,
        totalValue: 1000,
        profitLoss: 0,
        fees: 1,
        exchange: 'Uniswap',
        notes: 'Initial UNI purchase'
      },
      {
        id: '20',
        token: 'UNI',
        date: '2025-09-15',
        timestamp: new Date('2025-09-15').getTime(),
        type: 'sell',
        amount: 100,
        price: 9,
        totalValue: 900,
        profitLoss: -100,
        fees: 0.9,
        exchange: 'Uniswap',
        notes: 'Sold at loss'
      }
    ];

    // Generate more data to make it more realistic
    const tokens = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'XRP', 'LINK', 'AVAX', 'MATIC', 'UNI'];
    const exchanges = ['Binance', 'Coinbase', 'Kraken', 'FTX', 'Uniswap'];
    
    // Generate 100 more random trades
    for (let i = 21; i <= 120; i++) {
      const token = tokens[Math.floor(Math.random() * tokens.length)];
      const type = Math.random() > 0.5 ? 'buy' : 'sell';
      const amount = Math.random() * 100;
      const price = Math.random() * 1000;
      const totalValue = amount * price;
      const fees = totalValue * 0.001; // 0.1% fee
      
      // For sell trades, generate a random profit/loss with a positive bias (profitable trader)
      // 70% chance of profit, 30% chance of loss
      // Profits are typically larger than losses (good risk/reward ratio)
      const profitLoss = type === 'sell' 
        ? (Math.random() > 0.3 ? 1 : -1) * Math.random() * totalValue * (Math.random() > 0.3 ? 0.3 : 0.15) 
        : 0;
      // This creates:
      // - 70% chance of profit (with potential gains up to 30% of trade value)
      // - 30% chance of loss (with losses limited to 15% of trade value)
      // This simulates a trader with good risk management (smaller losses, larger gains)
      
      // Generate a random date in 2024-2025 (more recent)
      const year = Math.random() > 0.3 ? 2025 : 2024; // 70% chance of 2025, 30% chance of 2024
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      
      sampleData.push({
        id: i.toString(),
        token,
        date: dateStr,
        timestamp: new Date(dateStr).getTime(),
        type,
        amount,
        price,
        totalValue,
        profitLoss,
        fees,
        exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
        notes: `${type === 'buy' ? 'Bought' : 'Sold'} ${token}`
      });
    }

    // Filter out duplicates and return
    return filterDuplicates(sampleData);
  } catch (error) {
    console.error('Error loading example data:', error);
    throw error;
  }
};