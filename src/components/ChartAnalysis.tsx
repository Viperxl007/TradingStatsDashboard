import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Input,
  Button,
  Select,
  Text,
  useColorMode,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Icon,
  InputGroup,
  InputLeftElement,
  Divider,
  Badge,
  Textarea,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverCloseButton,
  Tooltip,
  useDisclosure,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay
} from '@chakra-ui/react';
import { FiSearch, FiCamera, FiTrendingUp, FiBarChart, FiClock, FiAlertTriangle, FiSettings, FiMessageSquare, FiInfo, FiPlay, FiRefreshCw, FiX } from 'react-icons/fi';
import { getTimeframeConfig, getTimeframesByCategory, periodToDataPoints } from '../utils/timeframeConfig';
import { useData, ActionType } from '../context/DataContext';
import {
  analyzeChartStart,
  analyzeChartSuccess,
  analyzeChartError,
  setSelectedTicker,
  loadAnalysisHistoryStart,
  loadAnalysisHistorySuccess,
  loadAnalysisHistoryError,
  clearChartAnalysisData,
  clearChartOverlays
} from '../context/DataContext';
import { analyzeChart, getAnalysisHistory, createAnalysisRequest, deleteAnalysis, deleteAnalysesBulk, getAnalysisDetails } from '../services/chartAnalysisService';
import { createTradingRecommendationOverlay, getActiveRecommendationsForTimeframe, deactivateRecommendationsForTicker } from '../services/tradingRecommendationService';
import { processAnalysisForTradeActions } from '../services/aiTradeIntegrationService';
import { getActiveTradeOverlay } from '../services/activeTradeService';
import { prepareContextSync, enhanceAnalysisRequest, validateContextResponse, createEnhancedContextPrompt } from '../services/contextSynchronizationService';
import { TradingRecommendationOverlay } from '../types/chartAnalysis';
import ChartViewer from './ChartViewer';
import AnalysisPanel from './AnalysisPanel';
import AnalysisHistory from './AnalysisHistory';
import TimeframeSelector from './TimeframeSelector';
import TradingRecommendationPanel from './TradingRecommendationPanel';
import ModelSelector from './ModelSelector';
import ModernCandlestickChart from './ModernCandlestickChart';
import ChartIndicatorControls from './ChartIndicatorControls';
import { hasVolumeData } from '../utils/technicalIndicators';

