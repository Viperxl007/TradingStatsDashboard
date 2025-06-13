import React, { useEffect, useRef } from 'react';
import { IChartApi } from 'lightweight-charts';
import { TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';

interface TradingPositionBoxProps {
  chart: IChartApi | null;
  recommendation: TradingRecommendationType | null;
  currentTimeframe: string;
}

/**
 * Trading Position Box Component
 * 
 * Creates a modern TradingView-style position visualization showing:
 * - Entry point with position info
 * - Target level with profit info
 * - Stop loss level with risk info
 * - Connected with clean lines and modern styling
 */
const TradingPositionBox: React.FC<TradingPositionBoxProps> = ({
  chart,
  recommendation,
  currentTimeframe
}) => {
  const positionElementsRef = useRef<HTMLElement[]>([]);

  // Clear existing position elements
  const clearPositionElements = () => {
    positionElementsRef.current.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    positionElementsRef.current = [];
  };

  // Create position box visualization
  const createPositionBox = () => {
    if (!chart || !recommendation || !recommendation.isActive) {
      return;
    }

    // Only show for the specific timeframe the AI analyzed
    if (currentTimeframe !== recommendation.timeframe) {
      return;
    }

    console.log(`🎯 [TradingPositionBox] Creating position box for ${recommendation.action} recommendation`);

    try {
      const chartContainer = chart.chartElement();
      if (!chartContainer) return;

      const timeScale = chart.timeScale();
      
      // Get current visible range
      const visibleRange = timeScale.getVisibleRange();
      if (!visibleRange) return;

      // Calculate position for the box (right side of chart)
      const chartWidth = chartContainer.clientWidth;
      const chartHeight = chartContainer.clientHeight;
      const boxWidth = 200;
      
      // Position the box in the top-right corner (simpler approach)
      const boxX = chartWidth - boxWidth - 20; // 20px margin from right
      const boxY = 20; // 20px from top

      // Create main position container
      const positionContainer = document.createElement('div');
      positionContainer.style.cssText = `
        position: absolute;
        right: 20px;
        top: ${boxY}px;
        width: ${boxWidth}px;
        pointer-events: none;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
      `;

      // Entry box (main position)
      const entryBox = document.createElement('div');
      const isLong = recommendation.action === 'buy';
      const entryColor = isLong ? '#10b981' : '#ef4444';
      const entryBg = isLong ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
      
      entryBox.style.cssText = `
        background: ${entryBg};
        border: 2px solid ${entryColor};
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 4px;
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;

      const riskReward = recommendation.riskReward || 
        (recommendation.targetPrice && recommendation.stopLoss ? 
          Math.abs(recommendation.targetPrice - recommendation.entryPrice) / 
          Math.abs(recommendation.entryPrice - recommendation.stopLoss) : 0);

      entryBox.innerHTML = `
        <div style="color: ${entryColor}; font-weight: 600; margin-bottom: 4px;">
          ${isLong ? '🟢 LONG' : '🔴 SHORT'} Position
        </div>
        <div style="color: #ffffff; font-size: 11px; opacity: 0.9;">
          Entry: $${recommendation.entryPrice.toFixed(2)}
        </div>
        <div style="color: #ffffff; font-size: 11px; opacity: 0.7;">
          R/R: 1:${riskReward.toFixed(2)}
        </div>
      `;

      positionContainer.appendChild(entryBox);

      // Target box
      if (recommendation.targetPrice) {
        const targetBox = document.createElement('div');
        const targetProfit = Math.abs(recommendation.targetPrice - recommendation.entryPrice);
        const targetPercent = (targetProfit / recommendation.entryPrice) * 100;
        
        targetBox.style.cssText = `
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid #22c55e;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 4px;
          backdrop-filter: blur(10px);
        `;

        targetBox.innerHTML = `
          <div style="color: #22c55e; font-weight: 500; font-size: 11px;">
            🎯 Target: $${recommendation.targetPrice.toFixed(2)}
          </div>
          <div style="color: #ffffff; font-size: 10px; opacity: 0.8;">
            +${targetPercent.toFixed(1)}% (+$${targetProfit.toFixed(2)})
          </div>
        `;

        positionContainer.appendChild(targetBox);
      }

      // Stop loss box
      if (recommendation.stopLoss) {
        const stopBox = document.createElement('div');
        const stopLoss = Math.abs(recommendation.entryPrice - recommendation.stopLoss);
        const stopPercent = (stopLoss / recommendation.entryPrice) * 100;
        
        stopBox.style.cssText = `
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
          border-radius: 6px;
          padding: 6px 10px;
          backdrop-filter: blur(10px);
        `;

        stopBox.innerHTML = `
          <div style="color: #ef4444; font-weight: 500; font-size: 11px;">
            🛡️ Stop: $${recommendation.stopLoss.toFixed(2)}
          </div>
          <div style="color: #ffffff; font-size: 10px; opacity: 0.8;">
            -${stopPercent.toFixed(1)}% (-$${stopLoss.toFixed(2)})
          </div>
        `;

        positionContainer.appendChild(stopBox);
      }

      // Add a subtle connecting indicator
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: absolute;
        top: 15px;
        left: -10px;
        width: 8px;
        height: 8px;
        background: ${entryColor};
        border-radius: 50%;
        opacity: 0.8;
      `;
      positionContainer.appendChild(indicator);

      // Add to chart container
      chartContainer.appendChild(positionContainer);
      positionElementsRef.current.push(positionContainer);

      console.log(`✅ [TradingPositionBox] Created position box for ${recommendation.timeframe}`);

    } catch (error) {
      console.error('❌ [TradingPositionBox] Error creating position box:', error);
    }
  };

  // Effect to manage position box
  useEffect(() => {
    // Clear existing elements first
    clearPositionElements();

    // Create new position box if we have a valid recommendation
    if (recommendation && recommendation.isActive) {
      // Small delay to ensure chart is fully rendered
      const timeout = setTimeout(createPositionBox, 100);
      return () => clearTimeout(timeout);
    }

    // Cleanup function
    return () => {
      clearPositionElements();
    };
  }, [chart, recommendation, currentTimeframe]);

  // This component doesn't render anything visible - it just manages chart overlays
  return null;
};

export default TradingPositionBox;