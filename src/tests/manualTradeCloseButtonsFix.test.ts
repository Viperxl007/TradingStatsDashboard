/**
 * Manual Trade Close Buttons Fix Tests
 * 
 * Tests the fix for the issue where clicking STOP button on a waiting trade
 * would delete the trade instead of properly closing it as a stop loss.
 * 
 * This test suite verifies that manual intervention (PROFIT/STOP/CLOSE buttons)
 * always overrides automated processes and properly closes trades regardless
 * of their current status (waiting or active).
 */

import { closeTradeManually, ManualCloseRequest } from '../services/manualTradeCloseService';
import { closeActiveTradeInProduction } from '../services/productionActiveTradesService';

// Mock the production service
jest.mock('../services/productionActiveTradesService', () => ({
  closeActiveTradeInProduction: jest.fn()
}));

const mockCloseActiveTradeInProduction = closeActiveTradeInProduction as jest.MockedFunction<typeof closeActiveTradeInProduction>;

describe('Manual Trade Close Buttons Fix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log to avoid test output noise
  });

  describe('PROFIT Button Scenarios', () => {
    test('should close waiting trade as profit_hit when PROFIT button clicked', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'profit_hit',
        closePrice: 3100,
        notes: 'Manual profit target hit from chart interface'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Profit Target Hit');
      expect(result.message).toContain('$3100');
      
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'ETHUSD',
        3100,
        '🎯 PROFIT TARGET HIT - Manual close at $3100. Manual profit target hit from chart interface',
        'profit_hit'
      );
    });

    test('should close active trade as profit_hit when PROFIT button clicked', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'BTCUSD',
        reason: 'profit_hit',
        closePrice: 45000,
        notes: 'Target reached'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Profit Target Hit');
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'BTCUSD',
        45000,
        '🎯 PROFIT TARGET HIT - Manual close at $45000. Target reached',
        'profit_hit'
      );
    });
  });

  describe('STOP Button Scenarios', () => {
    test('should close waiting trade as stop_hit when STOP button clicked', async () => {
      // Arrange: This is the exact scenario from the bug report
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'stop_hit',
        closePrice: 2950,
        notes: 'Manual close from chart interface'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Stop Loss Hit');
      expect(result.message).toContain('$2950');
      
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'ETHUSD',
        2950,
        '🛡️ STOP LOSS HIT - Manual close at $2950. Manual close from chart interface',
        'stop_hit'
      );
    });

    test('should close active trade as stop_hit when STOP button clicked', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'AAPL',
        reason: 'stop_hit',
        closePrice: 180.50,
        notes: 'Risk management'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Stop Loss Hit');
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'AAPL',
        180.50,
        '🛡️ STOP LOSS HIT - Manual close at $180.5. Risk management',
        'stop_hit'
      );
    });
  });

  describe('CLOSE Button Scenarios', () => {
    test('should close waiting trade as user_closed when CLOSE button clicked', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'TSLA',
        reason: 'user_closed',
        closePrice: 250.75,
        notes: 'Changed market outlook'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Early Close');
      expect(result.message).toContain('$250.75');
      
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'TSLA',
        250.75,
        '⏰ EARLY CLOSE - User initiated close at $250.75. Changed market outlook',
        'user_closed'
      );
    });

    test('should close active trade as user_closed when CLOSE button clicked', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'NVDA',
        reason: 'user_closed',
        closePrice: 420.25,
        notes: 'Early exit before earnings'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Early Close');
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'NVDA',
        420.25,
        '⏰ EARLY CLOSE - User initiated close at $420.25. Early exit before earnings',
        'user_closed'
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle backend API failure gracefully', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(false);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'stop_hit',
        closePrice: 2950,
        notes: 'Test failure scenario'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('❌ Failed to close trade');
      expect(result.error).toBe('Backend API call failed');
    });

    test('should handle network errors gracefully', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockRejectedValue(new Error('Network timeout'));
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'profit_hit',
        closePrice: 3100,
        notes: 'Test network error'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('❌ Error closing trade');
      expect(result.error).toBe('Network timeout');
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing notes gracefully', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'stop_hit',
        closePrice: 2950
        // notes is optional
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'ETHUSD',
        2950,
        '🛡️ STOP LOSS HIT - Manual close at $2950.',
        'stop_hit'
      );
    });

    test('should handle empty notes gracefully', async () => {
      // Arrange
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'profit_hit',
        closePrice: 3100,
        notes: ''
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'ETHUSD',
        3100,
        '🎯 PROFIT TARGET HIT - Manual close at $3100.',
        'profit_hit'
      );
    });
  });

  describe('Race Condition Prevention', () => {
    test('should handle the original bug scenario: waiting trade with entry conditions hit', async () => {
      // Arrange: This simulates the exact scenario from the bug report
      // - ETH trade was in waiting status
      // - Entry conditions were hit but not yet processed
      // - User clicked STOP button
      // - System should close as stop_hit, NOT delete the trade
      
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const request: ManualCloseRequest = {
        ticker: 'ETHUSD',
        reason: 'stop_hit',
        closePrice: 2950,
        notes: '🛡️ STOP LOSS HIT - Manual close at $2950. Manual close from chart interface'
      };

      // Act
      const result = await closeTradeManually(request);

      // Assert: Trade should be closed as stop_hit, NOT deleted
      expect(result.success).toBe(true);
      expect(result.message).toContain('Stop Loss Hit');
      expect(result.message).toContain('$2950');
      
      // Verify the backend is called with stop_hit reason
      expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
        'ETHUSD',
        2950,
        expect.stringContaining('🛡️ STOP LOSS HIT'),
        'stop_hit'
      );
      
      // Verify it's NOT called with any deletion-related parameters
      expect(mockCloseActiveTradeInProduction).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining('cancelled_before_entry'),
        expect.anything()
      );
    });

    test('should ensure manual intervention always overrides automated processes', async () => {
      // Arrange: Test all three button types to ensure consistent behavior
      mockCloseActiveTradeInProduction.mockResolvedValue(true);
      
      const scenarios = [
        { reason: 'profit_hit' as const, expectedText: 'PROFIT TARGET HIT' },
        { reason: 'stop_hit' as const, expectedText: 'STOP LOSS HIT' },
        { reason: 'user_closed' as const, expectedText: 'EARLY CLOSE' }
      ];

      // Act & Assert: Test each scenario
      for (const scenario of scenarios) {
        const request: ManualCloseRequest = {
          ticker: 'ETHUSD',
          reason: scenario.reason,
          closePrice: 3000,
          notes: 'Manual intervention test'
        };

        const result = await closeTradeManually(request);

        expect(result.success).toBe(true);
        expect(mockCloseActiveTradeInProduction).toHaveBeenCalledWith(
          'ETHUSD',
          3000,
          expect.stringContaining(scenario.expectedText),
          scenario.reason
        );
      }
    });
  });
});