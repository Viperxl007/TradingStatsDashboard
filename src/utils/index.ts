/**
 * Utilities Index
 * 
 * Central export point for all utility functions and services
 */

// Export existing utilities
export * from './dateUtils';
export * from './percentageUtils';
export * from './statusMapping';
export * from './technicalIndicators';

// Export AI Trade Cleanup utilities (Backend-Only Architecture)
export * from './aiTradeCleanupIntegration';
export { AITradeCleanupManager, initializeCleanupTools } from './aiTradeCleanupIntegration';

// Note: Legacy IndexedDB cleanup functions removed as part of backend-only migration
// Available functions: AITradeCleanupManager.getTradeStatus(), AITradeCleanupManager.deleteTradesByStatus()