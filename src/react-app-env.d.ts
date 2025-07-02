/// <reference types="react-scripts" />

// Global window object extensions for browser console utilities
declare global {
  interface Window {
    // Deletion Testing Utilities
    deletionTesting: {
      runTests: () => Promise<any>;
      testStrategies: () => Promise<any>;
      testBackupRollback: () => Promise<any>;
      testPerformance: () => Promise<any>;
      generateReport: (result: any) => string;
    };
    
    // AI Trade Cleanup Utilities
    aiTradeCleanup: {
      // Quick access methods
      status: () => Promise<any>;
      test: () => Promise<any>;
      execute: () => Promise<any>;
      
      // Backup management
      listBackups: () => string[];
      restore: (key: string) => Promise<any>;
      backupInfo: (key: string) => any;
      cleanupBackups: (keep?: number) => number;
      
      // Original execution methods
      dryRun: () => Promise<any>;
      aggressive: () => Promise<any>;
    };
    
    // Full cleanup manager class
    AITradeCleanup: any;
    
    // Browser Console Testing Utilities
    testBrowserConsoleAccess: () => Promise<{
      deletionTesting: boolean;
      aiTradeCleanup: boolean;
      errors: string[];
      warnings: string[];
    }>;
    runComprehensiveTest: () => Promise<void>;
    showBrowserConsoleHelp: () => void;
  }
}

export {};
