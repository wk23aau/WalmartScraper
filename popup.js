document.addEventListener('DOMContentLoaded', function() {
  const btnScrapeData = document.getElementById('btnScrapeData');
  const btnStartScrape = document.getElementById('btnStartScrape');
  const btnDownloadData = document.getElementById('btnDownloadData'); // optional legacy button
  const scrapeOptions = document.getElementById('scrapeOptions');
  const statusDiv = document.getElementById('status');

  // Show the scrape options form
  btnScrapeData.addEventListener('click', () => {
    scrapeOptions.classList.remove('hidden');
    statusDiv.innerText = 'Enter search query or URL and select options.';
  });

  // Start the scraping process
  btnStartScrape.addEventListener('click', () => {
    const inputVal = document.getElementById('searchInput').value.trim();
    const excludeBrandsInput = document.getElementById('excludeBrandsInput').value.trim();
    const shippingNA = document.getElementById('shippingNA').checked;
    const pickupNA = document.getElementById('pickupNA').checked;
    const deliveryNA = document.getElementById('deliveryNA').checked;
    const fulfillToday = document.getElementById('fulfillToday').checked;

    // Convert comma-separated brand names into an array
    const excludeBrandsArray = excludeBrandsInput
      ? excludeBrandsInput.split(',').map(b => b.trim()).filter(Boolean)
      : [];

    // Determine if input is a URL (simple test)
    let targetURL = '';
    try {
      new URL(inputVal);
      targetURL = inputVal;
    } catch (e) {
      // Not a valid URL; build Walmart search URL
      targetURL = `https://www.walmart.com/search?q=${encodeURIComponent(inputVal)}`;
    }

    // Append fulfillment parameter if required
    if (fulfillToday) {
      targetURL += '&facet=fulfillment_speed%3AToday';
    }

    // Send data to background script to open new tab and start scraping
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

  // Optional: legacy "Download Saved Data" (single results) 
  btnDownloadData.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'downloadCSV' }, (response) => {
      statusDiv.innerText = response.status || 'Download triggered.';
    });
  });

  // Load saved versions
  document.getElementById('btnLoadVersions').addEventListener('click', () => {
    chrome.storage.local.get({ allResults: {} }, data => {
      const allResults = data.allResults;
      const timestamps = Object.keys(allResults).sort();
      const selectEl = document.getElementById('downloadVersionSelect');
      selectEl.innerHTML = '';
      timestamps.forEach(ts => {
        const opt = document.createElement('option');
        opt.value = ts;
        opt.textContent = ts;
        selectEl.appendChild(opt);
      });
      if (timestamps.length === 0) {
        statusDiv.innerText = 'No saved versions found.';
      } else {
        statusDiv.innerText = 'Loaded versions. Select one to download.';
      }
    });
  });

  // Download the selected version
  document.getElementById('btnDownloadSelected').addEventListener('click', () => {
    const selectEl = document.getElementById('downloadVersionSelect');
    const chosenTimestamp = selectEl.value;
    if (!chosenTimestamp) {
      statusDiv.innerText = 'No version selected.';
      return;
    }
    chrome.runtime.sendMessage({ action: 'downloadCSV', timestamp: chosenTimestamp }, (response) => {
      statusDiv.innerText = response.status || 'Download triggered.';
    });
  });
});
