/**
 * Browser Console Verification Script
 * 
 * This script verifies that the browser console utilities are properly accessible
 * and can be used to test the deletion system and cleanup tools.
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function verifyBrowserConsoleAccess() {
  console.log('🧪 Starting browser console verification...');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: false, // Set to true for headless testing
      devtools: true
    });
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'log') {
        console.log(`[Browser] ${text}`);
      } else if (type === 'error') {
        console.error(`[Browser Error] ${text}`);
      } else if (type === 'warn') {
        console.warn(`[Browser Warning] ${text}`);
      }
    });
    
    // Navigate to the application
    console.log('📱 Navigating to application...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Wait for the application to load
    console.log('⏳ Waiting for application to initialize...');
    await page.waitForTimeout(5000);
    
    // Test if utilities are available
    console.log('🔍 Testing utility availability...');
    
    const testResults = await page.evaluate(async () => {
      const results = {
        deletionTesting: false,
        aiTradeCleanup: false,
        testingUtils: false,
        errors: [],
        logs: []
      };
      
      try {
        // Check deletionTesting
        if (typeof window.deletionTesting === 'object' && window.deletionTesting !== null) {
          const methods = ['runTests', 'testStrategies', 'testBackupRollback', 'testPerformance'];
          const hasAllMethods = methods.every(method => typeof window.deletionTesting[method] === 'function');
          results.deletionTesting = hasAllMethods;
          results.logs.push(`deletionTesting: ${hasAllMethods ? 'Available' : 'Missing methods'}`);
        } else {
          results.errors.push('deletionTesting not found on window object');
        }
        
        // Check aiTradeCleanup
        if (typeof window.aiTradeCleanup === 'object' && window.aiTradeCleanup !== null) {
          const methods = ['status', 'test', 'execute', 'listBackups'];
          const hasAllMethods = methods.every(method => typeof window.aiTradeCleanup[method] === 'function');
          results.aiTradeCleanup = hasAllMethods;
          results.logs.push(`aiTradeCleanup: ${hasAllMethods ? 'Available' : 'Missing methods'}`);
        } else {
          results.errors.push('aiTradeCleanup not found on window object');
        }
        
        // Check testing utilities
        if (typeof window.testBrowserConsoleAccess === 'function') {
          results.testingUtils = true;
          results.logs.push('testBrowserConsoleAccess: Available');
        } else {
          results.errors.push('testBrowserConsoleAccess not found on window object');
        }
        
        // Try to run a simple test
        if (results.testingUtils) {
          try {
            const accessTest = await window.testBrowserConsoleAccess();
            results.logs.push(`Access test result: ${JSON.stringify(accessTest)}`);
          } catch (error) {
            results.errors.push(`Access test failed: ${error.message}`);
          }
        }
        
      } catch (error) {
        results.errors.push(`Evaluation error: ${error.message}`);
      }
      
      return results;
    });
    
    // Report results
    console.log('\n📊 Verification Results:');
    console.log(`✅ deletionTesting utilities: ${testResults.deletionTesting ? 'AVAILABLE' : 'MISSING'}`);
    console.log(`✅ aiTradeCleanup utilities: ${testResults.aiTradeCleanup ? 'AVAILABLE' : 'MISSING'}`);
    console.log(`✅ Testing utilities: ${testResults.testingUtils ? 'AVAILABLE' : 'MISSING'}`);
    
    if (testResults.logs.length > 0) {
      console.log('\n📝 Logs:');
      testResults.logs.forEach(log => console.log(`   ${log}`));
    }
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      testResults.errors.forEach(error => console.error(`   ${error}`));
    }
    
    const allWorking = testResults.deletionTesting && testResults.aiTradeCleanup && testResults.testingUtils;
    console.log(`\n${allWorking ? '🎉' : '❌'} Overall Status: ${allWorking ? 'ALL UTILITIES WORKING' : 'SOME UTILITIES MISSING'}`);
    
    if (allWorking) {
      console.log('\n🚀 Browser console utilities are ready for use!');
      console.log('   Open browser console and type: showBrowserConsoleHelp()');
    }
    
    return allWorking;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifyBrowserConsoleAccess()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyBrowserConsoleAccess };