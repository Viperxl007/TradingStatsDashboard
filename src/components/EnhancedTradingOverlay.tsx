import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries, LineStyle } from 'lightweight-charts';
import type { TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';

interface EnhancedTradingOverlayProps {
  chart: IChartApi | null;
  recommendation: TradingRecommendationType | null;
  currentTimeframe: string;
}

/**
 * Enhanced Trading Overlay Component
 * 
 * Creates a clean, modern trading position visualization with:
 * - Entry line with position direction indicator
 * - Target line with profit potential
 * - Stop loss line with risk indication
 * - Clean styling that doesn't overwhelm the chart
 */
const EnhancedTradingOverlay: React.FC<EnhancedTradingOverlayProps> = ({
  chart,
  recommendation,
  currentTimeframe
}) => {
  const overlaySeriesRef = useRef<any[]>([]);

  // Clear existing overlays
  const clearOverlays = () => {
    if (chart && overlaySeriesRef.current.length > 0) {
      overlaySeriesRef.current.forEach(series => {
        try {
          // Check if series is valid before removing
          if (series && typeof series === 'object') {
            chart.removeSeries(series);
          }
        } catch (error) {
          // Silently handle removal errors - series might already be removed
          console.debug('Trading overlay series already removed or invalid:', error instanceof Error ? error.message : 'Unknown error');
        }
      });
      overlaySeriesRef.current = [];
    }
  };

  // Create enhanced trading overlays
  const createTradingOverlays = () => {
    console.log(`🎯 [EnhancedTradingOverlay] DEBUG - Chart:`, !!chart, `Recommendation:`, !!recommendation, `Timeframe:`, currentTimeframe);
    console.log(`🎯 [EnhancedTradingOverlay] DEBUG - Recommendation data:`, recommendation);
    
    if (!chart || !recommendation || !recommendation.isActive) {
      console.log(`🎯 [EnhancedTradingOverlay] EARLY EXIT - Chart: ${!!chart}, Recommendation: ${!!recommendation}, Active: ${recommendation?.isActive}`);
      return;
    }

    // Only show overlays for the specific timeframe the AI analyzed
    if (currentTimeframe !== recommendation.timeframe) {
      console.log(`🎯 [EnhancedTradingOverlay] Skipping overlay - current timeframe ${currentTimeframe} doesn't match recommendation timeframe ${recommendation.timeframe}`);
      return;
    }

    console.log(`🎯 [EnhancedTradingOverlay] Creating enhanced trading overlays for ${recommendation.action} recommendation on ${recommendation.timeframe}`);

    try {
      // Get the time range for horizontal lines
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      
      if (!visibleRange) {
        console.warn('No visible range available for overlay, retrying in 200ms...');
        // Retry after chart has more time to render
        setTimeout(() => {
          if (chart && recommendation && recommendation.isActive) {
            createTradingOverlays();
          }
        }, 200);
        return;
      }

      const isLong = recommendation.action === 'buy';

      // Entry Price Line (Main position line) - Blue for entry
      if (recommendation.entryPrice) {
        const entryColor = '#3b82f6'; // Blue for entry point
        
        const entrySeries = chart.addSeries(LineSeries, {
          color: entryColor,
          lineWidth: 3,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: true,
          lastValueVisible: true,
          priceLineVisible: true,
          title: `Entry: $${recommendation.entryPrice.toFixed(2)}`,
        });

        // Create horizontal line data
        const entryData = [
          { time: visibleRange.from, value: recommendation.entryPrice },
          { time: visibleRange.to, value: recommendation.entryPrice }
        ];
        
        entrySeries.setData(entryData as any);
        overlaySeriesRef.current.push(entrySeries);
      }

      // Target Price Line - Green for profit target
      if (recommendation.targetPrice) {
        const targetColor = '#22c55e'; // Green for profit
        
        const targetSeries = chart.addSeries(LineSeries, {
          color: targetColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: true,
          lastValueVisible: true,
          priceLineVisible: true,
          title: `Target: $${recommendation.targetPrice.toFixed(2)}`,
        });

        const targetData = [
          { time: visibleRange.from, value: recommendation.targetPrice },
          { time: visibleRange.to, value: recommendation.targetPrice }
        ];
        
        targetSeries.setData(targetData as any);
        overlaySeriesRef.current.push(targetSeries);
      }

      // Stop Loss Line - Red for risk management
      if (recommendation.stopLoss) {
        const stopLossColor = '#ef4444'; // Red for risk
        
        const stopLossSeries = chart.addSeries(LineSeries, {
          color: stopLossColor,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: true,
          lastValueVisible: true,
          priceLineVisible: true,
          title: `Stop Loss: $${recommendation.stopLoss.toFixed(2)}`,
        });

        const stopLossData = [
          { time: visibleRange.from, value: recommendation.stopLoss },
          { time: visibleRange.to, value: recommendation.stopLoss }
        ];
        
        stopLossSeries.setData(stopLossData as any);
        overlaySeriesRef.current.push(stopLossSeries);
      }

      console.log(`✅ [EnhancedTradingOverlay] Created ${overlaySeriesRef.current.length} overlay series for ${recommendation.timeframe}`);

    } catch (error) {
      console.error('❌ [EnhancedTradingOverlay] Error creating trading overlays:', error);
    }
  };

  // Effect to manage overlays
  useEffect(() => {
    // Clear existing overlays first
    clearOverlays();

    // Create new overlays if we have a valid recommendation
    if (recommendation && recommendation.isActive) {
      // Longer delay to ensure chart is fully ready and has visible range
      const timeout = setTimeout(createTradingOverlays, 300);
      return () => clearTimeout(timeout);
    }

    // Cleanup function
    return () => {
      clearOverlays();
    };
  }, [chart, recommendation, currentTimeframe]);

  // Listen for global clear overlay events (e.g., when trades are closed)
  useEffect(() => {
    const handleClearOverlays = (event: CustomEvent) => {
      console.log('🧹 [EnhancedTradingOverlay] Received clear overlays event:', event.detail);
      clearOverlays();
    };

    window.addEventListener('clearChartOverlays', handleClearOverlays as EventListener);
    
    return () => {
      window.removeEventListener('clearChartOverlays', handleClearOverlays as EventListener);
    };
  }, [chart]);

  // This component doesn't render anything visible - it just manages chart overlays
  return null;
};

export default EnhancedTradingOverlay;