/**
 * Universal Deletion Service
 * 
 * Provides centralized deletion logic for all data types with comprehensive
 * data integrity checks, dependency analysis, and enhanced warning system.
 */

import { AITradeEntry } from '../types/aiTradeTracker';
import { AnyTradeEntry } from '../types/tradeTracker';
import { HistoricalAnalysis } from '../types/chartAnalysis';
import { ActiveTrade } from './activeTradeService';

// Import database services
import { aiTradeService } from './aiTradeService';
import { TradeTrackerDB } from './tradeTrackerDB';
import { deleteAnalysis, deleteAnalysesBulk } from './chartAnalysisService';
import { getAllActiveTradesForAITracker } from './productionActiveTradesService';

/**
 * Data types that can be deleted
 */
export type DeletableDataType = 'ai_trade' | 'trade_tracker' | 'chart_analysis' | 'active_trade';

/**
 * Deletion strategies
 */
export type DeletionStrategy = 'cascade' | 'preserve' | 'warn_and_stop';

/**
 * Dependency relationship between data items
 */
export interface DataDependency {
  id: string;
  type: DeletableDataType;
  dependentId: string;
  dependentType: DeletableDataType;
  relationshipType: 'parent' | 'child' | 'reference' | 'linked';
  description: string;
  critical: boolean; // If true, deletion would break data integrity
}

/**
 * Impact assessment for a deletion operation
 */
export interface DeletionImpact {
  targetId: string;
  targetType: DeletableDataType;
  directDependencies: DataDependency[];
  indirectDependencies: DataDependency[];
  affectedRecordsCount: number;
  criticalDependencies: DataDependency[];
  warnings: string[];
  canDelete: boolean;
  recommendedStrategy: DeletionStrategy;
  alternativeActions: string[];
}

/**
 * Deletion operation configuration
 */
export interface DeletionConfig {
  strategy: DeletionStrategy;
  force: boolean;
  createBackup: boolean;
  dryRun: boolean;
  confirmBeforeDelete: boolean;
  logLevel: 'minimal' | 'detailed' | 'verbose';
  preserveProductionData: boolean;
}

/**
 * Deletion operation result
 */
export interface DeletionResult {
  success: boolean;
  deletedItems: Array<{ id: string; type: DeletableDataType }>;
  preservedItems: Array<{ id: string; type: DeletableDataType; reason: string }>;
  backupPath?: string;
  warnings: string[];
  errors: string[];
  rollbackData?: any;
  executionTime: number;
  affectedRecordsCount: number;
}

/**
 * Rollback operation result
 */
export interface RollbackResult {
  success: boolean;
  restoredItems: Array<{ id: string; type: DeletableDataType }>;
  errors: string[];
}

/**
 * Universal Deletion Service Class
 */
export class UniversalDeletionService {
  private tradeTrackerDB: TradeTrackerDB;
  private rollbackData: Map<string, any> = new Map();

  constructor() {
    this.tradeTrackerDB = new TradeTrackerDB();
  }

