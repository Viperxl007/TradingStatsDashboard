import React from 'react';
import SimpleChartViewer from './SimpleChartViewer';
import { KeyLevel, TradingRecommendationOverlay as TradingRecommendationType } from '../types/chartAnalysis';

interface ChartViewerProps {
  ticker: string;
  timeframe: string;
  period?: string;
  onAnalyzeChart: (chartImage: string, additionalContext?: string) => void;
  isAnalyzing: boolean;
  keyLevels?: KeyLevel[];
  showAnnotations?: boolean;
  tradingRecommendation?: TradingRecommendationType | null;
  showTradingOverlays?: boolean;
}

const ChartViewer: React.FC<ChartViewerProps> = ({
  ticker,
  timeframe,
  period,
  onAnalyzeChart,
  isAnalyzing,
  keyLevels = [],
  showAnnotations = true,
  tradingRecommendation = null,
  showTradingOverlays = true
}) => {
  console.log(`📈 [ChartViewer] DEBUG - Rendering with:`, {
    ticker,
    timeframe,
    period,
    keyLevelsCount: keyLevels.length,
    keyLevelsData: keyLevels,
    tradingRecommendationExists: !!tradingRecommendation,
    tradingRecommendationData: tradingRecommendation,
    showTradingOverlays
  });

  return (
    <SimpleChartViewer
      ticker={ticker}
      timeframe={timeframe}
      period={period}
      onAnalyzeChart={onAnalyzeChart}
      isAnalyzing={isAnalyzing}
      keyLevels={keyLevels}
      tradingRecommendation={tradingRecommendation}
      showTradingOverlays={showTradingOverlays}
    />
  );
};

export default ChartViewer;