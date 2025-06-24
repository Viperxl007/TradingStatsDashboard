import { useState, useEffect, useCallback } from 'react';
import { liquidityTrackingService } from '../services/liquidityTrackingService';
import { CLPosition } from '../types/liquidityTracking';

interface PriceData {
  [positionId: string]: {
    data: any;
    loading: boolean;
    error: string | null;
    lastUpdated: Date;
  };
}

interface UseRealTimePricesReturn {
  priceData: PriceData;
  fetchPrice: (positionId: string) => Promise<void>;
  fetchAllPrices: (positions: CLPosition[]) => Promise<void>;
  refreshPrice: (positionId: string) => Promise<void>;
  isLoading: (positionId: string) => boolean;
  getError: (positionId: string) => string | null;
  getData: (positionId: string) => any | null;
}

export const useRealTimePrices = (): UseRealTimePricesReturn => {
  const [priceData, setPriceData] = useState<PriceData>({});

  const fetchPrice = useCallback(async (positionId: string) => {
    // Set loading state
    setPriceData(prev => ({
      ...prev,
      [positionId]: {
        ...prev[positionId],
        loading: true,
        error: null
      }
    }));

    try {
      const response = await liquidityTrackingService.priceHistory.getCurrentPrice(positionId);
      
      if (response.success && response.data) {
        setPriceData(prev => ({
          ...prev,
          [positionId]: {
            data: response.data,
            loading: false,
            error: null,
            lastUpdated: new Date()
          }
        }));
      } else {
        setPriceData(prev => ({
          ...prev,
          [positionId]: {
            ...prev[positionId],
            loading: false,
            error: response.error || 'Failed to fetch price data'
          }
        }));
      }
    } catch (error) {
      setPriceData(prev => ({
        ...prev,
        [positionId]: {
          ...prev[positionId],
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      }));
    }
  }, []);

  const fetchAllPrices = useCallback(async (positions: CLPosition[]) => {
    // Only fetch prices for positions that have token addresses
    const positionsWithAddresses = positions.filter(
      pos => pos.token0_address && pos.token1_address
    );

    const promises = positionsWithAddresses.map(position => 
      fetchPrice(position.id)
    );

    await Promise.allSettled(promises);
  }, [fetchPrice]);

  const refreshPrice = useCallback(async (positionId: string) => {
    await fetchPrice(positionId);
  }, [fetchPrice]);

  const isLoading = useCallback((positionId: string): boolean => {
    return priceData[positionId]?.loading || false;
  }, [priceData]);

  const getError = useCallback((positionId: string): string | null => {
    return priceData[positionId]?.error || null;
  }, [priceData]);

  const getData = useCallback((positionId: string): any | null => {
    return priceData[positionId]?.data || null;
  }, [priceData]);

  // Auto-refresh prices every 30 seconds for positions that have been fetched
  useEffect(() => {
    const interval = setInterval(() => {
      const positionIds = Object.keys(priceData).filter(
        id => priceData[id]?.data && !priceData[id]?.loading
      );

      if (positionIds.length > 0) {
        positionIds.forEach(id => {
          // Only refresh if last update was more than 30 seconds ago
          const lastUpdated = priceData[id]?.lastUpdated;
          if (lastUpdated && Date.now() - lastUpdated.getTime() > 30000) {
            fetchPrice(id);
          }
        });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [priceData, fetchPrice]);

  return {
    priceData,
    fetchPrice,
    fetchAllPrices,
    refreshPrice,
    isLoading,
    getError,
    getData
  };
};

export default useRealTimePrices;