const ChartAnalysis: React.FC = () => {
  const { state, dispatch } = useData();
  const { colorMode } = useColorMode();
  const toast = useToast();
  
  // Local state
  const [tickerInput, setTickerInput] = useState('');
  const [timeframe, setTimeframe] = useState('1D');
  const [customPeriod, setCustomPeriod] = useState('6mo'); // Default to 6 months for 1D timeframe
  const [activeTab, setActiveTab] = useState(0);
  const [needsReanalysis, setNeedsReanalysis] = useState(false);
  const [hasInitialAnalysis, setHasInitialAnalysis] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [chartInstance, setChartInstance] = useState<any>(null);
  const { isOpen: isContextOpen, onOpen: onContextOpen, onClose: onContextClose } = useDisclosure();
  
  // Technical Indicator toggles
  const [showVolume, setShowVolume] = useState(false);
  const [showSMA20, setShowSMA20] = useState(false);
  const [showSMA50, setShowSMA50] = useState(false);
  const [showSMA200, setShowSMA200] = useState(false);
  const [showVWAP, setShowVWAP] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | undefined>(undefined);
  const [activeTradeOverlays, setActiveTradeOverlays] = useState<Map<string, TradingRecommendationOverlay>>(new Map());
  
  // Function to get prioritized trading recommendation (active trade > AI recommendation)
  const getPrioritizedTradingRecommendation = (ticker: string, timeframe: string): TradingRecommendationOverlay | null => {
    const activeTradeKey = `${ticker}-${timeframe}`;
    const activeTradeOverlay = activeTradeOverlays.get(activeTradeKey);
    
    if (activeTradeOverlay) {
      console.log(`🎯 [ChartAnalysis] Using active trade overlay for ${ticker} ${timeframe}:`, activeTradeOverlay);
      return activeTradeOverlay;
    }
    
    const aiRecommendation = activeTradingRecommendations.get(activeTradeKey);
    if (aiRecommendation) {
      console.log(`🤖 [ChartAnalysis] Using AI recommendation for ${ticker} ${timeframe}:`, aiRecommendation);
      return aiRecommendation;
    }
    
    console.log(`📭 [ChartAnalysis] No trading recommendation found for ${ticker} ${timeframe}`);
    return null;
  };

  // Function to fetch active trades for current ticker
  const fetchActiveTradesForTicker = async (ticker: string) => {
    if (!ticker) return;
    
    try {
      console.log(`🔍 [ChartAnalysis] Fetching active trades for ${ticker}`);
      
      // Get active trade overlay for current timeframe
      const activeTradeOverlay = await getActiveTradeOverlay(ticker, timeframe);
      
      const updatedOverlays = new Map(activeTradeOverlays);
      const key = `${ticker}-${timeframe}`;
      
      if (activeTradeOverlay) {
        updatedOverlays.set(key, activeTradeOverlay);
        console.log(`✅ [ChartAnalysis] Found active trade for ${ticker} ${timeframe}`);
      } else {
        updatedOverlays.delete(key);
        console.log(`📭 [ChartAnalysis] No active trade found for ${ticker} ${timeframe}`);
      }
      
      setActiveTradeOverlays(updatedOverlays);
    } catch (error) {
      console.error(`❌ [ChartAnalysis] Error fetching active trades for ${ticker}:`, error);
    }
  };

  // Get chart analysis state
  const {
    currentAnalysis,
    analysisHistory,
    selectedTicker,
    chartScreenshot,
    isAnalyzing,
    isLoadingHistory,
    error,
    activeTradingRecommendations,
    showTradingOverlays
  } = state.chartAnalysisData;

  // Fetch active trades when ticker or timeframe changes
  useEffect(() => {
    if (selectedTicker) {
      fetchActiveTradesForTicker(selectedTicker);
    }
  }, [selectedTicker, timeframe]);

  // Handle ticker selection
  const handleTickerSubmit = async () => {
    if (!tickerInput.trim()) {
      toast({
        title: 'Invalid Ticker',
        description: 'Please enter a valid ticker symbol',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const ticker = tickerInput.toUpperCase().trim();
    
    // Only clear chart analysis data if we're switching to a different ticker
    if (selectedTicker !== ticker) {
      dispatch(clearChartAnalysisData());
    }
    
    // Set new ticker
    dispatch(setSelectedTicker(ticker));
    
    // Reset analysis state for new ticker
    setHasInitialAnalysis(false);
    setNeedsReanalysis(false);
    setChartInstance(null); // Reset chart instance for new ticker
    
    // Load analysis history for the ticker
    try {
      dispatch(loadAnalysisHistoryStart(ticker));
      const history = await getAnalysisHistory(ticker);
      dispatch(loadAnalysisHistorySuccess(history));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load analysis history';
      dispatch(loadAnalysisHistoryError(errorMessage));
    }
  };

  // Handle chart analysis
  const handleAnalyzeChart = async (chartImage: string, contextOverride?: string, selectedModel?: string) => {
    if (!selectedTicker) {
      toast({
        title: 'No Ticker Selected',
        description: 'Please select a ticker symbol first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      dispatch(analyzeChartStart(selectedTicker));
      
      // Prepare context synchronization
      console.log(`🔄 [ChartAnalysis] Preparing context sync for ${selectedTicker}...`);
      const contextSync = await prepareContextSync(selectedTicker, timeframe, currentPrice || 0);
      console.log(`🧠 [ChartAnalysis] Context sync prepared:`, contextSync);
      
      // Use the additional context from state, or override if provided
      const contextToUse = contextOverride || additionalContext.trim() || undefined;
      
      console.log(`🔍 [ChartAnalysis] Creating analysis request with timeframe: ${timeframe}`);
      const baseRequest = createAnalysisRequest(
        selectedTicker,
        chartImage,
        timeframe,
        contextToUse,
        selectedModel,
        currentPrice
      );
      
      // Enhance request with context synchronization
      const enhancedRequest = enhanceAnalysisRequest(baseRequest, contextSync);
      console.log(`✨ [ChartAnalysis] Enhanced analysis request with context sync for ${selectedTicker}`);
      
      const result = await analyzeChart(enhancedRequest);
      
      // Validate context response
      const contextValidation = validateContextResponse(result, contextSync);
      console.log(`🔍 [ChartAnalysis] Context validation result:`, contextValidation);
      
      if (!contextValidation.success && contextSync.analysisType !== 'fresh') {
        console.warn(`⚠️ [ChartAnalysis] Context validation failed for ${selectedTicker}:`, contextValidation.error);
        
        toast({
          title: 'Context Synchronization Warning',
          description: `AI may not have received proper context: ${contextValidation.error}`,
          status: 'warning',
          duration: 7000,
          isClosable: true,
        });
      }
      
      dispatch(analyzeChartSuccess(result));
      
      // Process trade actions (close existing positions, create new trades)
      try {
        console.log(`🔄 [ChartAnalysis] Processing trade actions for ${selectedTicker}...`);
        const tradeActionResult = await processAnalysisForTradeActions(result);
        
        if (tradeActionResult.success) {
          console.log(`✅ [ChartAnalysis] Trade actions processed successfully:`, tradeActionResult);
          
          // Handle MAINTAIN status - preserve existing targets and don't create new recommendations
          if (tradeActionResult.shouldPreserveExistingTargets && tradeActionResult.actionType === 'maintain') {
            console.log(`🔄 [ChartAnalysis] MAINTAIN status detected - preserving existing targets for ${selectedTicker}`);
            
            toast({
              title: 'Position Maintained',
              description: `AI recommends maintaining current position for ${selectedTicker}. Existing targets preserved.`,
              status: 'info',
              duration: 5000,
              isClosable: true,
            });
            
            // Don't create new trading recommendation overlays when maintaining
            // The existing active trade overlay will continue to be displayed
            return;
          }
          
          // Deactivate old trading recommendations if positions were closed
          if (tradeActionResult.shouldDeactivateRecommendations && tradeActionResult.ticker) {
            const updatedRecommendations = deactivateRecommendationsForTicker(
              activeTradingRecommendations,
              tradeActionResult.ticker
            );
            
            dispatch({
              type: ActionType.UPDATE_TRADING_RECOMMENDATIONS,
              payload: updatedRecommendations
            });
            
            console.log(`🔒 [ChartAnalysis] Deactivated old recommendations for ${tradeActionResult.ticker}`);
          }
          
          // Refresh active trade overlays after trade actions (critical for invalidation scenarios)
          if (tradeActionResult.closedTrades?.length || tradeActionResult.newTrades?.length) {
            console.log(`🔄 [ChartAnalysis] Refreshing active trade overlays after trade actions for ${selectedTicker}`);
            
            // Clear old active trade overlays for this ticker
            const updatedOverlays = new Map(activeTradeOverlays);
            const keysToRemove = Array.from(updatedOverlays.keys()).filter(key => key.startsWith(`${selectedTicker}-`));
            keysToRemove.forEach(key => updatedOverlays.delete(key));
            
            // Fetch fresh active trade overlays
            setTimeout(async () => {
              try {
                await fetchActiveTradesForTicker(selectedTicker);
                console.log(`✅ [ChartAnalysis] Active trade overlays refreshed for ${selectedTicker}`);
              } catch (error) {
                console.error(`❌ [ChartAnalysis] Error refreshing active trade overlays:`, error);
              }
            }, 1000); // Small delay to ensure database updates are complete
            
            // Update overlays immediately to clear old ones
            setActiveTradeOverlays(updatedOverlays);
          }
          
          // Show success message for trade actions
          if (tradeActionResult.closedTrades?.length || tradeActionResult.newTrades?.length) {
            let actionMessage = '';
            if (tradeActionResult.closedTrades?.length) {
              actionMessage += `Closed ${tradeActionResult.closedTrades.length} existing position(s). `;
            }
            if (tradeActionResult.newTrades?.length) {
              actionMessage += `Created ${tradeActionResult.newTrades.length} new trade recommendation(s).`;
            }
            
            toast({
              title: 'Trade Actions Completed',
              description: actionMessage,
              status: 'info',
              duration: 7000,
              isClosable: true,
            });
          }
        } else {
          console.warn(`⚠️ [ChartAnalysis] Trade action processing had issues:`, tradeActionResult);
          
          if (tradeActionResult.errors?.length) {
            toast({
              title: 'Trade Action Warnings',
              description: tradeActionResult.errors.join('; '),
              status: 'warning',
              duration: 7000,
              isClosable: true,
            });
          }
        }
      } catch (tradeActionError) {
        console.error(`❌ [ChartAnalysis] Error processing trade actions:`, tradeActionError);
        // Don't fail the entire analysis if trade actions fail
        toast({
          title: 'Trade Action Error',
          description: 'Analysis completed but trade actions could not be processed',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }
      
      // CRITICAL: Check if trade closure was detected and clear overlays first
      if ((result as any).trade_closure_detected || (result as any).clear_chart_overlays) {
        console.log(`🧹 [ChartAnalysis] Trade closure detected for ${selectedTicker} - clearing all chart overlays and forcing chart refresh`);
        
        // Import and use the chart overlay utility
        const { clearAllChartOverlays, forceChartRefresh } = await import('../utils/chartOverlayUtils');
        
        // Step 1: Clear all overlays immediately
        await clearAllChartOverlays();
        
        // Step 2: Clear all trading recommendation overlays
        const clearedRecommendations = new Map();
        dispatch({
          type: ActionType.UPDATE_TRADING_RECOMMENDATIONS,
          payload: clearedRecommendations
        });
        
        // Step 3: Clear active trade overlays
        setActiveTradeOverlays(new Map());
        
        // Step 4: Clear any existing analysis data to ensure clean state
        dispatch(clearChartAnalysisData());
        
        // Step 5: Force chart refresh to ensure clean rendering
        await forceChartRefresh();
        
        console.log(`✅ [ChartAnalysis] Chart overlays cleared and chart refreshed for ${selectedTicker} due to trade closure`);
        
        // Step 6: Wait longer for chart to fully refresh and render clean
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`🎯 [ChartAnalysis] Chart should now be clean for fresh AI analysis of ${selectedTicker}`);
      }
      
      // Create trading recommendation overlay if we have recommendations
      if (result.recommendations && result.recommendations.action !== 'hold') {
        const tradingOverlay = createTradingRecommendationOverlay(result);
        if (tradingOverlay) {
          // Store the trading recommendation in the context
          const updatedRecommendations = new Map(activeTradingRecommendations);
          updatedRecommendations.set(`${selectedTicker}-${timeframe}`, tradingOverlay);
          
          // Update the context with the new recommendations
          dispatch({
            type: ActionType.UPDATE_TRADING_RECOMMENDATIONS,
            payload: updatedRecommendations
          });
          
          console.log(`🎯 [ChartAnalysis] Created trading recommendation overlay for ${selectedTicker} ${timeframe}:`, tradingOverlay);
        }
      }
      
      // Mark that we have completed an analysis and no reanalysis is needed
      setHasInitialAnalysis(true);
      setNeedsReanalysis(false);
      
      toast({
        title: 'Analysis Complete',
        description: `Chart analysis for ${selectedTicker} (${timeframe}) completed successfully`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Wait for overlays to render, then capture marked-up chart BEFORE switching tabs
      setTimeout(async () => {
        try {
          console.log('📸 Capturing post-analysis chart with overlays...');
          
          // Import screenshot functions
          const { captureChartScreenshotNative, captureChartScreenshot } = await import('../services/chartAnalysisService');
          
          let markedUpScreenshot: string | undefined;
          
          // Try native screenshot first
          if (chartInstance) {
            try {
              markedUpScreenshot = await captureChartScreenshotNative(chartInstance);
              console.log('✅ Post-analysis native screenshot successful!');
            } catch (nativeError) {
              console.warn('⚠️ Post-analysis native screenshot failed, falling back to html2canvas:', nativeError);
              const chartContainer = document.querySelector('[data-testid="modern-chart-container"]') as HTMLElement;
              if (chartContainer) {
                markedUpScreenshot = await captureChartScreenshot(chartContainer);
              }
            }
          } else {
            const chartContainer = document.querySelector('[data-testid="modern-chart-container"]') as HTMLElement;
            if (chartContainer) {
              markedUpScreenshot = await captureChartScreenshot(chartContainer);
            }
          }
          
          if (markedUpScreenshot && result.analysis_id) {
            // Send the marked-up chart to the backend
            const { updateAnalysisMarkup } = await import('../services/chartAnalysisService');
            
            try {
              await updateAnalysisMarkup(result.analysis_id.toString(), markedUpScreenshot);
              
              // Update the local context with the enhanced result
              const updatedResult = {
                ...result,
                markedUpChartImageBase64: markedUpScreenshot
              };
              dispatch(analyzeChartSuccess(updatedResult));
              
              console.log('✅ Post-analysis chart captured and stored for historical reference');
            } catch (updateError) {
              console.warn('⚠️ Failed to update backend with marked-up chart:', updateError);
              // Still update local state even if backend update fails
              const updatedResult = {
                ...result,
                markedUpChartImageBase64: markedUpScreenshot
              };
              dispatch(analyzeChartSuccess(updatedResult));
            }
          }
          
          // Chart capture complete - stay on Chart Viewer tab to show marked-up chart
          console.log('📊 Analysis complete - staying on Chart Viewer tab to show marked-up chart');
        } catch (error) {
          console.warn('⚠️ Failed to capture post-analysis chart:', error);
          // Don't switch tabs - let user see the chart with overlays
        }
      }, 3000); // Wait 3 seconds for overlays to fully render
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze chart';
      dispatch(analyzeChartError(errorMessage));
      
      toast({
        title: 'Analysis Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Handle timeframe changes - clear chart overlays but keep ticker selected
  const handleTimeframeChange = (newTimeframe: string) => {
    console.log(`🔄 [ChartAnalysis] Timeframe changing from ${timeframe} to ${newTimeframe}`);
    
    // Clear only chart overlays/analysis data, but keep the selected ticker
    // This provides a clean chart for the new timeframe while maintaining UX continuity
    dispatch(clearChartOverlays());
    
    // Reset chart instance to force chart recreation with clean state
    setChartInstance(null);
    
    // Reset technical indicator states to default (off) for clean analysis
    setShowVolume(false);
    setShowSMA20(false);
    setShowSMA50(false);
    setShowSMA200(false);
    setShowVWAP(false);
    
    // Clear chart data
    setChartData([]);
    
    // Update timeframe
    setTimeframe(newTimeframe);
    
    // Reset analysis state flags
    setHasInitialAnalysis(false);
    setNeedsReanalysis(false);
    
    console.log(`✅ [ChartAnalysis] Chart overlays cleared for timeframe change to ${newTimeframe} - ticker preserved, indicators reset`);
    
    toast({
      title: 'Timeframe Changed',
      description: `Chart timeframe changed to ${newTimeframe}. Chart cleared for fresh analysis.`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Handle period changes - clear chart overlays but keep ticker selected
  const handlePeriodChange = (newPeriod: string) => {
    console.log(`🔄 [ChartAnalysis] Period changing from ${customPeriod} to ${newPeriod}`);
    
    // Clear only chart overlays/analysis data, but keep the selected ticker
    // This provides a clean chart for the new period while maintaining UX continuity
    dispatch(clearChartOverlays());
    
    // Reset chart instance to force chart recreation with clean state
    setChartInstance(null);
    
    // Reset technical indicator states to default (off) for clean analysis
    setShowVolume(false);
    setShowSMA20(false);
    setShowSMA50(false);
    setShowSMA200(false);
    setShowVWAP(false);
    
    // Clear chart data
    setChartData([]);
    
    // Update period
    setCustomPeriod(newPeriod);
    
    // Reset analysis state flags
    setHasInitialAnalysis(false);
    setNeedsReanalysis(false);
    
    console.log(`✅ [ChartAnalysis] Chart overlays cleared for period change to ${newPeriod} - ticker preserved, indicators reset`);
    
    toast({
      title: 'Period Changed',
      description: `Chart period changed to ${newPeriod}. Chart cleared for fresh analysis.`,
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Handle Enter key press in ticker input
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleTickerSubmit();
    }
  };

  // State for force deletion confirmation dialog
  const { isOpen: isDeleteDialogOpen, onOpen: onDeleteDialogOpen, onClose: onDeleteDialogClose } = useDisclosure();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const cancelRef = React.useRef<HTMLButtonElement>(null);

  // Handle deleting a single analysis
  const handleDeleteAnalysis = async (analysisId: string, force: boolean = false) => {
    try {
      await deleteAnalysis(analysisId, force);
      toast({
        title: 'Analysis Deleted',
        description: `Analysis deleted successfully${force ? ' (forced)' : ''}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // Close dialog if it was open
      if (isDeleteDialogOpen) {
        onDeleteDialogClose();
        setPendingDeleteId(null);
        setDeleteError(null);
      }
    } catch (error: any) {
      // Handle 409 Conflict (active trades) specially
      if (error.status === 409 && error.reason === 'active_trades' && !force) {
        setPendingDeleteId(analysisId);
        setDeleteError(error.message);
        onDeleteDialogOpen();
        return; // Don't show error toast, show confirmation dialog instead
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete analysis';
      toast({
        title: 'Delete Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      throw error; // Re-throw so the component can handle it
    }
  };

  // Handle force deletion confirmation
  const handleForceDelete = async () => {
    if (pendingDeleteId) {
      await handleDeleteAnalysis(pendingDeleteId, true);
    }
  };

  // Handle canceling force deletion
  const handleCancelDelete = () => {
    onDeleteDialogClose();
    setPendingDeleteId(null);
    setDeleteError(null);
  };

  // Handle bulk deleting analyses
  const handleDeleteAnalysesBulk = async (analysisIds: string[]) => {
    try {
      const result = await deleteAnalysesBulk(analysisIds);
      toast({
        title: 'Analyses Deleted',
        description: `Successfully deleted ${result.deleted_count} of ${result.requested_count} analyses`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete analyses';
      toast({
        title: 'Delete Failed',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      throw error; // Re-throw so the component can handle it
    }
  };

  // Handle refreshing analysis history
  const handleRefreshHistory = async () => {
    if (!selectedTicker) return;
    
    try {
      dispatch(loadAnalysisHistoryStart(selectedTicker));
      const history = await getAnalysisHistory(selectedTicker);
      dispatch(loadAnalysisHistorySuccess(history));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh analysis history';
      dispatch(loadAnalysisHistoryError(errorMessage));
    }
  };

  // Handle resetting the chart analysis state
  const handleReset = () => {
    // Clear all chart analysis data (overlays, recommendations, etc.)
    dispatch(clearChartAnalysisData());
    
    // Reset local state
    dispatch(setSelectedTicker(''));
    setTickerInput('');
    setHasInitialAnalysis(false);
    setNeedsReanalysis(false);
    setAdditionalContext('');
    setChartInstance(null); // Reset chart instance
    setActiveTab(0);
    setChartData([]); // Reset chart data for indicators
    
    // Reset timeframe and period to defaults
    setTimeframe('1D'); // Reset to default 1D timeframe
    setCustomPeriod('6mo'); // Reset to default 6 month period
    
    // Reset ALL technical indicator states to OFF
    setShowVolume(false);
    setShowSMA20(false);
    setShowSMA50(false);
    setShowSMA200(false);
    setShowVWAP(false);
    
    console.log('🔄 [ChartAnalysis] Complete state reset - timeframe: 1D, indicators: all OFF');
    
    toast({
      title: 'Reset Complete',
      description: 'Chart analysis has been reset. You can now search for a new ticker.',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  // Handle chart ready callback
  const handleChartReady = (chart: any) => {
    console.log('📊 [ChartAnalysis] Chart instance ready for capture');
    setChartInstance(chart);
  };

  // Handle chart analysis from the main "Analyze Chart" button
  const handleAnalyzeFromButton = async () => {
    if (!selectedTicker) {
      toast({
        title: 'No Ticker Selected',
        description: 'Please select a ticker symbol first',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (!chartInstance) {
      toast({
        title: 'Chart Not Ready',
        description: 'Please wait for the chart to finish loading before analyzing.',
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    try {
      // Import the screenshot capture functions
      const { captureChartScreenshotNative, captureChartScreenshot } = await import('../services/chartAnalysisService');
      
      // Show capturing toast
      toast({
        title: 'Capturing Chart',
        description: 'Taking a screenshot of the chart for AI analysis...',
        status: 'info',
        duration: 2000,
        isClosable: true,
      });

      console.log('✅ Chart is ready, waiting additional time for rendering...');
      // Additional wait for visual rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('📸 Attempting to capture screenshot...');
      let screenshot: string;

      // Start capturing mode to prevent chart cleanup
      if (chartInstance && typeof (chartInstance as any).startCapturing === 'function') {
        console.log('🎯 [ChartAnalysis] Starting capture mode');
        (chartInstance as any).startCapturing();
      }

      try {
        // Try native screenshot first if chart instance is available
        try {
          console.log('🎯 Trying native chart screenshot method...');
          screenshot = await captureChartScreenshotNative(chartInstance);
          console.log('✅ Native screenshot successful!');
        } catch (nativeError) {
          console.warn('⚠️ Native screenshot failed, falling back to html2canvas:', nativeError);
          
          // Fallback to html2canvas method
          const chartContainer = document.querySelector('[data-testid="modern-chart-container"]') as HTMLElement;
          if (!chartContainer) {
            throw new Error('Chart container not found for fallback capture method');
          }
          screenshot = await captureChartScreenshot(chartContainer);
        }
      } finally {
        // Stop capturing mode
        if (chartInstance && typeof (chartInstance as any).stopCapturing === 'function') {
          console.log('🎯 [ChartAnalysis] Stopping capture mode');
          (chartInstance as any).stopCapturing();
        }
      }

      console.log('✅ Screenshot captured successfully, length:', screenshot.length);
      
      // Get additional context and selected model
      const contextToUse = additionalContext.trim() || undefined;
      const selectedModel = localStorage.getItem('selectedClaudeModel') || '';
      
      console.log('🤖 Sending to AI for analysis...');
      // Trigger the analysis with the captured screenshot
      await handleAnalyzeChart(screenshot, contextToUse, selectedModel);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture and analyze chart';
      console.error('❌ Chart analysis from button failed:', errorMessage);
      
      toast({
        title: 'Analysis Failed',
        description: `${errorMessage}. You can try using the manual upload option in the AI Analysis tab.`,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
      
      // Still switch to the analysis tab so user can try manual upload
      setActiveTab(1);
    }
  };

  return (
    <Box w="100%" h="100%">
      {/* Header */}
      <VStack spacing={4} align="stretch">
        <Box>
          <Heading size="md" mb={1} color={colorMode === 'dark' ? 'white' : 'gray.800'}>
            AI Chart Analysis
          </Heading>
          <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
            Analyze stock charts using AI to identify key levels, patterns, and trading opportunities
          </Text>
        </Box>

        {/* Ticker Search Bar - Always visible with reset option when ticker is selected */}
        <Box
          p={3}
          bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
          borderRadius="md"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
        >
          <VStack spacing={3} align="stretch">
            <HStack justify="space-between" align="center">
              <Text fontWeight="semibold" fontSize="sm">
                {selectedTicker ? 'Current Symbol' : 'Select Stock Symbol'}
              </Text>
              {selectedTicker && (
                <Button
                  size="xs"
                  variant="ghost"
                  colorScheme="red"
                  leftIcon={<Icon as={FiX} />}
                  onClick={handleReset}
                >
                  Reset & Search New
                </Button>
              )}
            </HStack>
            
            {selectedTicker ? (
              <HStack spacing={2} align="center">
                <Badge colorScheme="blue" fontSize="md" px={3} py={1}>
                  {selectedTicker}
                </Badge>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                  Chart loaded and ready for analysis
                </Text>
              </HStack>
            ) : (
              <HStack spacing={2}>
                <InputGroup flex={1}>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiSearch} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Enter ticker symbol (e.g., AAPL, TSLA)"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                    size="sm"
                  />
                </InputGroup>
                <Button
                  colorScheme="brand"
                  onClick={handleTickerSubmit}
                  isLoading={isLoadingHistory}
                  loadingText="Loading"
                  leftIcon={<Icon as={FiSearch} />}
                  size="sm"
                >
                  Load Chart
                </Button>
              </HStack>
            )}
          </VStack>
        </Box>

        {/* Legacy control bar - remove this section */}
        {false && !selectedTicker && (
          <Box
            p={3}
            bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
            borderRadius="md"
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
          >
            <VStack spacing={3} align="stretch">
              <Text fontWeight="semibold" fontSize="sm">
                Select Stock Symbol
              </Text>
              <HStack spacing={2}>
                <InputGroup flex={1}>
                  <InputLeftElement pointerEvents="none">
                    <Icon as={FiSearch} color="gray.400" />
                  </InputLeftElement>
                  <Input
                    placeholder="Enter ticker symbol (e.g., AAPL, TSLA)"
                    value={tickerInput}
                    onChange={(e) => setTickerInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                    size="sm"
                  />
                </InputGroup>
                <Button
                  colorScheme="brand"
                  onClick={handleTickerSubmit}
                  isLoading={isLoadingHistory}
                  loadingText="Loading"
                  leftIcon={<Icon as={FiSearch} />}
                  size="sm"
                >
                  Load Chart
                </Button>
              </HStack>
            </VStack>
          </Box>
        )}


        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Tabs - RESTORED ORIGINAL STRUCTURE */}
        {selectedTicker && (
          <Tabs
            variant="line"
            colorScheme="brand"
            index={activeTab}
            onChange={setActiveTab}
            isLazy
          >
            <TabList>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiBarChart} />
                  <Text>Chart Viewer</Text>
                </HStack>
              </Tab>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiTrendingUp} />
                  <Text>AI Analysis</Text>
                  {isAnalyzing && <Spinner size="sm" />}
                  {needsReanalysis && !isAnalyzing && (
                    <Icon as={FiAlertTriangle} color="orange.500" />
                  )}
                </HStack>
              </Tab>
              <Tab>
                <HStack spacing={2}>
                  <Icon as={FiClock} />
                  <Text>History</Text>
                </HStack>
              </Tab>
            </TabList>

            {/* AVAXUSD Analysis Chart Panel - Below tabs, outside tab content */}
            <Flex
              justify="space-between"
              align="center"
              p={5}
              bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
              boxShadow="sm"
              mt={4}
            >
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold" fontSize="xl" color={colorMode === 'dark' ? 'white' : 'gray.800'}>
                  {selectedTicker} Analysis Chart
                </Text>
                <Text fontSize="sm" color={colorMode === 'dark' ? 'gray.400' : 'gray.600'}>
                  What you see is exactly what gets analyzed by AI
                </Text>
              </VStack>
              
              <HStack spacing={3}>
                <Button
                  leftIcon={<Icon as={FiCamera} />}
                  onClick={handleAnalyzeFromButton}
                  isLoading={isAnalyzing}
                  loadingText="Analyzing..."
                  size="lg"
                  colorScheme="blue"
                  borderRadius="xl"
                  px={6}
                  _hover={{
                    transform: 'translateY(-1px)',
                    boxShadow: 'lg',
                  }}
                  transition="all 0.2s ease-in-out"
                >
                  Analyze Chart
                </Button>
                <Button
                  leftIcon={<Icon as={FiRefreshCw} />}
                  onClick={handleReset}
                  variant="outline"
                  size="lg"
                  borderRadius="xl"
                  px={6}
                  _hover={{
                    transform: 'translateY(-1px)',
                    boxShadow: 'lg',
                  }}
                  transition="all 0.2s ease-in-out"
                >
                  New Search
                </Button>
              </HStack>
            </Flex>

            <TabPanels>
              {/* Chart Viewer Tab */}
              <TabPanel p={0} pt={6}>
                <VStack spacing={6} align="stretch">
                  {/* AI Model Selection Panel - Moved here between Analyze Chart button and chart */}
                  <Box
                    p={3}
                    bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                  >
                    <HStack justify="space-between" align="center">
                      <Box flex={1}>
                        <ModelSelector
                          selectedModel={localStorage.getItem('selectedClaudeModel') || ''}
                          onModelChange={(modelId: string) => {
                            localStorage.setItem('selectedClaudeModel', modelId);
                          }}
                          isDisabled={isAnalyzing}
                        />
                      </Box>
                      
                      {/* Advanced Options Popover */}
                      <Popover isOpen={isContextOpen} onClose={onContextClose} placement="bottom-end">
                        <PopoverTrigger>
                          <Tooltip label="Advanced options" placement="top">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={onContextOpen}
                            >
                              <Icon as={FiSettings} />
                            </Button>
                          </Tooltip>
                        </PopoverTrigger>
                        <PopoverContent width="400px">
                          <PopoverHeader fontWeight="semibold" fontSize="sm">
                            Advanced Analysis Options
                          </PopoverHeader>
                          <PopoverCloseButton />
                          <PopoverBody>
                            <VStack spacing={3} align="stretch">
                              <VStack spacing={2} align="stretch">
                                <Text fontSize="sm" fontWeight="medium">Additional Context</Text>
                                <Textarea
                                  placeholder="Provide additional context (e.g., recent news, market conditions, specific patterns to look for...)"
                                  value={additionalContext}
                                  onChange={(e) => setAdditionalContext(e.target.value)}
                                  rows={3}
                                  bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                                  borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                                  fontSize="sm"
                                />
                              </VStack>
                              
                              <VStack spacing={2} align="stretch">
                                <Text fontSize="sm" fontWeight="medium">Manual Chart Upload</Text>
                                <Button
                                  as="label"
                                  htmlFor="chart-upload-advanced"
                                  size="sm"
                                  variant="outline"
                                  colorScheme="brand"
                                  cursor="pointer"
                                  leftIcon={<Icon as={FiCamera} />}
                                  width="full"
                                >
                                  Upload Chart Image
                                  <input
                                    id="chart-upload-advanced"
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (!file || !file.type.startsWith('image/')) return;
                                      
                                      const reader = new FileReader();
                                      reader.onload = (e) => {
                                        const base64 = e.target?.result as string;
                                        if (base64) {
                                          const imageData = base64.split(',')[1];
                                          const context = additionalContext.trim() || undefined;
                                          const selectedModel = localStorage.getItem('selectedClaudeModel') || '';
                                          handleAnalyzeChart(imageData, context, selectedModel);
                                          onContextClose();
                                        }
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                    style={{ display: 'none' }}
                                  />
                                </Button>
                              </VStack>
                              
                              <HStack justify="flex-end" spacing={2}>
                                <Button size="xs" variant="ghost" onClick={() => setAdditionalContext('')}>
                                  Clear
                                </Button>
                                <Button size="xs" colorScheme="blue" onClick={onContextClose}>
                                  Done
                                </Button>
                              </HStack>
                            </VStack>
                          </PopoverBody>
                        </PopoverContent>
                      </Popover>
                    </HStack>
                  </Box>
                  
                  {/* Timeframe and Period Controls Panel - Moved here after model selection */}
                  <Box
                    p={3}
                    bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.200'}
                  >
                    <HStack justify="space-between" align="center">
                      <HStack spacing={4}>
                        <Text fontSize="sm" fontWeight="semibold">
                          {selectedTicker}
                        </Text>
                        
                        {/* Timeframe Selector */}
                        <Box minW="140px">
                          <Text fontSize="xs" color="gray.500" mb={1}>Timeframe</Text>
                          <Select
                            value={timeframe}
                            onChange={(e) => handleTimeframeChange(e.target.value)}
                            bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                            borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                            size="sm"
                          >
                            {Object.entries(getTimeframesByCategory()).map(([category, configs]) => (
                              <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                                {configs.map((config) => (
                                  <option key={config.value} value={config.value}>
                                    {config.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </Select>
                        </Box>
                        
                        {/* Period Selector */}
                        <HStack spacing={2}>
                          <Text fontSize="xs" color="gray.500">Period:</Text>
                          <Select
                            value={customPeriod}
                            onChange={(e) => handlePeriodChange(e.target.value)}
                            bg={colorMode === 'dark' ? 'gray.800' : 'white'}
                            borderColor={colorMode === 'dark' ? 'gray.600' : 'gray.300'}
                            size="xs"
                            width="80px"
                          >
                            <option value="1d">1D</option>
                            <option value="5d">5D</option>
                            <option value="1mo">1M</option>
                            <option value="3mo">3M</option>
                            <option value="6mo">6M</option>
                            <option value="1y">1Y</option>
                            <option value="2y">2Y</option>
                            <option value="5y">5Y</option>
                            <option value="10y">10Y</option>
                            <option value="ytd">YTD</option>
                            <option value="max">MAX</option>
                          </Select>
                        </HStack>
                        
                        <Text fontSize="xs" color="gray.500">
                          {periodToDataPoints(customPeriod || getTimeframeConfig(timeframe).standardPeriod, timeframe)} data points
                        </Text>
                        
                        {needsReanalysis && (
                          <HStack spacing={1}>
                            <Icon as={FiAlertTriangle} color="orange.500" size="xs" />
                            <Text fontSize="xs" color="orange.500">
                              Settings changed - reanalysis needed
                            </Text>
                          </HStack>
                        )}
                      </HStack>
                      
                      {currentAnalysis && (
                        <Text fontSize="xs" color="green.500">
                          ✓ Analysis available
                        </Text>
                      )}
                    </HStack>
                  </Box>
                  
                  {/* Chart Only - No duplicate Analysis Chart panel */}
                  <Box position="relative">
                    <ModernCandlestickChart
                      symbol={selectedTicker}
                      timeframe={timeframe}
                      period={customPeriod}
                      height="700px"
                      width="100%"
                      keyLevels={currentAnalysis?.keyLevels || []}
                      showHeader={true}
                      tradingRecommendation={getPrioritizedTradingRecommendation(selectedTicker, timeframe)}
                      showTradingOverlays={showTradingOverlays}
                      onChartReady={handleChartReady}
                      onCurrentPriceUpdate={setCurrentPrice}
                      onTimeframeChange={handleTimeframeChange}
                      currentAnalysis={currentAnalysis}
                      showVolume={showVolume}
                      showSMA20={showSMA20}
                      showSMA50={showSMA50}
                      showSMA200={showSMA200}
                      showVWAP={showVWAP}
                      onDataLoaded={setChartData}
                    />
                  </Box>
                  
                  {/* Chart Indicator Controls */}
                  <Box>
                    <ChartIndicatorControls
                      showVolume={showVolume}
                      showSMA20={showSMA20}
                      showSMA50={showSMA50}
                      showSMA200={showSMA200}
                      showVWAP={showVWAP}
                      onToggleVolume={setShowVolume}
                      onToggleSMA20={setShowSMA20}
                      onToggleSMA50={setShowSMA50}
                      onToggleSMA200={setShowSMA200}
                      onToggleVWAP={setShowVWAP}
                      hasVolumeData={hasVolumeData(chartData)}
                    />
                  </Box>
                  
                  {/* Trading Recommendation Panel */}
                  <TradingRecommendationPanel
                    recommendations={activeTradingRecommendations}
                    currentTimeframe={timeframe}
                    ticker={selectedTicker}
                  />
                </VStack>
              </TabPanel>

              {/* AI Analysis Tab */}
              <TabPanel p={0} pt={6}>
                <AnalysisPanel
                  analysis={currentAnalysis}
                  isAnalyzing={isAnalyzing}
                  ticker={selectedTicker}
                />
              </TabPanel>

              {/* History Tab */}
              <TabPanel p={0} pt={6}>
                <AnalysisHistory
                  history={analysisHistory}
                  isLoading={isLoadingHistory}
                  ticker={selectedTicker}
                  onSelectAnalysis={(analysisId: string) => {
                    // Handle selecting a historical analysis
                    console.log('Selected analysis:', analysisId);
                  }}
                  onDeleteAnalysis={handleDeleteAnalysis}
                  onDeleteAnalysesBulk={handleDeleteAnalysesBulk}
                  onRefreshHistory={handleRefreshHistory}
                />
              </TabPanel>
            </TabPanels>
          </Tabs>
        )}

        {/* Welcome Message */}
        {!selectedTicker && (
          <Box
            textAlign="center"
            py={12}
            color={colorMode === 'dark' ? 'gray.400' : 'gray.500'}
          >
            <Icon as={FiCamera} boxSize={12} mb={4} />
            <Text fontSize="lg" mb={2}>
              Welcome to AI Chart Analysis
            </Text>
            <Text>
              Enter a ticker symbol above to start analyzing charts with AI
            </Text>
          </Box>
        )}
      </VStack>

      {/* Force Deletion Confirmation Dialog */}
      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={cancelRef}
        onClose={handleCancelDelete}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              <HStack>
                <Icon as={FiAlertTriangle} color="orange.500" />
                <Text>Analysis Has Active Trades</Text>
              </HStack>
            </AlertDialogHeader>

            <AlertDialogBody>
              <VStack align="start" spacing={3}>
                <Text>
                  {deleteError}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  Force deleting this analysis will automatically close all associated active trades.
                  This action cannot be undone.
                </Text>
                <Alert status="warning" size="sm">
                  <AlertIcon />
                  <Text fontSize="sm">
                    All active trades for this analysis will be closed at their current entry price.
                  </Text>
                </Alert>
              </VStack>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleForceDelete}
                ml={3}
                leftIcon={<Icon as={FiAlertTriangle} />}
              >
                Force Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ChartAnalysis;