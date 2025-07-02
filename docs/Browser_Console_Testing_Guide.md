# Browser Console Testing Guide

## Overview

This guide explains how to use the browser console utilities for testing the deletion system and AI trade cleanup functionality. All utilities are automatically loaded when the application starts and are accessible through the browser's developer console.

## Quick Start

1. **Open the application** in your browser (usually `http://localhost:3000`)
2. **Open Developer Console** (F12 or right-click → Inspect → Console)
3. **Verify utilities are loaded** by typing: `showBrowserConsoleHelp()`
4. **Test access** by running: `await testBrowserConsoleAccess()`

## Available Utilities

### 🧪 Deletion Testing Utilities

The deletion testing system provides comprehensive testing for the Universal Deletion System.

#### Core Testing Functions

```javascript
// Run the complete test suite
await deletionTesting.runTests()

// Test different deletion strategies
await deletionTesting.testStrategies()

// Test backup and rollback functionality
await deletionTesting.testBackupRollback()

// Test performance with current data
await deletionTesting.testPerformance()

// Generate a detailed report from test results
const testResult = await deletionTesting.runTests()
const report = deletionTesting.generateReport(testResult)
console.log(report)
```

#### What Each Test Does

- **`runTests()`**: Comprehensive test suite that validates deletion logic, dependency detection, and strategy selection
- **`testStrategies()`**: Tests cascade, preserve, and warn_and_stop deletion strategies
- **`testBackupRollback()`**: Validates backup creation and restoration functionality
- **`testPerformance()`**: Measures performance with current dataset (tests up to 50 items)

### 🧹 AI Trade Cleanup Utilities

The cleanup system specifically targets USER_CLOSED trades for safe removal.

#### Status and Analysis

```javascript
// Get current cleanup status
await aiTradeCleanup.status()

// Example output:
// {
//   totalTrades: 150,
//   userClosedTrades: 25,
//   otherTrades: 125,
//   needsCleanup: true,
//   statusBreakdown: { open: 50, closed: 75, user_closed: 25 }
// }
```

#### Safe Testing and Execution

```javascript
// Test cleanup without making changes (DRY RUN)
await aiTradeCleanup.test()

// Execute actual cleanup with full safety measures
await aiTradeCleanup.execute()

// Fast cleanup with minimal safety checks (use with caution)
await aiTradeCleanup.aggressive()
```

#### Backup Management

```javascript
// List all available backups
aiTradeCleanup.listBackups()

// Get detailed information about a backup
aiTradeCleanup.backupInfo('ai_trades_backup_1640995200000')

// Restore from a specific backup
await aiTradeCleanup.restore('ai_trades_backup_1640995200000')

// Clean up old backups (keep only 5 most recent)
aiTradeCleanup.cleanupBackups(5)
```

### 🔧 Testing and Verification Utilities

These utilities help verify that everything is working correctly.

```javascript
// Test if all utilities are accessible
await testBrowserConsoleAccess()

// Run comprehensive test of all systems
await runComprehensiveTest()

// Show help information
showBrowserConsoleHelp()
```

## Common Usage Patterns

### 1. Initial Verification

```javascript
// Check if everything is working
await testBrowserConsoleAccess()

// Should return:
// {
//   deletionTesting: true,
//   aiTradeCleanup: true,
//   errors: [],
//   warnings: []
// }
```

### 2. Assess Current State

```javascript
// Check what needs cleanup
const status = await aiTradeCleanup.status()
console.log(`Found ${status.userClosedTrades} USER_CLOSED trades to clean up`)

// Test deletion system performance
const perfTest = await deletionTesting.testPerformance()
console.log(`Performance: ${perfTest.passed ? 'GOOD' : 'NEEDS ATTENTION'}`)
```

### 3. Safe Testing Workflow

