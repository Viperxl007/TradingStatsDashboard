import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineStyle, LineSeries } from 'lightweight-charts';
import type { TradingRecommendationOverlay as TradingRecommendationType, TradingAnnotation } from '../types/chartAnalysis';

interface TradingRecommendationOverlayProps {
  chart: IChartApi | null;
  recommendation: TradingRecommendationType | null;
  currentTimeframe: string;
  onOverlayUpdate?: (annotations: TradingAnnotation[]) => void;
}

/**
 * Trading Recommendation Overlay Component
 * 
 * Adds visual trading recommendation overlays to the chart including:
 * - Entry price line
 * - Target price line  
 * - Stop loss line
 * - Risk/reward zone visualization
 * 
 * Only displays overlays for the specific timeframe the AI provided feedback on
 */
const TradingRecommendationOverlay: React.FC<TradingRecommendationOverlayProps> = ({
  chart,
  recommendation,
  currentTimeframe,
  onOverlayUpdate
}) => {
  const overlaySeriesRef = useRef<any[]>([]);

  // Clear existing overlays
  const clearOverlays = () => {
    if (chart && overlaySeriesRef.current.length > 0) {
      overlaySeriesRef.current.forEach(series => {
        try {
          chart.removeSeries(series);
        } catch (error) {
          console.warn('Failed to remove overlay series:', error);
        }
      });
      overlaySeriesRef.current = [];
    }
  };

  // Add trading recommendation overlays using line series
  const addTradingOverlays = () => {
    if (!chart || !recommendation || !recommendation.isActive) {
      return;
    }

    // Only show overlays for the specific timeframe the AI analyzed
    if (currentTimeframe !== recommendation.timeframe) {
      console.log(`🎯 [TradingOverlay] Skipping overlay - current timeframe ${currentTimeframe} doesn't match recommendation timeframe ${recommendation.timeframe}`);
      return;
    }

    console.log(`🎯 [TradingOverlay] Adding trading overlays for ${recommendation.action} recommendation on ${recommendation.timeframe}`);

    const annotations: TradingAnnotation[] = [];

    try {
      // Get the time range for horizontal lines
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      
      if (!visibleRange) {
        console.warn('No visible range available for overlay');
        return;
      }

      // Entry Price Line
      if (recommendation.entryPrice) {
        const entryColor = recommendation.action === 'buy' ? '#10b981' : '#ef4444';
        
        const entrySeries = chart.addSeries(LineSeries, {
          color: entryColor,
          lineWidth: 3,
          lineStyle: LineStyle.Solid,
          crosshairMarkerVisible: false,
          lastValueVisible: true,
          priceLineVisible: true,
          title: `${recommendation.action.toUpperCase()} Entry: $${recommendation.entryPrice.toFixed(2)}`,
        });

        // Create horizontal line data
        const entryData = [
          { time: visibleRange.from, value: recommendation.entryPrice },
          { time: visibleRange.to, value: recommendation.entryPrice }
        ];
        
        entrySeries.setData(entryData as any);
        overlaySeriesRef.current.push(entrySeries);

        annotations.push({
          id: `entry-${recommendation.id}`,
          type: 'entry',
          price: recommendation.entryPrice,
          color: entryColor,
          label: `Entry: $${recommendation.entryPrice.toFixed(2)}`,
          description: `${recommendation.action.toUpperCase()} entry point`,
          visible: true,
          style: 'solid',
          width: 3,
          timeframe: recommendation.timeframe
        });
      }

      // Target Price Line
      if (recommendation.targetPrice) {
        const targetColor = '#22c55e';
        
        const targetSeries = chart.addSeries(LineSeries, {
          color: targetColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
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

        annotations.push({
          id: `target-${recommendation.id}`,
          type: 'target',
          price: recommendation.targetPrice,
          color: targetColor,
          label: `Target: $${recommendation.targetPrice.toFixed(2)}`,
          description: 'Price target for the trade',
          visible: true,
          style: 'dashed',
          width: 2,
          timeframe: recommendation.timeframe
        });
      }

      // Stop Loss Line
      if (recommendation.stopLoss) {
        const stopLossColor = '#ef4444';
        
        const stopLossSeries = chart.addSeries(LineSeries, {
          color: stopLossColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
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

        annotations.push({
          id: `stopLoss-${recommendation.id}`,
          type: 'stopLoss',
          price: recommendation.stopLoss,
          color: stopLossColor,
          label: `Stop Loss: $${recommendation.stopLoss.toFixed(2)}`,
          description: 'Stop loss level to limit risk',
          visible: true,
          style: 'dashed',
          width: 2,
          timeframe: recommendation.timeframe
        });
      }

      // Calculate and display risk/reward ratio
      if (recommendation.entryPrice && recommendation.targetPrice && recommendation.stopLoss) {
        const riskReward = recommendation.riskReward ||
          Math.abs(recommendation.targetPrice - recommendation.entryPrice) /
          Math.abs(recommendation.entryPrice - recommendation.stopLoss);

        annotations.push({
          id: `zone-${recommendation.id}`,
          type: 'zone',
          price: (recommendation.targetPrice + recommendation.stopLoss) / 2,
          color: recommendation.action === 'buy' ? '#10b98120' : '#ef444420',
          label: `R/R: 1:${riskReward.toFixed(2)}`,
          description: `Risk/Reward ratio for this ${recommendation.action} setup`,
          visible: true,
          style: 'dotted',
          width: 1,
          timeframe: recommendation.timeframe
        });
      }

      // Notify parent component of annotations
      if (onOverlayUpdate) {
        onOverlayUpdate(annotations);
      }

      console.log(`✅ [TradingOverlay] Added ${overlaySeriesRef.current.length} overlay series for ${recommendation.timeframe}`);

    } catch (error) {
      console.error('❌ [TradingOverlay] Error adding trading overlays:', error);
    }
  };

  // Effect to manage overlays
  useEffect(() => {
    // Clear existing overlays first
    clearOverlays();

    // Add new overlays if we have a valid recommendation
    if (recommendation && recommendation.isActive) {
      addTradingOverlays();
    }

    // Cleanup function
    return () => {
      clearOverlays();
    };
  }, [chart, recommendation, currentTimeframe]);

  // Listen for global clear overlay events (e.g., when trades are closed)
  useEffect(() => {
    const handleClearOverlays = (event: CustomEvent) => {
      console.log('🧹 [TradingOverlay] Received clear overlays event:', event.detail);
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

export default TradingRecommendationOverlay;