  /**
   * Analyze dependencies for a specific data item
   */
  async analyzeDependencies(id: string, type: DeletableDataType): Promise<DataDependency[]> {
    const dependencies: DataDependency[] = [];

    try {
      switch (type) {
        case 'ai_trade':
          dependencies.push(...await this.analyzeAITradeDependencies(id));
          break;
        case 'trade_tracker':
          dependencies.push(...await this.analyzeTradeTrackerDependencies(id));
          break;
        case 'chart_analysis':
          dependencies.push(...await this.analyzeChartAnalysisDependencies(id));
          break;
        case 'active_trade':
          dependencies.push(...await this.analyzeActiveTradeDependencies(id));
          break;
      }
    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error analyzing dependencies for ${type}:${id}:`, error);
    }

    return dependencies;
  }

  /**
   * Analyze dependencies for AI Trade
   */
  private async analyzeAITradeDependencies(id: string): Promise<DataDependency[]> {
    const dependencies: DataDependency[] = [];

    try {
      await aiTradeService.init();
      const aiTrade = await aiTradeService.getTradeById(id);
      
      if (!aiTrade) {
        return dependencies;
      }

      // Check for linked chart analysis
      if (aiTrade.analysisId) {
        dependencies.push({
          id: aiTrade.analysisId,
          type: 'chart_analysis',
          dependentId: id,
          dependentType: 'ai_trade',
          relationshipType: 'parent',
          description: `AI Trade ${id} was generated from Chart Analysis ${aiTrade.analysisId}`,
          critical: false
        });
      }

      // Check for active trades with same ticker and timeframe
      const activeTrades = await getAllActiveTradesForAITracker();
      const relatedActiveTrades = activeTrades.filter(trade => 
        trade.ticker === aiTrade.ticker && 
        trade.timeframe === aiTrade.timeframe &&
        Math.abs(trade.entryDate - aiTrade.entryDate) < 24 * 60 * 60 * 1000 // Within 24 hours
      );

      relatedActiveTrades.forEach(activeTrade => {
        dependencies.push({
          id: activeTrade.id,
          type: 'active_trade',
          dependentId: id,
          dependentType: 'ai_trade',
          relationshipType: 'linked',
          description: `Active trade ${activeTrade.id} may be related to AI Trade ${id} (same ticker/timeframe)`,
          critical: activeTrade.status === 'open'
        });
      });

      // Check for trade tracker entries with similar parameters
      const allTrades = await this.tradeTrackerDB.getAllTrades();
      const relatedTrades = allTrades.filter(trade => 
        trade.ticker === aiTrade.ticker &&
        Math.abs(new Date(trade.entryDate).getTime() - aiTrade.entryDate) < 7 * 24 * 60 * 60 * 1000 // Within 7 days
      );

      relatedTrades.forEach(trade => {
        dependencies.push({
          id: trade.id,
          type: 'trade_tracker',
          dependentId: id,
          dependentType: 'ai_trade',
          relationshipType: 'reference',
          description: `Trade Tracker entry ${trade.id} may reference AI Trade ${id} (similar timing/ticker)`,
          critical: trade.status === 'open'
        });
      });

    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error analyzing AI trade dependencies:`, error);
    }

