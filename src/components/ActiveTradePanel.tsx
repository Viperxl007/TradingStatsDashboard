import React, { useState, useEffect } from 'react';

interface ActiveTrade {
  id: number;
  ticker: string;
  timeframe: string;
  status: 'waiting' | 'active';
  action: 'buy' | 'sell';
  entry_price: number;
  target_price?: number;
  stop_loss?: number;
  current_price?: number;
  unrealized_pnl?: number;
  entry_strategy?: string;
  entry_condition?: string;
  time_since_creation_hours?: number;
  time_since_trigger_hours?: number;
  max_favorable_price?: number;
  max_adverse_price?: number;
}

interface ActiveTradePanelProps {
  ticker: string;
  currentPrice?: number;
  onTradeUpdate?: () => void;
}

export const ActiveTradePanel: React.FC<ActiveTradePanelProps> = ({
  ticker,
  currentPrice,
  onTradeUpdate
}) => {
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTrade = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}`);
      const data = await response.json();
      
      if (response.ok) {
        setActiveTrade(data.active_trade);
      } else {
        setError(data.error || 'Failed to fetch active trade');
      }
    } catch (err) {
      setError('Network error fetching active trade');
      console.error('Error fetching active trade:', err);
    } finally {
      setLoading(false);
    }
  };

  const closeActiveTrade = async () => {
    if (!activeTrade || !currentPrice) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(`http://localhost:5000/api/active-trades/${ticker}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_price: currentPrice,
          notes: 'Manual close by user'
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setActiveTrade(null);
        onTradeUpdate?.();
      } else {
        setError(data.error || 'Failed to close trade');
      }
    } catch (err) {
      setError('Network error closing trade');
      console.error('Error closing trade:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticker) {
      fetchActiveTrade();
    }
  }, [ticker]);

  const formatPrice = (price?: number) => {
    return price ? `$${price.toFixed(2)}` : 'N/A';
  };

  const formatPnL = (pnl?: number) => {
    if (!pnl) return '$0.00';
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${pnl.toFixed(2)}`;
  };

  const getPnLColor = (pnl?: number) => {
    if (!pnl) return 'text-gray-500';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'waiting':
        return (
          <span className={`${baseClasses} bg-yellow-100 text-yellow-800`}>
            ⏳ Waiting
          </span>
        );
      case 'active':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-800`}>
            📈 Active
          </span>
        );
      default:
        return <span className={`${baseClasses} bg-gray-100 text-gray-800`}>{status}</span>;
    }
  };

  const getActionIcon = (action: string) => {
    return action === 'buy' ? '📈' : '📉';
  };

  if (loading && !activeTrade) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading active trade...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4">
        <div className="flex items-center text-red-600">
          <span className="text-lg mr-2">⚠️</span>
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  if (!activeTrade) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-600">Active Trade Status</h3>
        </div>
        <div className="p-4">
          <div className="text-center py-4">
            <div className="text-4xl text-gray-400 mb-2">📊</div>
            <p className="text-sm text-gray-500">No active trade for {ticker}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-blue-200">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center">
            <span className="text-lg mr-2">{getActionIcon(activeTrade.action)}</span>
            Active Trade - {ticker}
          </h3>
          {getStatusBadge(activeTrade.status)}
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Trade Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center text-gray-600 mb-1">
              <span className="mr-1">💰</span>
              Entry Price
            </div>
            <div className="font-medium">{formatPrice(activeTrade.entry_price)}</div>
          </div>
          
          <div>
            <div className="flex items-center text-gray-600 mb-1">
              <span className="mr-1">💰</span>
              Current Price
            </div>
            <div className="font-medium">{formatPrice(currentPrice || activeTrade.current_price)}</div>
          </div>
          
          {activeTrade.target_price && (
            <div>
              <div className="flex items-center text-gray-600 mb-1">
                <span className="mr-1">🎯</span>
                Target
              </div>
              <div className="font-medium text-green-600">{formatPrice(activeTrade.target_price)}</div>
            </div>
          )}
          
          {activeTrade.stop_loss && (
            <div>
              <div className="flex items-center text-gray-600 mb-1">
                <span className="mr-1">🛡️</span>
                Stop Loss
              </div>
              <div className="font-medium text-red-600">{formatPrice(activeTrade.stop_loss)}</div>
            </div>
          )}
        </div>

        {/* P&L and Performance */}
        {activeTrade.status === 'active' && activeTrade.unrealized_pnl !== undefined && (
          <div className="border-t border-gray-200 pt-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Unrealized P&L:</span>
              <span className={`font-medium ${getPnLColor(activeTrade.unrealized_pnl)}`}>
                {formatPnL(activeTrade.unrealized_pnl)}
              </span>
            </div>
            
            {activeTrade.max_favorable_price && (
              <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                <span>Best Price:</span>
                <span>{formatPrice(activeTrade.max_favorable_price)}</span>
              </div>
            )}
          </div>
        )}

        {/* Entry Strategy Info */}
        {activeTrade.entry_strategy && (
          <div className="border-t border-gray-200 pt-3">
            <div className="text-xs text-gray-600 mb-1">Strategy:</div>
            <div className="text-sm font-medium">{activeTrade.entry_strategy}</div>
            {activeTrade.entry_condition && (
              <div className="text-xs text-gray-500 mt-1">{activeTrade.entry_condition}</div>
            )}
          </div>
        )}

        {/* Time Info */}
        <div className="border-t border-gray-200 pt-3 text-xs text-gray-500">
          {activeTrade.status === 'waiting' && activeTrade.time_since_creation_hours && (
            <div>⏱️ Waiting for {activeTrade.time_since_creation_hours.toFixed(1)} hours</div>
          )}
          {activeTrade.status === 'active' && activeTrade.time_since_trigger_hours && (
            <div>⏱️ Active for {activeTrade.time_since_trigger_hours.toFixed(1)} hours</div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 pt-3">
          <button
            onClick={closeActiveTrade}
            disabled={loading}
            className="w-full px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Closing...' : '❌ Close Trade (Override)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveTradePanel;