/**
 * Percentage Return Calculation Utilities
 * 
 * This file contains utility functions for calculating percentage returns on trades.
 */

import { AnyTradeEntry, OptionTradeEntry } from '../types/tradeTracker';

/**
 * Calculate the entry cost for a trade (entry price * quantity + fees)
 * For options: entry price is per contract, but each contract represents 100 shares
 * @param trade - The trade entry
 * @returns The total entry cost including fees
 */
export const calculateEntryCost = (trade: AnyTradeEntry): number => {
  if (!trade.entryPrice || trade.entryPrice === 0 || !trade.quantity) {
    return 0;
  }

  // For stock trades, entry cost is straightforward
  if (trade.strategy === 'stock') {
    return (trade.entryPrice * trade.quantity) + (trade.fees || 0);
  }

  // For option trades, we need to consider the legs
  const optionTrade = trade as OptionTradeEntry;
  if (!optionTrade.legs || optionTrade.legs.length === 0) {
    // Fallback to simple calculation if no legs data
    // For options, entryPrice is per contract, so multiply by 100 for actual value
    return (trade.entryPrice * trade.quantity * 100) + (trade.fees || 0);
  }

  // Calculate total premium paid/received for all legs
  // Remember: options premiums are quoted per contract, but each contract = 100 shares
  let totalPremium = 0;
  for (const leg of optionTrade.legs) {
    const legValue = leg.premium * leg.quantity * 100; // Multiply by 100 for actual contract value
    // If long, we pay premium (debit), if short, we receive premium (credit)
    totalPremium += leg.isLong ? legValue : -legValue;
  }

  // Entry cost is the net debit (positive) or credit (negative) plus fees
  return Math.abs(totalPremium) + (trade.fees || 0);
};

/**
 * Calculate percentage return for a trade
 * @param trade - The trade entry
 * @returns The percentage return or null if it cannot be calculated
 */
export const calculatePercentageReturn = (trade: AnyTradeEntry): number | null => {
  // Can only calculate percentage return for closed trades with profit/loss
  if (trade.status !== 'closed' || trade.profitLoss === undefined) {
    return null;
  }

  const entryCost = calculateEntryCost(trade);
  
  // Cannot calculate percentage if entry cost is zero or negative
  if (entryCost <= 0) {
    return null;
  }

  // Percentage return = (profit/loss / entry cost) * 100
  return (trade.profitLoss / entryCost) * 100;
};

/**
 * Format percentage return for display
 * @param percentage - The percentage value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string with parentheses
 */
export const formatPercentageReturn = (percentage: number | null, decimals: number = 1): string => {
  if (percentage === null || percentage === undefined) {
    return '';
  }

  const sign = percentage >= 0 ? '+' : '';
  return `(${sign}${percentage.toFixed(decimals)}%)`;
};

/**
 * Calculate overall portfolio percentage return
 * @param trades - Array of all trades
 * @returns Overall percentage return or null if it cannot be calculated
 */
export const calculatePortfolioPercentageReturn = (trades: AnyTradeEntry[]): number | null => {
  const closedTrades = trades.filter(trade => 
    trade.status === 'closed' && 
    trade.profitLoss !== undefined
  );

  if (closedTrades.length === 0) {
    return null;
  }

  let totalEntryCost = 0;
  let totalProfitLoss = 0;

  for (const trade of closedTrades) {
    const entryCost = calculateEntryCost(trade);
    if (entryCost > 0) {
      totalEntryCost += entryCost;
      totalProfitLoss += trade.profitLoss!;
    }
  }

  if (totalEntryCost <= 0) {
    return null;
  }

  return (totalProfitLoss / totalEntryCost) * 100;
};