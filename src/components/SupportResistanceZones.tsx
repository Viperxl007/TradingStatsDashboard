import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineSeries, LineStyle, AreaSeries } from 'lightweight-charts';
import { KeyLevel } from '../types/chartAnalysis';

interface SupportResistanceZonesProps {
  chart: IChartApi | null;
  keyLevels: KeyLevel[];
  currentTimeframe: string;
}

/**
 * Support/Resistance Zones Component
 * 
 * Creates horizontal lines for support/resistance levels and colored zones between them
 */
const SupportResistanceZones: React.FC<SupportResistanceZonesProps> = ({
  chart,
  keyLevels,
  currentTimeframe
}) => {
  const seriesRef = useRef<ISeriesApi<any>[]>([]);

  // Clear existing series
  const clearSeries = () => {
    if (chart && seriesRef.current.length > 0) {
      seriesRef.current.forEach(series => {
        try {
          // Check if series is valid before removing
          if (series && typeof series === 'object') {
            chart.removeSeries(series);
          }
        } catch (error) {
          // Silently handle removal errors - series might already be removed
          console.debug('Support/resistance series already removed or invalid:', error instanceof Error ? error.message : 'Unknown error');
        }
      });
      seriesRef.current = [];
    }
  };

  // Create support/resistance lines and zones
  const createLevels = () => {
    console.log(`🎨 [SupportResistanceZones] DEBUG - Chart:`, !!chart, `KeyLevels:`, keyLevels.length, `Timeframe:`, currentTimeframe);
    console.log(`🎨 [SupportResistanceZones] DEBUG - KeyLevels data:`, keyLevels);
    
    if (!chart || !keyLevels.length) {
      console.log(`🎨 [SupportResistanceZones] EARLY EXIT - Chart: ${!!chart}, KeyLevels: ${keyLevels.length}`);
      return;
    }

    console.log(`🎨 [SupportResistanceZones] Creating ${keyLevels.length} levels for ${currentTimeframe}`);

    try {
      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      
      if (!visibleRange) {
        console.warn('No visible range available, retrying in 200ms...');
        // Retry after chart has more time to render
        setTimeout(() => {
          if (chart && keyLevels.length > 0) {
            createLevels();
          }
        }, 200);
        return;
      }

      // Group levels by type
      const supportLevels = keyLevels.filter(level => level.type === 'support');
      const resistanceLevels = keyLevels.filter(level => level.type === 'resistance');

      // Create individual support lines (green dashed)
      supportLevels.forEach((level) => {
        const supportLine = chart.addSeries(LineSeries, {
          color: '#10b981',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const lineData = [
          { time: visibleRange.from, value: level.price },
          { time: visibleRange.to, value: level.price }
        ];

        supportLine.setData(lineData as any);
        seriesRef.current.push(supportLine);
      });

      // Create individual resistance lines (red dashed)
      resistanceLevels.forEach((level) => {
        const resistanceLine = chart.addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false,
        });

        const lineData = [
          { time: visibleRange.from, value: level.price },
          { time: visibleRange.to, value: level.price }
        ];

        resistanceLine.setData(lineData as any);
        seriesRef.current.push(resistanceLine);
      });

      // Create RANGE-BOUND colored zones between ALL support levels using multiple thick lines
      if (supportLevels.length >= 2) {
        const supportPrices = supportLevels.map(level => level.price).sort((a, b) => a - b);
        const minSupport = supportPrices[0];
        const maxSupport = supportPrices[supportPrices.length - 1];

        console.log(`🎨 [SupportResistanceZones] Creating support zone from ${minSupport} to ${maxSupport} (${supportLevels.length} levels)`);

        // Create multiple horizontal lines to fill the zone between min and max support
        const zoneHeight = maxSupport - minSupport;
        const numberOfLines = Math.min(50, Math.max(10, Math.floor(zoneHeight / 10))); // Limit to max 50 lines
        const lineSpacing = zoneHeight / numberOfLines;

        for (let i = 0; i <= numberOfLines; i++) {
          const linePrice = minSupport + (i * lineSpacing);
          
          const zoneLine = chart.addSeries(LineSeries, {
            color: 'rgba(16, 185, 129, 0.15)',
            lineWidth: 2, // Fixed line width
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const lineData = [
            { time: visibleRange.from, value: linePrice },
            { time: visibleRange.to, value: linePrice }
          ];

          zoneLine.setData(lineData as any);
          seriesRef.current.push(zoneLine);
        }
      }

      // Create RANGE-BOUND colored zones between ALL resistance levels using multiple thick lines
      if (resistanceLevels.length >= 2) {
        const resistancePrices = resistanceLevels.map(level => level.price).sort((a, b) => a - b);
        const minResistance = resistancePrices[0];
        const maxResistance = resistancePrices[resistancePrices.length - 1];

        console.log(`🎨 [SupportResistanceZones] Creating resistance zone from ${minResistance} to ${maxResistance} (${resistanceLevels.length} levels)`);

        // Create multiple horizontal lines to fill the zone between min and max resistance
        const zoneHeight = maxResistance - minResistance;
        const numberOfLines = Math.min(50, Math.max(10, Math.floor(zoneHeight / 10))); // Limit to max 50 lines
        const lineSpacing = zoneHeight / numberOfLines;

        for (let i = 0; i <= numberOfLines; i++) {
          const linePrice = minResistance + (i * lineSpacing);
          
          const zoneLine = chart.addSeries(LineSeries, {
            color: 'rgba(239, 68, 68, 0.15)',
            lineWidth: 2, // Fixed line width
            lineStyle: LineStyle.Solid,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
          });

          const lineData = [
            { time: visibleRange.from, value: linePrice },
            { time: visibleRange.to, value: linePrice }
          ];

          zoneLine.setData(lineData as any);
          seriesRef.current.push(zoneLine);
        }
      }

      console.log(`✅ [SupportResistanceZones] Created ${seriesRef.current.length} elements`);

    } catch (error) {
      console.error('❌ [SupportResistanceZones] Error creating levels:', error);
    }
  };

  // Effect to manage levels
  useEffect(() => {
    // Clear existing series first
    clearSeries();

    // Create new levels if we have key levels
    if (keyLevels.length > 0) {
      // Longer delay to ensure chart is fully ready and has visible range
      const timeout = setTimeout(createLevels, 300);
      return () => clearTimeout(timeout);
    }

    // Cleanup function
    return () => {
      clearSeries();
    };
  }, [chart, keyLevels, currentTimeframe]);

  // This component doesn't render anything visible - it just manages chart overlays
  return null;
};

export default SupportResistanceZones;