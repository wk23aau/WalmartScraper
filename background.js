let productQueue = [];       // Products scraped from the search page.
let results = [];            // Collected product details for the current run.
let tabProductMapping = {};  // Mapping: tabId -> original product object.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message);

  if (message.action === 'startScrape') {
    // 1) Start a new scrape
    console.log('[Background] Action: startScrape with URL:', message.url);
    // Clear out old results array
    results = [];

    // Save user options to storage for content.js usage
    chrome.storage.local.set({ scrapeOptions: message.options }, () => {
      console.log('[Background] Scrape options saved:', message.options);
      // Open search tab
      chrome.tabs.create({ url: message.url, active: true }, (tab) => {
        console.log('[Background] Opened search tab. URL:', message.url, 'Tab ID:', tab.id);
      });
    });
    sendResponse({ status: 'Search page opened.' });

  } else if (message.type === 'scrapedProducts') {
    // 2) Received the list of products from the search page
    console.log('[Background] Received scraped products:', message.products);
    productQueue = message.products;
    console.log('[Background] Product queue set:', productQueue);
    processNextProduct();
    sendResponse({ status: 'Processing products...' });

  } else if (message.type === 'productDetails') {
    // 3) Received data from a product page
    console.log('[Background] Received product details:', message.data);
    const tabId = sender.tab && sender.tab.id;
    let originalProduct = {};

    if (tabId && tabProductMapping[tabId]) {
      originalProduct = tabProductMapping[tabId];
      delete tabProductMapping[tabId];
    }

    let finalData = { ...message.data };
    // Merge in the original wp_id if present
    if (originalProduct.wp_id) {
      finalData.wp_id = originalProduct.wp_id;
    }
    // Optionally remove product_id since the URL is built using wp_id
    if (finalData.wp_id) {
      delete finalData.product_id;
    }

    results.push(finalData);
    console.log('[Background] Results updated:', results);

    // Proceed to next product
    processNextProduct();
    sendResponse({ status: 'Product processed.' });

  } else if (message.action === 'downloadCSV') {
    // 4) Download CSV for either the legacy results or a chosen timestamp
    if (message.timestamp) {
      // User selected a specific version
      const chosenTimestamp = message.timestamp;
      chrome.storage.local.get({ allResults: {} }, data => {
        const allResults = data.allResults;
        const resultsToDownload = allResults[chosenTimestamp];
        if (!resultsToDownload) {
          sendResponse({ status: 'No data found for timestamp: ' + chosenTimestamp });
          return;
        }
        const csvContent = convertResultsToCSV(resultsToDownload);
        const filename = `walmart_data_${chosenTimestamp}.csv`;
        downloadCSV(csvContent, filename);
        sendResponse({ status: 'CSV download triggered for ' + chosenTimestamp });
      });
      return true; // keep the message channel open for async response
    } else {
      // Legacy single "results" approach
      console.log('[Background] Action: downloadCSV triggered.');
      const csvContent = convertResultsToCSV(results);
      downloadCSV(csvContent, 'walmart_data_legacy.csv');
      sendResponse({ status: 'CSV download triggered (legacy).' });
    }

  } else if (message.action === 'closeTab') {
    // Close the product tab
    if (sender.tab && sender.tab.id) {
      console.log('[Background] Closing tab id:', sender.tab.id);
      chrome.tabs.remove(sender.tab.id);
    }
  }
  return true;
});

function processNextProduct() {
  console.log('[Background] processNextProduct invoked.');
  if (productQueue.length === 0) {
    // All products processed
    console.log('[Background] All products processed. Final results:', results);

    // Save results under a unique timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); 
    chrome.storage.local.get({ allResults: {} }, (data) => {
      const allResults = data.allResults;
      allResults[timestamp] = results;
      chrome.storage.local.set({ allResults }, () => {
        console.log('[Background] Results saved under timestamp:', timestamp);
      });
    });

    // Also submit data to Google Sheets
    sendDataToGoogleSheets(results);
    return;
  }

  const product = productQueue.shift();
  console.log('[Background] Next product dequeued:', product);

  // Build product URL using product_id
  let productURL = `https://www.walmart.com/ip/${product.product_id}`;
  console.log('[Background] Navigating to product URL:', productURL);

  chrome.tabs.create({ url: productURL, active: false }, (tab) => {
    console.log('[Background] Opened product tab. Tab ID:', tab.id, 'URL:', productURL);
    tabProductMapping[tab.id] = product;
  });
}

function sendDataToGoogleSheets(data) {
  const scriptURL = "https://script.google.com/macros/s/AKfycbykp1glM0xLjWaqebSNsFBqWwGEZ9BbLVSMTioCObGK5lFo_tpSrNIQ8PhIJ9PnWlqr/exec";
  const proxyUrl = "https://bestdigisellers.com/proxy.php?url=" + encodeURIComponent(scriptURL);
  
  console.log('[Background] Submitting data to Google Sheets via PHP proxy...');
  
  fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Request failed. Status: ' + response.status);
    }
    return response.text();
  })
  .then(text => {
    console.log('[Background] Data submitted successfully. Server says:', text);
  })
  .catch(error => {
    console.error('[Background] Error submitting data:', error);
  });
}

function convertResultsToCSV(data) {
  console.log('[Background] Converting product results to CSV...');

  const fixedKeys = [
    'wp_id',
    'title',
    'brandName',
    'market_price',
    'image1',
    'image2',
    'image3',
    'image4',
    'image5',
    'summary',
    'keyFeature1',
    'keyFeature2',
    'keyFeature3',
    'shipping_status',
    'pickup_status',
    'delivery_status'
  ];

  // Gather dynamic keys
  let dynamicKeys = new Set();
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      if (!fixedKeys.includes(key)) {
        dynamicKeys.add(key);
      }
    });
  });
  dynamicKeys = Array.from(dynamicKeys);

  // Final header: fixed + dynamic
  const header = fixedKeys.concat(dynamicKeys);

  let rows = [];
  rows.push(header); // header row

  data.forEach(item => {
    let row = header.map(col => {
      let value = item[col];
      if (Array.isArray(value)) {
        return `"${value.join('; ').replace(/"/g, '""')}"`;
      } else if (typeof value === 'object' && value !== null) {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      } else {
        let str = value ? value.toString().replace(/"/g, '""') : '';
        return `"${str}"`;
      }
    });
    rows.push(row);
  });

  let csvContent = rows.map(r => r.join(',')).join('\n');
  return csvContent;
}

function downloadCSV(csvContent, filename) {
  const dataUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  if (chrome.downloads) {
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    }, (downloadId) => {
      console.log('[Background] CSV download started. Download ID:', downloadId);
    });
  } else {
    console.error('[Background] chrome.downloads API not available.');
  }
}
