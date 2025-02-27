import { read, utils } from 'xlsx';
import { TradeData } from '../types';
import * as dateFns from 'date-fns';

/**
 * Import data from an Excel file
 * @param file Excel file to import
 * @returns Promise resolving to an array of TradeData objects
 */
export const importData = async (file: File): Promise<TradeData[]> => {
  try {
    const fileData = await file.arrayBuffer();
    const workbook = read(fileData);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const jsonData = utils.sheet_to_json(worksheet);
    console.log('Raw imported data:', jsonData);
    
    // Transform the data to match our TradeData interface
    const transformedData = transformData(jsonData);
    
    // Filter out duplicates
    const uniqueData = filterDuplicates(transformedData);
    
    return uniqueData;
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};

/**
 * Transform raw data to match our TradeData interface
 * @param data Raw data from Excel file
 * @returns Array of TradeData objects
 */
export const transformData = (data: any[]): TradeData[] => {
  const transformedData: TradeData[] = [];
  
  data.forEach((row, index) => {
    try {
      // Skip rows that don't have essential data
      if (!row || typeof row !== 'object') {
        console.log(`Skipping row ${index + 1}: Not an object`);
        return;
      }
      
      // Extract fields from the actual trading data format
      const timeStr = extractField(row, ['time', 'Time', 'TIME', 'date', 'Date'], '');
      const token = extractField(row, ['coin', 'Coin', 'COIN', 'token', 'Token', 'symbol', 'Symbol'], 'UNKNOWN');
      const direction = extractField(row, ['dir', 'Dir', 'direction', 'Direction', 'type', 'Type'], '');
      const price = parseFloat(extractField(row, ['px', 'Px', 'price', 'Price'], '0'));
      const amount = parseFloat(extractField(row, ['sz', 'Sz', 'size', 'Size', 'amount', 'Amount'], '0'));
      const notional = parseFloat(extractField(row, ['ntl', 'Ntl', 'notional', 'Notional', 'totalValue'], '0'));
      const fee = parseFloat(extractField(row, ['fee', 'Fee', 'fees', 'Fees'], '0'));
      const closedPnl = parseFloat(extractField(row, ['closedPnl', 'ClosedPnl', 'pnl', 'PNL', 'profitLoss'], '0'));
      
      // Parse date
      let date = '';
      let timestamp = 0;
      
      if (timeStr) {
        try {
          // Handle the format "MM/DD/YYYY - HH:MM:SS"
          const dateObj = new Date(timeStr.replace(' - ', ' '));
          if (dateFns.isValid(dateObj)) {
            date = dateFns.format(dateObj, 'yyyy-MM-dd');
            timestamp = dateObj.getTime();
          } else {
            date = String(timeStr);
            timestamp = Date.now(); // Use current timestamp as fallback
          }
        } catch (e) {
          date = String(timeStr);
          timestamp = Date.now(); // Use current timestamp as fallback
        }
      } else {
        date = dateFns.format(new Date(), 'yyyy-MM-dd');
        timestamp = Date.now();
      }
      
      // Determine trade type based on direction
      let type: 'buy' | 'sell';
      let profitLoss = 0;
      
      // Normalize direction to determine trade type
      const dirLower = direction.toLowerCase();
      
      if (dirLower.includes('open long') || dirLower.includes('buy')) {
        type = 'buy';
        // For opening trades, profit/loss is 0 (the closedPnl is just the negative of the fee)
        profitLoss = 0;
      } else if (dirLower.includes('close long') || dirLower.includes('close short') || dirLower.includes('sell')) {
        type = 'sell';
        // For closing trades, use the actual profit/loss
        profitLoss = closedPnl;
      } else if (dirLower.includes('open short')) {
        // For open short, we'll treat it as 'sell' in our system
        type = 'sell';
        profitLoss = 0;
      } else {
        // Default to 'buy' if we can't determine
        type = 'buy';
        profitLoss = 0;
      }
      
      // Calculate total value if not provided
      const totalValue = notional || (amount * price);
      
      // Create TradeData object
      const tradeData: TradeData = {
        id: String(index + 1), // Use row index as ID
        token: String(token).toUpperCase(),
        date,
        timestamp,
        type,
        amount: isNaN(amount) ? 0 : amount,
        price: isNaN(price) ? 0 : price,
        totalValue: isNaN(totalValue) ? 0 : totalValue,
        profitLoss: isNaN(profitLoss) ? 0 : profitLoss,
        fees: isNaN(fee) ? 0 : fee,
        exchange: direction, // Store the original direction in the exchange field for reference
        notes: `${direction} trade`, // Add direction as a note
      };
      
      transformedData.push(tradeData);
    } catch (error) {
      console.error(`Error transforming row ${index + 1}:`, error);
      // Skip this row and continue with the next one
    }
  });
  
  return transformedData;
};

/**
 * Extract a field from a row using multiple possible field names
 * @param row Row data
 * @param fieldNames Possible field names
 * @param defaultValue Default value if field not found
 * @returns Field value or default value
 */
const extractField = (row: any, fieldNames: string[], defaultValue: string): string => {
  for (const fieldName of fieldNames) {
    if (row[fieldName] !== undefined && row[fieldName] !== null) {
      return String(row[fieldName]);
    }
  }
  return defaultValue;
};

/**
 * Normalize trade type to 'buy' or 'sell'
 * @param type Raw trade type
 * @returns Normalized trade type
 */
const normalizeTradeType = (type: string): 'buy' | 'sell' => {
  const buyTerms = ['buy', 'bid', 'long', 'purchase', 'acquire', 'b'];
  const sellTerms = ['sell', 'ask', 'short', 'dispose', 's'];
  
  type = type.toLowerCase().trim();
  
  if (buyTerms.includes(type)) {
    return 'buy';
  } else if (sellTerms.includes(type)) {
    return 'sell';
  }
  
  // Default to 'buy' if unknown
  return 'buy';
};

/**
 * Filter out duplicate trades
 * @param data Array of TradeData objects
 * @returns Array of unique TradeData objects
 */
export const filterDuplicates = (data: TradeData[]): TradeData[] => {
  const uniqueTrades = new Map<string, TradeData>();
  
  data.forEach(trade => {
    // Use id as the unique key
    if (!uniqueTrades.has(trade.id)) {
      uniqueTrades.set(trade.id, trade);
    }
  });
  
  return Array.from(uniqueTrades.values());
};

/**
 * Check if a trade is a duplicate
 * @param trade Trade to check
 * @param data Array of existing trades
 * @returns Boolean indicating if the trade is a duplicate
 */
export const isDuplicate = (trade: TradeData, data: TradeData[]): boolean => {
  return data.some(existingTrade => existingTrade.id === trade.id);
};