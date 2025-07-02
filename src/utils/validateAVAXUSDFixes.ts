/**
 * AVAXUSD Data Synchronization Validation Script
 * 
 * This script validates that all the implemented fixes for AVAXUSD data synchronization
 * are working correctly and the system properly synchronizes trade context across components.
 */

import { 
  mapProductionStatusToAIStatus, 
  isActiveTradeStatus, 
  isWaitingTradeStatus,
  getStatusDisplayText,
  getStatusColorScheme,
  ProductionTradeStatus 
} from './statusMapping';
import { 
  prepareContextSync, 
  enhanceAnalysisRequest, 
  validateContextResponse 
} from '../services/contextSynchronizationService';
import { fetchActiveTradeFromProduction } from '../services/productionActiveTradesService';
import { ChartAnalysisRequest } from '../types/chartAnalysis';

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
  error?: string;
}

interface ValidationReport {
  overallStatus: 'PASSED' | 'FAILED' | 'PARTIAL';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: ValidationResult[];
  summary: string;
}

/**
 * Validate Status Mapping Consistency
 */
const validateStatusMapping = (): ValidationResult[] => {
  const results: ValidationResult[] = [];
  
  // Test 1: Production to AI status mapping
  try {
    const testCases: Array<{ production: ProductionTradeStatus; expected: string }> = [
      { production: 'waiting', expected: 'waiting' },
      { production: 'active', expected: 'open' },
      { production: 'profit_hit', expected: 'profit_hit' },
      { production: 'stop_hit', expected: 'stop_hit' },
      { production: 'ai_closed', expected: 'ai_closed' },
      { production: 'user_closed', expected: 'user_closed' }
    ];
    
    let allPassed = true;
    let details = '';
    
    for (const testCase of testCases) {
      const result = mapProductionStatusToAIStatus(testCase.production);
      if (result !== testCase.expected) {
        allPassed = false;
        details += `❌ ${testCase.production} -> ${result} (expected ${testCase.expected})\n`;
      } else {
        details += `✅ ${testCase.production} -> ${result}\n`;
      }
    }
    
    results.push({
      test: 'Status Mapping Consistency',
      passed: allPassed,
      details: details.trim()
    });
  } catch (error) {
    results.push({
      test: 'Status Mapping Consistency',
      passed: false,
      details: 'Failed to test status mapping',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 2: Status checking functions
  try {
    const statusTests = [
      { status: 'open', isActive: true, isWaiting: false },
      { status: 'active', isActive: true, isWaiting: false },
      { status: 'waiting', isActive: false, isWaiting: true },
      { status: 'closed', isActive: false, isWaiting: false }
    ];
    
    let allPassed = true;
    let details = '';
    
    for (const test of statusTests) {
      const activeResult = isActiveTradeStatus(test.status as any);
      const waitingResult = isWaitingTradeStatus(test.status as any);
      
      if (activeResult !== test.isActive || waitingResult !== test.isWaiting) {
        allPassed = false;
        details += `❌ ${test.status}: active=${activeResult}(${test.isActive}), waiting=${waitingResult}(${test.isWaiting})\n`;
      } else {
        details += `✅ ${test.status}: active=${activeResult}, waiting=${waitingResult}\n`;
      }
    }
    
    results.push({
      test: 'Status Checking Functions',
      passed: allPassed,
      details: details.trim()
    });
  } catch (error) {
    results.push({
      test: 'Status Checking Functions',
      passed: false,
      details: 'Failed to test status checking functions',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 3: Display text consistency
  try {
    const displayTests = [
      { status: 'waiting', expected: 'WAITING' },
      { status: 'open', expected: 'TAKEN & OPEN' },
      { status: 'active', expected: 'TAKEN & OPEN' },
      { status: 'profit_hit', expected: 'PROFIT HIT' }
    ];
    
    let allPassed = true;
    let details = '';
    
    for (const test of displayTests) {
      const result = getStatusDisplayText(test.status as any);
      if (result !== test.expected) {
        allPassed = false;
        details += `❌ ${test.status} -> "${result}" (expected "${test.expected}")\n`;
      } else {
        details += `✅ ${test.status} -> "${result}"\n`;
      }
    }
    
    results.push({
      test: 'Status Display Text Consistency',
      passed: allPassed,
      details: details.trim()
    });
  } catch (error) {
    results.push({
      test: 'Status Display Text Consistency',
      passed: false,
      details: 'Failed to test display text consistency',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
};

/**
 * Validate Context Synchronization Service
 */
const validateContextSync = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  
  // Test 1: Context sync preparation
  try {
    const contextSync = await prepareContextSync('AVAXUSD', '1D', 45.50);
    
    const hasRequiredFields = contextSync.ticker === 'AVAXUSD' && 
                             contextSync.timeframe === '1D' && 
                             contextSync.currentPrice === 45.50 &&
                             ['fresh', 'continuation', 'trigger_activation'].includes(contextSync.analysisType);
    
    results.push({
      test: 'Context Sync Preparation',
      passed: hasRequiredFields,
      details: hasRequiredFields 
        ? `✅ Context sync prepared: ${contextSync.analysisType} analysis for ${contextSync.ticker}`
        : `❌ Missing required fields in context sync response`
    });
  } catch (error) {
    results.push({
      test: 'Context Sync Preparation',
      passed: false,
      details: 'Failed to prepare context sync',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test 2: Analysis request enhancement
  try {
    const baseRequest: ChartAnalysisRequest = {
      ticker: 'AVAXUSD',
      timeframe: '1D',
      chartImage: 'base64-test-data',
      currentPrice: 45.50
    };
    
    const contextSync = await prepareContextSync('AVAXUSD', '1D', 45.50);
    const enhancedRequest = enhanceAnalysisRequest(baseRequest, contextSync);
    
    const hasContextSync = (enhancedRequest as any).contextSync !== undefined;
    
    results.push({
      test: 'Analysis Request Enhancement',
      passed: hasContextSync,
      details: hasContextSync 
        ? `✅ Request enhanced with context sync data`
        : `❌ Context sync data not added to request`
    });
  } catch (error) {
    results.push({
      test: 'Analysis Request Enhancement',
      passed: false,
      details: 'Failed to enhance analysis request',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
};

/**
 * Validate Production Integration
 */
const validateProductionIntegration = async (): Promise<ValidationResult[]> => {
  const results: ValidationResult[] = [];
  
  // Test 1: Production API connectivity
  try {
    const activeTrade = await fetchActiveTradeFromProduction('AVAXUSD');
    
    results.push({
      test: 'Production API Connectivity',
      passed: true, // If no error thrown, connection works
      details: activeTrade 
        ? `✅ Found active trade for AVAXUSD: ${activeTrade.status}`
        : `✅ No active trade found for AVAXUSD (API accessible)`
    });
  } catch (error) {
    results.push({
      test: 'Production API Connectivity',
      passed: false,
      details: 'Failed to connect to production API',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
};

/**
 * Validate Backward Compatibility
 */
const validateBackwardCompatibility = (): ValidationResult[] => {
  const results: ValidationResult[] = [];
  
  // Test 1: Legacy status handling
  try {
    // Test that old status values still work
    const legacyStatuses = ['active', 'open', 'waiting', 'closed'];
    let allPassed = true;
    let details = '';
    
    for (const status of legacyStatuses) {
      try {
        const displayText = getStatusDisplayText(status as any);
        const colorScheme = getStatusColorScheme(status as any);
        
        if (displayText && colorScheme) {
          details += `✅ ${status} -> "${displayText}" (${colorScheme})\n`;
        } else {
          allPassed = false;
          details += `❌ ${status} -> missing display text or color\n`;
        }
      } catch (error) {
        allPassed = false;
        details += `❌ ${status} -> error processing\n`;
      }
    }
    
    results.push({
      test: 'Legacy Status Handling',
      passed: allPassed,
      details: details.trim()
    });
  } catch (error) {
    results.push({
      test: 'Legacy Status Handling',
      passed: false,
      details: 'Failed to test legacy status handling',
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
};

/**
 * Run comprehensive validation of AVAXUSD fixes
 */
export const validateAVAXUSDFixes = async (): Promise<ValidationReport> => {
  console.log('🔍 Starting AVAXUSD Data Synchronization Validation...\n');
  
  const allResults: ValidationResult[] = [];
  
  // Run all validation tests
  console.log('📊 Validating Status Mapping...');
  allResults.push(...validateStatusMapping());
  
  console.log('🔄 Validating Context Synchronization...');
  allResults.push(...(await validateContextSync()));
  
  console.log('🏭 Validating Production Integration...');
  allResults.push(...(await validateProductionIntegration()));
  
  console.log('🔙 Validating Backward Compatibility...');
  allResults.push(...validateBackwardCompatibility());
  
  // Calculate results
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;
  
  const overallStatus: 'PASSED' | 'FAILED' | 'PARTIAL' = 
    failedTests === 0 ? 'PASSED' : 
    passedTests === 0 ? 'FAILED' : 'PARTIAL';
  
  const summary = `Validation ${overallStatus}: ${passedTests}/${totalTests} tests passed. ` +
    (failedTests > 0 ? `${failedTests} tests failed.` : 'All systems operational.');
  
  return {
    overallStatus,
    totalTests,
    passedTests,
    failedTests,
    results: allResults,
    summary
  };
};

/**
 * Print validation report to console
 */
export const printValidationReport = (report: ValidationReport): void => {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 AVAXUSD DATA SYNCHRONIZATION VALIDATION REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n📊 OVERALL STATUS: ${report.overallStatus}`);
  console.log(`📈 TESTS PASSED: ${report.passedTests}/${report.totalTests}`);
  console.log(`📉 TESTS FAILED: ${report.failedTests}/${report.totalTests}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  console.log('-'.repeat(80));
  
  for (const result of report.results) {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`\n${status}: ${result.test}`);
    console.log(result.details);
    
    if (result.error) {
      console.log(`🚨 Error: ${result.error}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📝 SUMMARY: ${report.summary}`);
  console.log('='.repeat(80));
};

// Export for use in other modules
export default {
  validateAVAXUSDFixes,
  printValidationReport
};