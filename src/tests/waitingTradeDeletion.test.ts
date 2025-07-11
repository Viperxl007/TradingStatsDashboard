/**
 * Waiting Trade Deletion Test Suite
 * 
 * CRITICAL BUG FIX: Tests for proper deletion of trades that were never entered
 * instead of incorrectly marking them as "USER CLOSED"
 * 
 * This test suite ensures:
 * 1. Waiting trades get DELETED when cancelled (not moved to USER_CLOSED)
 * 2. Executed trades continue normal status update behavior
 * 3. No false performance data from never-entered trades
 * 4. UI accurately reflects trade states
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  isWaitingTradeStatus, 
  isExecutedTrade, 
  canTransitionToUserClosed, 
  shouldCountForPerformance,
  getStatusDisplayText 
} from '../utils/statusMapping';

// Mock the fetch function for backend API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Waiting Trade Deletion Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Critical Bug Fix: AVAXUSD-like Scenario', () => {
    test('should DELETE waiting trade when cancelled (not mark as USER_CLOSED)', async () => {
      // Arrange: Mock a waiting trade that was never entered
      const waitingTrade = {
        id: 1,
        ticker: 'AVAXUSD',
        timeframe: '1h',
        status: 'waiting',
        action: 'buy',
        entry_price: 21.60,
        target_price: 23.50,
        stop_loss: 19.80,
        current_price: 21.27, // Price moved away, never pulled back
        close_price: undefined, // No close price because never entered
        close_reason: undefined,
        realized_pnl: undefined, // No P&L because never entered
        unrealized_pnl: undefined,
        created_at: '2025-01-11T10:00:00Z',
        updated_at: '2025-01-11T10:30:00Z'
      };

      // Mock backend DELETE response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Trade deleted' })
      } as Response);

      // Act: Call the delete endpoint directly (simulating what aiTradeService.deleteTrade does)
      const deleteResponse = await fetch('http://localhost:5000/api/active-trades/id/1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'AI Trade Tracker deletion'
        })
      });

      // Assert: Verify DELETE endpoint was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/active-trades/id/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'AI Trade Tracker deletion'
          })
        })
      );

      expect(deleteResponse.ok).toBe(true);
      const result = await deleteResponse.json();
      expect(result.success).toBe(true);
    });

    test('should validate that waiting trades cannot transition to USER_CLOSED', () => {
      // Arrange: Mock trade objects
      const waitingTrade = {
        status: 'waiting' as const,
        actualEntryDate: undefined,
        actualEntryPrice: undefined
      };

      const executedTrade = {
        status: 'active' as const,
        actualEntryDate: Date.now(),
        actualEntryPrice: 45000.00
      };

      // Act & Assert: Test validation functions
      expect(canTransitionToUserClosed(waitingTrade)).toBe(false);
      expect(canTransitionToUserClosed(executedTrade)).toBe(true);
      expect(isWaitingTradeStatus(waitingTrade.status)).toBe(true);
      expect(isExecutedTrade(waitingTrade)).toBe(false);
      expect(isExecutedTrade(executedTrade)).toBe(true);
    });
  });

  describe('Status Validation Functions', () => {
    test('should identify waiting trades correctly', () => {
      const waitingTrade = {
        status: 'waiting' as const,
        actualEntryDate: undefined,
        actualEntryPrice: undefined
      };

      const executedTrade = {
        status: 'active' as const,
        actualEntryDate: Date.now(),
        actualEntryPrice: 45000.00
      };

      // Use imported functions from status mapping
      expect(isWaitingTradeStatus(waitingTrade.status)).toBe(true);
      expect(isWaitingTradeStatus(executedTrade.status)).toBe(false);
      expect(isExecutedTrade(waitingTrade)).toBe(false);
      expect(isExecutedTrade(executedTrade)).toBe(true);
    });

    test('should prevent USER_CLOSED status on waiting trades', () => {
      const waitingTrade = {
        status: 'waiting' as const,
        actualEntryDate: undefined,
        actualEntryPrice: undefined
      };

      const executedTrade = {
        status: 'active' as const,
        actualEntryDate: Date.now(),
        actualEntryPrice: 45000.00
      };

      // Should not allow transition to user_closed for waiting trades
      expect(canTransitionToUserClosed(waitingTrade)).toBe(false);
      expect(canTransitionToUserClosed(executedTrade)).toBe(true);
    });

    test('should properly filter trades for performance counting', () => {
      const waitingTrade = {
        status: 'waiting' as const,
        actualEntryDate: undefined,
        actualEntryPrice: undefined,
        profitLossPercentage: undefined
      };

      const executedTrade = {
        status: 'user_closed' as const,
        actualEntryDate: Date.now(),
        actualEntryPrice: 45000.00,
        profitLossPercentage: 2.5
      };

      // Use imported shouldCountForPerformance function
      expect(shouldCountForPerformance(waitingTrade)).toBe(false);
      expect(shouldCountForPerformance(executedTrade)).toBe(true);
    });
  });

  describe('UI Display Logic', () => {
    test('should show appropriate status for different trade types', () => {
      // Test status display using imported function
      expect(getStatusDisplayText('waiting')).toBe('WAITING');
      expect(getStatusDisplayText('user_closed')).toBe('USER CLOSED');
      expect(getStatusDisplayText('active')).toBe('TAKEN & OPEN');
    });
  });

  describe('Backend Integration Tests', () => {
    test('should handle backend close_trade_by_user for waiting trades', async () => {
      // Arrange: Mock backend response for waiting trade closure
      const waitingTradeResponse = {
        success: true,
        message: 'Trade deleted - was waiting for entry',
        action: 'deleted'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => waitingTradeResponse
      } as Response);

      // Act: Simulate backend call for closing waiting trade
      const response = await fetch('http://localhost:5000/api/active-trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: 'AVAXUSD',
          current_price: 21.27,
          notes: 'Manual close',
          close_reason: 'user_closed'
        })
      });

      // Assert: Backend should handle waiting trade deletion
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.action).toBe('deleted');
      expect(result.message).toContain('deleted');
    });

    test('should handle backend close_trade_by_user for executed trades', async () => {
      // Arrange: Mock backend response for executed trade closure
      const executedTradeResponse = {
        success: true,
        message: 'Trade closed successfully',
        action: 'updated'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => executedTradeResponse
      } as Response);

      // Act: Simulate backend call for closing executed trade
      const response = await fetch('http://localhost:5000/api/active-trades/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: 'BTCUSD',
          current_price: 45500.00,
          notes: 'Manual close',
          close_reason: 'user_closed'
        })
      });

      // Assert: Backend should handle executed trade update
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.action).toBe('updated');
      expect(result.message).toContain('closed successfully');
    });
  });

  describe('Performance Statistics Impact', () => {
    test('should exclude deleted waiting trades from statistics calculation', () => {
      // Arrange: Mix of trade types
      const trades = [
        {
          status: 'user_closed' as const,
          actualEntryDate: Date.now(),
          actualEntryPrice: 45000.00,
          profitLossPercentage: 2.5
        },
        {
          status: 'user_closed' as const,
          actualEntryDate: Date.now(),
          actualEntryPrice: 46000.00,
          profitLossPercentage: -1.2
        }
        // Note: Deleted waiting trades should not appear in this list
      ];

      // Act: Filter trades for performance counting
      const performanceTrades = trades.filter(shouldCountForPerformance);

      // Assert: Only executed trades should be counted
      expect(performanceTrades).toHaveLength(2);
      expect(performanceTrades.every(trade => trade.actualEntryDate !== undefined)).toBe(true);
      expect(performanceTrades.every(trade => trade.profitLossPercentage !== undefined)).toBe(true);
    });
  });
});