```javascript
// 1. Test cleanup (no changes made)
const testResult = await aiTradeCleanup.test()
console.log(`Would delete ${testResult.tradesDeleted} trades`)

// 2. Test deletion system
const deletionTests = await deletionTesting.runTests()
console.log(`Deletion tests: ${deletionTests.passedTests}/${deletionTests.totalTests} passed`)

// 3. If tests pass, execute cleanup
if (deletionTests.passedTests === deletionTests.totalTests) {
  const cleanupResult = await aiTradeCleanup.execute()
  console.log(`Cleanup completed: ${cleanupResult.success}`)
}
```

### 4. Backup and Recovery

```javascript
// List available backups
const backups = aiTradeCleanup.listBackups()
console.log(`Available backups: ${backups.length}`)

// Get info about the most recent backup
if (backups.length > 0) {
  const latestBackup = backups[0]
  const info = aiTradeCleanup.backupInfo(latestBackup)
  console.log(`Latest backup: ${info.totalTrades} trades from ${new Date(info.timestamp)}`)
}

// Restore if needed
// await aiTradeCleanup.restore(latestBackup)
```

## Error Handling

All utilities include comprehensive error handling and logging:

```javascript
try {
  const result = await deletionTesting.runTests()
  if (result.failedTests > 0) {
    console.log('Some tests failed:')
    result.results.forEach(test => {
      if (!test.passed) {
        console.log(`❌ ${test.scenario}: ${test.errors.join(', ')}`)
      }
    })
  }
} catch (error) {
  console.error('Test execution failed:', error)
}
```

## Safety Features

### Deletion System Safety

- **Dry Run Mode**: All tests run in dry-run mode by default
- **Dependency Detection**: Automatically identifies related data
- **Strategy Selection**: Chooses appropriate deletion strategy based on data relationships
- **Backup Creation**: Creates backups before any destructive operations

### Cleanup System Safety

- **USER_CLOSED Only**: Only targets trades with `user_closed` status
- **Automatic Backups**: Creates timestamped backups before deletion
- **Confirmation Steps**: Provides detailed information before execution
- **Rollback Capability**: Can restore from any backup

## Troubleshooting

### Utilities Not Available

If you get "deletionTesting is not defined" or similar errors:

1. **Check initialization**: Look for initialization messages in console
2. **Verify imports**: Ensure the application loaded completely
3. **Test access**: Run `await testBrowserConsoleAccess()` to diagnose

### Common Issues

```javascript
// If utilities seem missing
console.log('Checking utilities...')
console.log('deletionTesting:', typeof window.deletionTesting)
console.log('aiTradeCleanup:', typeof window.aiTradeCleanup)

// If database connection issues
try {
  const status = await aiTradeCleanup.status()
  console.log('Database connection: OK')
} catch (error) {
  console.error('Database connection failed:', error)
}
```

## Advanced Usage

### Custom Test Scenarios

```javascript
// Access the full deletion system tester class
const tester = new (await import('./utils/deletionSystemTesting')).DeletionSystemTester()

// Run custom tests
const customResult = await tester.testPerformance()
console.log('Custom test result:', customResult)
```

### Direct Service Access

```javascript
// Access cleanup manager directly
const manager = window.AITradeCleanup

// Use advanced methods
const detailedStatus = await manager.getCleanupStatus()
console.log('Detailed status:', detailedStatus)
```

## Best Practices

1. **Always test first**: Use dry-run modes before actual operations
2. **Check status regularly**: Monitor system state with status commands
3. **Maintain backups**: Keep recent backups and clean old ones periodically
4. **Verify results**: Use testing utilities to validate operations
5. **Monitor performance**: Run performance tests to ensure system health

## Support

If you encounter issues:

1. Run `await testBrowserConsoleAccess()` to check system status
2. Use `showBrowserConsoleHelp()` for quick reference
3. Check browser console for error messages
4. Verify all utilities are properly initialized

The system is designed to be safe and provide comprehensive feedback. All operations include detailed logging and error reporting to help diagnose any issues.