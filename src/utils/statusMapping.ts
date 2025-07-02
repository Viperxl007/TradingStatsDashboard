/**
 * Status Mapping Utilities
 * 
 * Provides consistent status mapping and display logic across all components
 * to eliminate UI inconsistencies between production trades and AI trade tracker.
 */

import { AITradeStatus } from '../types/aiTradeTracker';

// Production trade statuses from backend
export type ProductionTradeStatus = 'waiting' | 'active' | 'profit_hit' | 'stop_hit' | 'ai_closed' | 'user_closed';

// Standardized status mapping from production to AI Trade Tracker
export const mapProductionStatusToAIStatus = (productionStatus: ProductionTradeStatus): AITradeStatus => {
  switch (productionStatus) {
    case 'waiting':
      return 'waiting';
    case 'active':
      return 'open';
    case 'profit_hit':
      return 'profit_hit';
    case 'stop_hit':
      return 'stop_hit';
    case 'ai_closed':
      return 'ai_closed';
    case 'user_closed':
      return 'user_closed';
    default:
      return 'closed'; // fallback for any unknown status
  }
};

// Reverse mapping from AI status to production status
export const mapAIStatusToProductionStatus = (aiStatus: AITradeStatus): ProductionTradeStatus => {
  switch (aiStatus) {
    case 'waiting':
      return 'waiting';
    case 'open':
      return 'active';
    case 'profit_hit':
      return 'profit_hit';
    case 'stop_hit':
      return 'stop_hit';
    case 'ai_closed':
      return 'ai_closed';
    case 'user_closed':
      return 'user_closed';
    default:
      return 'user_closed'; // fallback for closed/cancelled/expired
  }
};

// Check if a status represents an active/open trade
export const isActiveTradeStatus = (status: AITradeStatus | ProductionTradeStatus): boolean => {
  return status === 'open' || status === 'active';
};

// Check if a status represents a waiting trade
export const isWaitingTradeStatus = (status: AITradeStatus | ProductionTradeStatus): boolean => {
  return status === 'waiting';
};

// Check if a status represents a closed trade
export const isClosedTradeStatus = (status: AITradeStatus | ProductionTradeStatus): boolean => {
  return ['closed', 'profit_hit', 'stop_hit', 'ai_closed', 'user_closed', 'cancelled', 'expired'].includes(status);
};

// Get display text for status
export const getStatusDisplayText = (status: AITradeStatus | ProductionTradeStatus): string => {
  switch (status) {
    case 'waiting':
      return 'WAITING';
    case 'open':
    case 'active':
      return 'TAKEN & OPEN';
    case 'profit_hit':
      return 'PROFIT HIT';
    case 'stop_hit':
      return 'STOP HIT';
    case 'ai_closed':
      return 'AI CLOSED';
    case 'user_closed':
      return 'USER CLOSED';
    case 'cancelled':
      return 'CANCELLED';
    case 'expired':
      return 'EXPIRED';
    case 'closed':
      return 'CLOSED';
    default:
      return String(status).toUpperCase();
  }
};

// Get color scheme for status badges
export const getStatusColorScheme = (status: AITradeStatus | ProductionTradeStatus): string => {
  switch (status) {
    case 'waiting':
      return 'yellow';
    case 'open':
    case 'active':
      return 'green';
    case 'profit_hit':
      return 'green';
    case 'stop_hit':
      return 'red';
    case 'ai_closed':
      return 'blue';
    case 'user_closed':
      return 'purple';
    case 'cancelled':
      return 'red';
    case 'expired':
      return 'orange';
    case 'closed':
      return 'gray';
    default:
      return 'gray';
  }
};

// Normalize status for consistent comparison
export const normalizeStatus = (status: string): AITradeStatus => {
  const normalized = status.toLowerCase().trim();
  
  // Handle common variations
  if (normalized === 'active') return 'open';
  if (normalized === 'taken & open') return 'open';
  if (normalized === 'open') return 'open';
  if (normalized === 'waiting') return 'waiting';
  if (normalized === 'profit_hit') return 'profit_hit';
  if (normalized === 'stop_hit') return 'stop_hit';
  if (normalized === 'ai_closed') return 'ai_closed';
  if (normalized === 'user_closed') return 'user_closed';
  if (normalized === 'cancelled') return 'cancelled';
  if (normalized === 'expired') return 'expired';
  
  return 'closed'; // fallback
};