/**
 * This script preloads the TradingView widget script to ensure it's available when needed.
 * It's included in the index.html file and runs as soon as the page loads.
 */
(function() {
  // Check if the script is already loaded
  if (document.getElementById('tradingview-widget-script')) {
    return;
  }

  // Create the script element
  const script = document.createElement('script');
  script.id = 'tradingview-widget-script';
  script.src = 'https://s3.tradingview.com/tv.js';
  script.async = true;
  
  // Add the script to the document head
  document.head.appendChild(script);
  
  console.log('TradingView widget script preloaded');
})();