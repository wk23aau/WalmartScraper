document.addEventListener('DOMContentLoaded', function() {
  const btnScrapeData = document.getElementById('btnScrapeData');
  const btnStartScrape = document.getElementById('btnStartScrape');
  const btnDownloadData = document.getElementById('btnDownloadData');
  const btnLoadOptions = document.getElementById('btnLoadOptions');
  const btnLoadPrevious = document.getElementById('btnLoadPrevious');
  const scrapeOptionsDiv = document.getElementById('scrapeOptions');
  const statusDiv = document.getElementById('status');

  // When "Start New Scrape" is clicked, show the scraping options form.
  btnScrapeData.addEventListener('click', () => {
    scrapeOptionsDiv.classList.remove('hidden');
    statusDiv.innerText = 'Enter search query and options.';
  });

  // When "Start Scraping" is clicked, gather the options and send them.
  btnStartScrape.addEventListener('click', () => {
    const searchInput = document.getElementById('searchInput').value.trim();
    const excludeBrands = document.getElementById('excludeBrands').value.trim();
    const shippingNA = document.getElementById('shippingNA').checked;
    const pickupNA = document.getElementById('pickupNA').checked;
    const deliveryNA = document.getElementById('deliveryNA').checked;
    const fulfillToday = document.getElementById('fulfillToday').checked;

    // Convert comma-separated brands to an array.
    const excludeBrandsArray = excludeBrands ? excludeBrands.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Determine if the search input is a URL; if not, build a Walmart search URL.
    let targetURL = '';
    try {
      new URL(searchInput);
      targetURL = searchInput;
    } catch (e) {
      targetURL = `https://www.walmart.com/search?q=${encodeURIComponent(searchInput)}`;
    }

    // Append fulfillment parameter if needed.
    if (fulfillToday) {
      targetURL += '&facet=fulfillment_speed%3AToday';
    }

    // Save the current scraping options for later retrieval.
    chrome.storage.local.set({
      scrapeOptions: {
        searchQuery: searchInput,
        excludeBrands: excludeBrandsArray,
        shippingNA,
        pickupNA,
        deliveryNA,
        fulfillToday
      }
    });

    // Send the scraping start message to the background script.
    chrome.runtime.sendMessage({
      action: 'startScrape',
      url: targetURL,
      options: {
        excludeBrands: excludeBrandsArray,
        shippingNA,
        pickupNA,
        deliveryNA,
        fulfillToday
      }
    }, (response) => {
      statusDiv.innerText = response.status || 'Scraping initiated...';
    });
  });

  // When "Download Latest Data (CSV)" is clicked, trigger the CSV download.
  btnDownloadData.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadCSV' }, (response) => {
      statusDiv.innerText = response.status || 'Download triggered.';
    });
  });

  // When "Load Scraping Options" is clicked, load saved options from storage.
  btnLoadOptions.addEventListener('click', () => {
    chrome.storage.local.get("scrapeOptions", (data) => {
      if (data.scrapeOptions) {
        document.getElementById('searchInput').value = data.scrapeOptions.searchQuery || '';
        document.getElementById('excludeBrands').value = data.scrapeOptions.excludeBrands ? data.scrapeOptions.excludeBrands.join(', ') : '';
        document.getElementById('shippingNA').checked = data.scrapeOptions.shippingNA || false;
        document.getElementById('pickupNA').checked = data.scrapeOptions.pickupNA || false;
        document.getElementById('deliveryNA').checked = data.scrapeOptions.deliveryNA || false;
        document.getElementById('fulfillToday').checked = data.scrapeOptions.fulfillToday || false;
        statusDiv.innerText = 'Scraping options loaded.';
      } else {
        statusDiv.innerText = 'No saved scraping options found.';
      }
    });
  });

  // When "Load Previous Data" is clicked, load info about previously saved results.
  btnLoadPrevious.addEventListener('click', () => {
    chrome.storage.local.get({ allResults: {} }, (data) => {
      const allResults = data.allResults;
      const timestamps = Object.keys(allResults).sort();
      if (timestamps.length === 0) {
        statusDiv.innerText = 'No previous data found.';
      } else {
        statusDiv.innerText = `Found ${timestamps.length} saved versions. Latest timestamp: ${timestamps[timestamps.length - 1]}`;
      }
    });
  });
});
