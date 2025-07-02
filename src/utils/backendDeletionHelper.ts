/**
 * Backend Deletion Helper
 * 
 * Provides direct deletion capabilities for backend trades when the standard
 * close API is insufficient for complete removal.
 */

/**
 * Delete a trade directly from the backend database
 * This bypasses the normal "close" workflow and removes the record entirely
 */
export const deleteTradeFromBackend = async (
  ticker: string,
  reason: string = 'Direct deletion requested'
): Promise<boolean> => {
  try {
    console.log(`🗑️ [Backend Delete] Attempting direct deletion of ${ticker} from backend`);
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: reason,
        force: true
      }),
    });
    
    if (!response.ok) {
      // If the delete endpoint doesn't exist, try the close endpoint as fallback
      if (response.status === 404) {
        console.log(`⚠️ [Backend Delete] Delete endpoint not found, falling back to close`);
        return await fallbackCloseTradeInBackend(ticker, reason);
      }
      
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [Backend Delete] Successfully deleted ${ticker} from backend`);
    return result.success || true;
    
  } catch (error) {
    console.error(`❌ [Backend Delete] Error deleting ${ticker} from backend:`, error);
    
    // Try fallback close method
    console.log(`🔄 [Backend Delete] Attempting fallback close method for ${ticker}`);
    return await fallbackCloseTradeInBackend(ticker, reason);
  }
};

/**
 * Fallback method using the existing close API
 */
const fallbackCloseTradeInBackend = async (
  ticker: string, 
  reason: string
): Promise<boolean> => {
  try {
    // Get current price for the ticker (using a reasonable default)
    const currentPrice = await getCurrentPrice(ticker);
    
    const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_price: currentPrice,
        notes: `${reason} - Forced closure for deletion`,
        force_close: true
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ [Backend Delete] Successfully closed ${ticker} in backend (fallback method)`);
    return result.success || true;
    
  } catch (error) {
    console.error(`❌ [Backend Delete] Fallback close failed for ${ticker}:`, error);
    return false;
  }
};

/**
 * Get current price for a ticker (with fallback defaults)
 */
const getCurrentPrice = async (ticker: string): Promise<number> => {
  try {
    // Try to get real current price
    const response = await fetch(`http://localhost:5000/api/market-data/${ticker}/current`);
    
    if (response.ok) {
      const data = await response.json();
      return data.price || getDefaultPrice(ticker);
    }
    
    return getDefaultPrice(ticker);
    
  } catch (error) {
    console.warn(`⚠️ Could not fetch current price for ${ticker}, using default`);
    return getDefaultPrice(ticker);
  }
};

/**
 * Default prices for common tickers when real price is unavailable
 */
const getDefaultPrice = (ticker: string): number => {
  const defaults: Record<string, number> = {
    'SOLUSD': 153.50,
    'BTCUSD': 45000,
    'ETHUSD': 2500,
    'ADAUSD': 0.50
  };
  
  return defaults[ticker] || 100; // Generic fallback
};

/**
 * Force delete all trades for a specific ticker from backend
 */
export const forceDeleteAllTickerTrades = async (
  ticker: string,
  reason: string = 'Bulk deletion requested'
): Promise<{
  success: boolean;
  deletedCount: number;
  errors: string[];
}> => {
  const result = {
    success: true,
    deletedCount: 0,
    errors: [] as string[]
  };
  
  try {
    console.log(`🧹 [Backend Bulk Delete] Starting bulk deletion for ${ticker}`);
    
    // Try bulk delete endpoint first
    const bulkResponse = await fetch(`http://localhost:5000/api/active-trades/bulk-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticker: ticker,
        reason: reason,
        force: true
      }),
    });
    
    if (bulkResponse.ok) {
      const bulkResult = await bulkResponse.json();
      result.deletedCount = bulkResult.deleted_count || 0;
      console.log(`✅ [Backend Bulk Delete] Bulk deleted ${result.deletedCount} ${ticker} trades`);
      return result;
    }
    
    // If bulk delete not available, fall back to individual deletion
    console.log(`⚠️ [Backend Bulk Delete] Bulk endpoint not available, using individual deletion`);
    
    const deleteSuccess = await deleteTradeFromBackend(ticker, reason);
    if (deleteSuccess) {
      result.deletedCount = 1;
    } else {
      result.success = false;
      result.errors.push(`Failed to delete ${ticker} trade`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ [Backend Bulk Delete] Error during bulk deletion:`, error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return result;
  }
};