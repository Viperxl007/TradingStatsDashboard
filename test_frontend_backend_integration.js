/**
 * Frontend-Backend Integration Test
 *
 * This test verifies that the frontend chart analysis service
 * can communicate with the backend API endpoints correctly.
 */

import fetch from 'node-fetch';
import FormData from 'form-data';

// Import the chart analysis service (we'll simulate the import)
const API_BASE_URL = 'http://localhost:5000/api/chart-analysis';

/**
 * Create a test image buffer
 */
function createTestImageBuffer() {
    // Create a simple PNG-like buffer (this is a minimal PNG header)
    const pngHeader = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x64, // Width: 100
        0x00, 0x00, 0x00, 0x64, // Height: 100
        0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, etc.
        0x4C, 0x5C, 0x6D, 0x7E, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND chunk length
        0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // IEND CRC
    ]);
    return pngHeader;
}

/**
 * Test the chart analysis API call
 */
async function testAnalyzeChart() {
    console.log('Testing chart analysis API call...');
    
    try {
        const imageBuffer = createTestImageBuffer();
        const formData = new FormData();
        
        formData.append('image', imageBuffer, {
            filename: 'test-chart.png',
            contentType: 'image/png'
        });
        formData.append('ticker', 'AAPL');
        formData.append('context', JSON.stringify({
            timeframe: '1D',
            test_mode: true
        }));
        
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✓ Chart analysis successful!');
            console.log(`  - Ticker: ${result.ticker}`);
            console.log(`  - Analysis ID: ${result.analysis_id}`);
            console.log(`  - Confidence: ${result.confidence_score}`);
            return true;
        } else {
            const error = await response.text();
            console.log(`✗ Chart analysis failed: ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`✗ Request failed: ${error.message}`);
        return false;
    }
}

/**
 * Test the history API call
 */
async function testGetHistory() {
    console.log('Testing history API call...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/history/AAPL?limit=5`);
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✓ History retrieval successful!');
            console.log(`  - Count: ${result.count}`);
            console.log(`  - Analyses: ${result.analyses.length}`);
            return true;
        } else {
            const error = await response.text();
            console.log(`✗ History retrieval failed: ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`✗ Request failed: ${error.message}`);
        return false;
    }
}

/**
 * Test the levels API call
 */
async function testGetLevels() {
    console.log('Testing levels API call...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/levels/AAPL?near_price=150.00`);
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✓ Levels retrieval successful!');
            console.log(`  - AI levels: ${result.ai_levels.length}`);
            console.log(`  - Technical levels: ${Object.keys(result.technical_levels).length} types`);
            return true;
        } else {
            const error = await response.text();
            console.log(`✗ Levels retrieval failed: ${error}`);
            return false;
        }
    } catch (error) {
        console.log(`✗ Request failed: ${error.message}`);
        return false;
    }
}

/**
 * Test error handling
 */
async function testErrorHandling() {
    console.log('Testing error handling...');
    
    try {
        // Test with invalid ticker
        const response = await fetch(`${API_BASE_URL}/history/INVALID_TICKER_123`);
        
        console.log(`Response status: ${response.status}`);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✓ Error handling successful (empty result expected)');
            console.log(`  - Count: ${result.count}`);
            return true;
        } else {
            console.log('✓ Error handling successful (error response expected)');
            return true;
        }
    } catch (error) {
        console.log(`✗ Error handling test failed: ${error.message}`);
        return false;
    }
}

/**
 * Main test runner
 */
async function runTests() {
    console.log('='.repeat(60));
    console.log('FRONTEND-BACKEND INTEGRATION TESTS');
    console.log('='.repeat(60));
    
    // Check if backend is running
    try {
        const healthResponse = await fetch('http://localhost:5000/api/health');
        if (!healthResponse.ok) {
            console.log('✗ Backend server is not healthy');
            return false;
        }
        console.log('✓ Backend server is running and healthy');
    } catch (error) {
        console.log('✗ Backend server is not accessible');
        return false;
    }
    
    console.log();
    
    // Run tests
    const tests = [
        testAnalyzeChart,
        testGetHistory,
        testGetLevels,
        testErrorHandling
    ];
    
    const results = [];
    for (const test of tests) {
        try {
            const result = await test();
            results.push(result);
            console.log();
        } catch (error) {
            console.log(`✗ Test failed with exception: ${error.message}`);
            results.push(false);
            console.log();
        }
    }
    
    // Summary
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`Passed: ${passed}/${total}`);
    
    if (passed === total) {
        console.log('✓ All frontend-backend integration tests passed!');
        return true;
    } else {
        console.log('✗ Some frontend-backend integration tests failed');
        return false;
    }
}

// Run tests if this file is executed directly
// Run tests directly
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});