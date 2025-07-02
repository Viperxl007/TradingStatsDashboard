/**
 * Browser Console SOLUSD Cleanup Script
 * 
 * Copy and paste this entire script into your browser console while on the
 * AI Trade Tracker page to immediately clean up the persistent SOLUSD trade.
 */

(async function solusdCleanup() {
  console.log('🚀 Starting SOLUSD cleanup from browser console...');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  const results = {
    indexedDB: { found: 0, deleted: 0, errors: [] },
    backend: { found: 0, deleted: 0, errors: [] },
    total: { found: 0, deleted: 0, success: false }
  };
  
  try {
    // Step 1: Clean IndexedDB
    console.log('\n📱 STEP 1: Cleaning IndexedDB...');
    
    try {
      // Open IndexedDB
      const dbRequest = indexedDB.open('AITradeTrackerDB', 1);
      
      const db = await new Promise((resolve, reject) => {
        dbRequest.onsuccess = () => resolve(dbRequest.result);
        dbRequest.onerror = () => reject(dbRequest.error);
      });
      
      // Get all SOLUSD trades
      const transaction = db.transaction(['ai_trades'], 'readwrite');
      const store = transaction.objectStore('ai_trades');
      const index = store.index('ticker');
      const getRequest = index.getAll('SOLUSD');
      
      const solusdTrades = await new Promise((resolve, reject) => {
        getRequest.onsuccess = () => resolve(getRequest.result || []);
        getRequest.onerror = () => reject(getRequest.error);
      });
      
      results.indexedDB.found = solusdTrades.length;
      console.log(`📱 Found ${solusdTrades.length} SOLUSD trades in IndexedDB`);
      
      // Delete each SOLUSD trade
      for (const trade of solusdTrades) {
        try {
          const deleteRequest = store.delete(trade.id);
          await new Promise((resolve, reject) => {
            deleteRequest.onsuccess = () => resolve(true);
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
          
          results.indexedDB.deleted++;
          console.log(`✅ Deleted IndexedDB trade: ${trade.id}`);
        } catch (error) {
          results.indexedDB.errors.push(`Failed to delete ${trade.id}: ${error.message}`);
          console.error(`❌ Failed to delete IndexedDB trade ${trade.id}:`, error);
        }
      }
      
      db.close();
      
    } catch (error) {
      results.indexedDB.errors.push(`IndexedDB error: ${error.message}`);
      console.error('❌ IndexedDB cleanup failed:', error);
    }
    
    // Step 2: Clean Backend
    console.log('\n🔄 STEP 2: Cleaning Backend...');
    
    try {
      // Check for active SOLUSD trades
      const activeResponse = await fetch('http://localhost:5000/api/active-trades/all');
      
      if (activeResponse.ok) {
        const activeData = await activeResponse.json();
        const solusdActiveTrades = (activeData.active_trades || []).filter(trade => trade.ticker === 'SOLUSD');
        
        results.backend.found += solusdActiveTrades.length;
        console.log(`🔄 Found ${solusdActiveTrades.length} active SOLUSD trades in backend`);
        
        // Delete/close each active SOLUSD trade
        for (const trade of solusdActiveTrades) {
          try {
            // Try direct delete first
            let deleteResponse = await fetch(`http://localhost:5000/api/active-trades/SOLUSD/delete`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Browser console cleanup', force: true })
            });
            
            // If delete endpoint doesn't exist, use close endpoint
            if (!deleteResponse.ok && deleteResponse.status === 404) {
              console.log('🔄 Delete endpoint not found, using close endpoint...');
              deleteResponse = await fetch(`http://localhost:5000/api/active-trades/SOLUSD/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  current_price: 153.50,
                  notes: 'Browser console cleanup - forced closure',
                  force_close: true
                })
              });
            }
            
            if (deleteResponse.ok) {
              results.backend.deleted++;
              console.log(`✅ Deleted/closed backend trade: SOLUSD`);
            } else {
              const errorData = await deleteResponse.json().catch(() => ({ error: deleteResponse.statusText }));
              throw new Error(errorData.error || `HTTP ${deleteResponse.status}`);
            }
            
          } catch (error) {
            results.backend.errors.push(`Failed to delete SOLUSD: ${error.message}`);
            console.error(`❌ Failed to delete backend SOLUSD trade:`, error);
          }
        }
      } else {
        results.backend.errors.push(`Failed to fetch active trades: HTTP ${activeResponse.status}`);
        console.error('❌ Failed to fetch active trades from backend');
      }
      
    } catch (error) {
      results.backend.errors.push(`Backend error: ${error.message}`);
      console.error('❌ Backend cleanup failed:', error);
    }
    
    // Step 3: Summary
    results.total.found = results.indexedDB.found + results.backend.found;
    results.total.deleted = results.indexedDB.deleted + results.backend.deleted;
    results.total.success = results.total.deleted > 0 && 
                           results.indexedDB.errors.length === 0 && 
                           results.backend.errors.length === 0;
    
    console.log('\n📊 CLEANUP SUMMARY:');
    console.log(`Total SOLUSD trades found: ${results.total.found}`);
    console.log(`Total SOLUSD trades deleted: ${results.total.deleted}`);
    console.log(`IndexedDB: ${results.indexedDB.deleted}/${results.indexedDB.found} deleted`);
    console.log(`Backend: ${results.backend.deleted}/${results.backend.found} deleted`);
    console.log(`Overall success: ${results.total.success}`);
    
    if (results.indexedDB.errors.length > 0) {
      console.log('\n❌ IndexedDB Errors:');
      results.indexedDB.errors.forEach(error => console.log(`  ${error}`));
    }
    
    if (results.backend.errors.length > 0) {
      console.log('\n❌ Backend Errors:');
      results.backend.errors.forEach(error => console.log(`  ${error}`));
    }
    
    if (results.total.success) {
      console.log('\n🎉 SOLUSD CLEANUP COMPLETED SUCCESSFULLY!');
      console.log('💡 Please refresh the page to see the changes in the AI Trade Tracker.');
      console.log('🔄 Refreshing page in 3 seconds...');
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } else if (results.total.deleted > 0) {
      console.log('\n⚠️ SOLUSD cleanup partially successful.');
      console.log('💡 Some trades were deleted but there were errors. Please refresh and check.');
      console.log('🔄 Refreshing page in 5 seconds...');
      
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } else {
      console.log('\n❌ SOLUSD cleanup failed or no trades found.');
      console.log('💡 Check the errors above or verify the trade exists.');
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Fatal error during SOLUSD cleanup:', error);
    return { error: error.message, success: false };
  }
})();