    return dependencies;
  }

  /**
   * Analyze dependencies for Trade Tracker entry
   */
  private async analyzeTradeTrackerDependencies(id: string): Promise<DataDependency[]> {
    const dependencies: DataDependency[] = [];

    try {
      const trade = await this.tradeTrackerDB.getTrade(id);
      
      if (!trade) {
        return dependencies;
      }

      // Check for related AI trades
      await aiTradeService.init();
      const aiTrades = await aiTradeService.getAllTrades();
      const relatedAITrades = aiTrades.filter(aiTrade => 
        aiTrade.ticker === trade.ticker &&
        Math.abs(aiTrade.entryDate - new Date(trade.entryDate).getTime()) < 7 * 24 * 60 * 60 * 1000
      );

      relatedAITrades.forEach(aiTrade => {
        dependencies.push({
          id: aiTrade.id,
          type: 'ai_trade',
          dependentId: id,
          dependentType: 'trade_tracker',
          relationshipType: 'reference',
          description: `AI Trade ${aiTrade.id} may be related to Trade Tracker entry ${id}`,
          critical: false
        });
      });

      // Check for active trades
      const activeTrades = await getAllActiveTradesForAITracker();
      const relatedActiveTrades = activeTrades.filter(activeTrade => 
        activeTrade.ticker === trade.ticker &&
        Math.abs(activeTrade.entryDate - new Date(trade.entryDate).getTime()) < 24 * 60 * 60 * 1000
      );

      relatedActiveTrades.forEach(activeTrade => {
        dependencies.push({
          id: activeTrade.id,
          type: 'active_trade',
          dependentId: id,
          dependentType: 'trade_tracker',
          relationshipType: 'linked',
          description: `Active trade ${activeTrade.id} may be linked to Trade Tracker entry ${id}`,
          critical: activeTrade.status === 'open'
        });
      });

    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error analyzing trade tracker dependencies:`, error);
    }

    return dependencies;
  }

  /**
   * Analyze dependencies for Chart Analysis
   */
  private async analyzeChartAnalysisDependencies(id: string): Promise<DataDependency[]> {
    const dependencies: DataDependency[] = [];

    try {
      // Check for AI trades generated from this analysis
      await aiTradeService.init();
      const aiTrades = await aiTradeService.getAllTrades();
      const dependentAITrades = aiTrades.filter(trade => trade.analysisId === id);

      dependentAITrades.forEach(aiTrade => {
        dependencies.push({
          id: aiTrade.id,
          type: 'ai_trade',
          dependentId: id,
          dependentType: 'chart_analysis',
          relationshipType: 'child',
          description: `AI Trade ${aiTrade.id} was generated from Chart Analysis ${id}`,
          critical: aiTrade.status === 'waiting' || aiTrade.status === 'open'
        });
      });

    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error analyzing chart analysis dependencies:`, error);
    }

    return dependencies;
  }

  /**
   * Analyze dependencies for Active Trade
   */
  private async analyzeActiveTradeDependencies(id: string): Promise<DataDependency[]> {
    const dependencies: DataDependency[] = [];

    try {
      const activeTrades = await getAllActiveTradesForAITracker();
      const activeTrade = activeTrades.find(trade => trade.id === id);
      
      if (!activeTrade) {
        return dependencies;
      }

      // Check for related AI trades
      await aiTradeService.init();
      const aiTrades = await aiTradeService.getAllTrades();
      const relatedAITrades = aiTrades.filter(aiTrade => 
        aiTrade.ticker === activeTrade.ticker &&
        Math.abs(aiTrade.entryDate - activeTrade.entryDate) < 24 * 60 * 60 * 1000
      );

      relatedAITrades.forEach(aiTrade => {
        dependencies.push({
          id: aiTrade.id,
          type: 'ai_trade',
          dependentId: id,
          dependentType: 'active_trade',
          relationshipType: 'linked',
          description: `AI Trade ${aiTrade.id} may be linked to Active Trade ${id}`,
          critical: false
        });
      });

      // Check for trade tracker entries
      const allTrades = await this.tradeTrackerDB.getAllTrades();
      const relatedTrades = allTrades.filter(trade => 
        trade.ticker === activeTrade.ticker &&
        Math.abs(new Date(trade.entryDate).getTime() - activeTrade.entryDate) < 24 * 60 * 60 * 1000
      );

      relatedTrades.forEach(trade => {
        dependencies.push({
          id: trade.id,
          type: 'trade_tracker',
          dependentId: id,
          dependentType: 'active_trade',
          relationshipType: 'linked',
          description: `Trade Tracker entry ${trade.id} may be linked to Active Trade ${id}`,
          critical: false
        });
      });

    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error analyzing active trade dependencies:`, error);
    }

    return dependencies;
  }

  /**
   * Assess the impact of deleting a specific item
   */
  async assessDeletionImpact(id: string, type: DeletableDataType): Promise<DeletionImpact> {
    const startTime = Date.now();
    
    console.log(`🔍 [UniversalDeletion] Assessing deletion impact for ${type}:${id}`);

    const directDependencies = await this.analyzeDependencies(id, type);
    const indirectDependencies: DataDependency[] = [];
    
    // Analyze indirect dependencies (dependencies of dependencies)
    // Prevent circular dependencies by tracking analyzed items
    const analyzedItems = new Set([`${type}:${id}`]);
    
    for (const dep of directDependencies) {
      const depKey = `${dep.type}:${dep.id}`;
      if (!analyzedItems.has(depKey)) {
        analyzedItems.add(depKey);
        const indirectDeps = await this.analyzeDependencies(dep.id, dep.type);
        
        // Filter out circular references and already analyzed items
        const filteredIndirectDeps = indirectDeps.filter(indirectDep => {
          const indirectDepKey = `${indirectDep.type}:${indirectDep.id}`;
          return !analyzedItems.has(indirectDepKey) && indirectDepKey !== `${type}:${id}`;
        });
        
        indirectDependencies.push(...filteredIndirectDeps);
      }
    }

    const criticalDependencies = [...directDependencies, ...indirectDependencies]
      .filter(dep => dep.critical);

    const warnings: string[] = [];
    const alternativeActions: string[] = [];

    // Generate warnings based on dependencies
    if (criticalDependencies.length > 0) {
      warnings.push(`⚠️ ${criticalDependencies.length} critical dependencies found that may break data integrity`);
      alternativeActions.push('Close related active trades before deletion');
      alternativeActions.push('Use preservation strategy to maintain references');
    }

    if (directDependencies.length > 0) {
      warnings.push(`📊 ${directDependencies.length} direct dependencies will be affected`);
    }

    if (indirectDependencies.length > 0) {
      warnings.push(`🔗 ${indirectDependencies.length} indirect dependencies may be impacted`);
    }

    // Determine if deletion is safe
    const canDelete = criticalDependencies.length === 0;
    
    // Recommend strategy
    let recommendedStrategy: DeletionStrategy = 'cascade';
    if (criticalDependencies.length > 0) {
      recommendedStrategy = 'warn_and_stop';
    } else if (directDependencies.length > 0) {
      recommendedStrategy = 'preserve';
    }

    const affectedRecordsCount = directDependencies.length + indirectDependencies.length;

    const impact: DeletionImpact = {
      targetId: id,
      targetType: type,
      directDependencies,
      indirectDependencies,
      affectedRecordsCount,
      criticalDependencies,
      warnings,
      canDelete,
      recommendedStrategy,
      alternativeActions
    };

    const executionTime = Date.now() - startTime;
    console.log(`✅ [UniversalDeletion] Impact assessment completed in ${executionTime}ms`);

    return impact;
  }

  /**
   * Assess impact for bulk deletion
   */
  async assessBulkDeletionImpact(
    items: Array<{ id: string; type: DeletableDataType }>
  ): Promise<DeletionImpact[]> {
    console.log(`🔍 [UniversalDeletion] Assessing bulk deletion impact for ${items.length} items`);

    const impacts: DeletionImpact[] = [];
    
    for (const item of items) {
      const impact = await this.assessDeletionImpact(item.id, item.type);
      impacts.push(impact);
    }

    return impacts;
  }

  /**
   * Create backup before deletion
   */
  private async createBackup(
    items: Array<{ id: string; type: DeletableDataType }>,
    reason: string
  ): Promise<string> {
    const timestamp = Date.now();
    const backupKey = `universal_deletion_backup_${timestamp}`;
    
    const backupData: any = {
      timestamp,
      reason,
      items: [],
      metadata: {
        version: '1.0.0',
        totalItems: items.length,
        types: [...new Set(items.map(item => item.type))]
      }
    };

    // Collect data for each item
    for (const item of items) {
      try {
        let data: any = null;
        
        switch (item.type) {
          case 'ai_trade':
            await aiTradeService.init();
            data = await aiTradeService.getTradeById(item.id);
            break;
          case 'trade_tracker':
            data = await this.tradeTrackerDB.getTrade(item.id);
            break;
          case 'chart_analysis':
            // Chart analysis backup would need backend API call
            data = { id: item.id, type: 'chart_analysis', note: 'Backend data - restore manually if needed' };
            break;
          case 'active_trade':
            const activeTrades = await getAllActiveTradesForAITracker();
            data = activeTrades.find(trade => trade.id === item.id);
            break;
        }

        if (data) {
          backupData.items.push({
            id: item.id,
            type: item.type,
            data
          });
        }
      } catch (error) {
        console.error(`❌ [UniversalDeletion] Error backing up ${item.type}:${item.id}:`, error);
      }
    }

    // Store backup
    localStorage.setItem(backupKey, JSON.stringify(backupData));
    
    console.log(`💾 [UniversalDeletion] Created backup: ${backupKey} (${backupData.items.length} items)`);
    
    return backupKey;
  }

  /**
   * Execute deletion with specified strategy
   */
  async executeDeletion(
    items: Array<{ id: string; type: DeletableDataType }>,
    config: DeletionConfig
  ): Promise<DeletionResult> {
    const startTime = Date.now();
    
    console.log(`🗑️ [UniversalDeletion] Starting deletion of ${items.length} items`);
    console.log(`   Strategy: ${config.strategy}`);
    console.log(`   Dry run: ${config.dryRun}`);
    console.log(`   Force: ${config.force}`);

    const result: DeletionResult = {
      success: false,
      deletedItems: [],
      preservedItems: [],
      warnings: [],
      errors: [],
      executionTime: 0,
      affectedRecordsCount: 0
    };

    try {
      // Create backup if requested
      if (config.createBackup && !config.dryRun) {
        result.backupPath = await this.createBackup(items, 'Universal deletion operation');
      }

      // Assess impact for all items
      const impacts = await this.assessBulkDeletionImpact(items);
      
      // Check for critical dependencies if not forcing
      if (!config.force) {
        const criticalIssues = impacts.filter(impact => !impact.canDelete);
        if (criticalIssues.length > 0) {
          result.errors.push(`❌ ${criticalIssues.length} items have critical dependencies and cannot be safely deleted`);
          criticalIssues.forEach(issue => {
            result.errors.push(`   • ${issue.targetType}:${issue.targetId} - ${issue.criticalDependencies.length} critical dependencies`);
          });
          return result;
        }
      }

      // Execute deletion based on strategy
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const impact = impacts[i];
        
        try {
          if (config.dryRun) {
            // Dry run - just log what would happen
            console.log(`🧪 [DryRun] Would delete ${item.type}:${item.id}`);
            result.deletedItems.push(item);
          } else {
            // Actual deletion
            const deleteSuccess = await this.deleteItem(item.id, item.type, config);
            
            if (deleteSuccess) {
              result.deletedItems.push(item);
              console.log(`✅ [UniversalDeletion] Deleted ${item.type}:${item.id}`);
            } else {
              result.preservedItems.push({
                ...item,
                reason: 'Deletion failed'
              });
              result.errors.push(`Failed to delete ${item.type}:${item.id}`);
            }
          }
          
          result.affectedRecordsCount += impact.affectedRecordsCount;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error deleting ${item.type}:${item.id}: ${errorMsg}`);
          result.preservedItems.push({
            ...item,
            reason: errorMsg
          });
        }
      }

      result.success = result.errors.length === 0;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Deletion operation failed: ${errorMsg}`);
      console.error(`❌ [UniversalDeletion] Operation failed:`, error);
    }

    result.executionTime = Date.now() - startTime;
    
    console.log(`${result.success ? '✅' : '❌'} [UniversalDeletion] Operation completed in ${result.executionTime}ms`);
    console.log(`   Deleted: ${result.deletedItems.length} items`);
    console.log(`   Preserved: ${result.preservedItems.length} items`);
    console.log(`   Errors: ${result.errors.length}`);

    return result;
  }

  /**
   * Delete a single item
   */
  private async deleteItem(id: string, type: DeletableDataType, config: DeletionConfig): Promise<boolean> {
    try {
      switch (type) {
        case 'ai_trade':
          await aiTradeService.init();
          await aiTradeService.deleteTrade(id);
          console.log(`✅ [UniversalDeletion] Successfully deleted AI trade: ${id}`);
          return true;
          
        case 'trade_tracker':
          return await this.tradeTrackerDB.deleteTrade(id);
          
        case 'chart_analysis':
          const result = await deleteAnalysis(id, config.force);
          return result.success;
          
        case 'active_trade':
          // Active trades are managed by backend - would need API call
          console.warn(`⚠️ [UniversalDeletion] Active trade deletion not implemented - requires backend API`);
          return false;
          
        default:
          throw new Error(`Unknown data type: ${type}`);
      }
    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error deleting ${type}:${id}:`, error);
      return false;
    }
  }

  /**
   * Rollback a deletion operation
   */
  async rollbackDeletion(backupKey: string): Promise<RollbackResult> {
    console.log(`🔄 [UniversalDeletion] Rolling back deletion from backup: ${backupKey}`);

    const result: RollbackResult = {
      success: false,
      restoredItems: [],
      errors: []
    };

    try {
      const backupJson = localStorage.getItem(backupKey);
      if (!backupJson) {
        throw new Error(`Backup not found: ${backupKey}`);
      }

      const backupData = JSON.parse(backupJson);
      
      for (const item of backupData.items) {
        try {
          switch (item.type) {
            case 'ai_trade':
              await aiTradeService.init();
              await aiTradeService.createTrade(item.data);
              result.restoredItems.push({ id: item.id, type: item.type });
              break;
              
            case 'trade_tracker':
              await this.tradeTrackerDB.createTrade(item.data);
              result.restoredItems.push({ id: item.id, type: item.type });
              break;
              
            case 'chart_analysis':
              result.errors.push(`Chart analysis ${item.id} requires manual restoration via backend`);
              break;
              
            case 'active_trade':
              result.errors.push(`Active trade ${item.id} requires manual restoration via backend`);
              break;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Failed to restore ${item.type}:${item.id}: ${errorMsg}`);
        }
      }

      result.success = result.errors.length === 0;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Rollback operation failed: ${errorMsg}`);
    }

    console.log(`${result.success ? '✅' : '❌'} [UniversalDeletion] Rollback completed`);
    console.log(`   Restored: ${result.restoredItems.length} items`);
    console.log(`   Errors: ${result.errors.length}`);

    return result;
  }

  /**
   * Get deletion statistics and recommendations
   */
  async getDeletionStatistics(): Promise<{
    totalItems: Record<DeletableDataType, number>;
    deletableItems: Record<DeletableDataType, number>;
    criticalDependencies: number;
    recommendations: string[];
  }> {
    const stats = {
      totalItems: {
        ai_trade: 0,
        trade_tracker: 0,
        chart_analysis: 0,
        active_trade: 0
      } as Record<DeletableDataType, number>,
      deletableItems: {
        ai_trade: 0,
        trade_tracker: 0,
        chart_analysis: 0,
        active_trade: 0
      } as Record<DeletableDataType, number>,
      criticalDependencies: 0,
      recommendations: [] as string[]
    };

    try {
      // Count AI trades
      await aiTradeService.init();
      const aiTrades = await aiTradeService.getAllTrades();
      stats.totalItems.ai_trade = aiTrades.length;
      stats.deletableItems.ai_trade = aiTrades.filter(trade => 
        trade.status === 'user_closed' || trade.status === 'closed'
      ).length;

      // Count trade tracker entries
      const trades = await this.tradeTrackerDB.getAllTrades();
      stats.totalItems.trade_tracker = trades.length;
      stats.deletableItems.trade_tracker = trades.filter(trade => 
        trade.status === 'closed'
      ).length;

      // Count active trades
      const activeTrades = await getAllActiveTradesForAITracker();
      stats.totalItems.active_trade = activeTrades.length;
      stats.deletableItems.active_trade = activeTrades.filter(trade =>
        trade.status === 'waiting'
      ).length;

      // Generate recommendations
      if (stats.deletableItems.ai_trade > 0) {
        stats.recommendations.push(`${stats.deletableItems.ai_trade} closed AI trades can be safely deleted`);
      }
      
      if (stats.deletableItems.trade_tracker > 0) {
        stats.recommendations.push(`${stats.deletableItems.trade_tracker} closed trade tracker entries can be deleted`);
      }

      if (stats.totalItems.active_trade > stats.deletableItems.active_trade) {
        const activeCount = stats.totalItems.active_trade - stats.deletableItems.active_trade;
        stats.recommendations.push(`${activeCount} active trades should be closed before deletion`);
      }

    } catch (error) {
      console.error(`❌ [UniversalDeletion] Error getting deletion statistics:`, error);
    }

    return stats;
  }
}

// Export singleton instance
export const universalDeletionService = new UniversalDeletionService();
