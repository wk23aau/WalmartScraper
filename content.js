(function scrapeWalmartSearch() {
  // Retrieve user options from chrome.storage
  chrome.storage.local.get("scrapeOptions", ({ scrapeOptions }) => {

    // Utility to get combined info text from an element’s children with the new selector
    function getInfoText(item) {
      const infoEls = item.querySelectorAll('.f7.flex.self-baseline.dark-gray');
      let combinedText = "";
      infoEls.forEach(el => {
        combinedText += el.textContent;
      });
      return combinedText.replace(/\s+/g, ' ').trim();
    }

    // Function to scrape the current page’s product grid using default selector.
    function scrapePage() {
      // Use the default selector: [data-testid="item-stack"] [data-item-id]
      const items = document.querySelectorAll('[data-testid="item-stack"] [data-item-id]');
      console.log(`[Content] Found ${items.length} product items:`, items);
      const products = [];

      items.forEach(item => {
        let exclude = false;

        // Get the wp_id from the child element (this is now the key identifier)
        const wp_id = item.getAttribute("data-item-id");
        // Try to get product_id from a child with link-identifier attribute if available
        const product_id = item.querySelector('[link-identifier]')?.getAttribute("link-identifier");

        // Filter based on shipping, pickup, and delivery info using the new selector
        const infoText = getInfoText(item);
        console.log("[Content] Combined info text:", infoText);

        if (scrapeOptions && scrapeOptions.shippingNA) {
          if (/Shipping/i.test(infoText) && !/not\s*available/i.test(infoText)) {
            console.log("[Content] Excluding item due to shipping available filter.");
            exclude = true;
          }
        }

        if (scrapeOptions && scrapeOptions.pickupNA) {
          if (/Pickup/i.test(infoText) && !/not\s*available/i.test(infoText)) {
            console.log("[Content] Excluding item due to pickup available filter.");
            exclude = true;
          }
        }

        if (scrapeOptions && scrapeOptions.deliveryNA) {
          if (/Delivery/i.test(infoText) && !/not\s*available/i.test(infoText)) {
            console.log("[Content] Excluding item due to delivery available filter.");
            exclude = true;
          }
        }

        // Brand exclusion logic: exclude item if its brand is in the exclusion list
        if (scrapeOptions && scrapeOptions.excludeBrands && scrapeOptions.excludeBrands.length > 0) {
          const titleEl = item.querySelector('[data-automation-id="product-title"]');
          const brandName = titleEl ? titleEl.innerText.trim() : "";
          if (scrapeOptions.excludeBrands.includes(brandName)) {
            console.log(`[Content] Excluding item due to brand filter (${brandName}).`);
            exclude = true;
          }
        }

        if (!exclude && wp_id) {
          // Save both IDs for reference, though wp_id is now the primary identifier
          products.push({ wp_id, product_id });
        }
      });
      return products;
    }

    // Recursive function to paginate through search results using the default selector.
    async function paginateAndScrape(allProducts = []) {
      const products = scrapePage();
      allProducts = allProducts.concat(products);

      const nextBtn = document.querySelector('[data-testid="NextPage"]');
      console.log("[Content] Next button element:", nextBtn);
      if (nextBtn) {
        console.log("[Content] Clicking Next Page button.");
        nextBtn.click();
        // Wait for AJAX load – adjust timing as needed.
        await new Promise(resolve => setTimeout(resolve, 2000));
        return paginateAndScrape(allProducts);
      } else {
        console.log("[Content] No Next Page button found. Pagination complete.");
        return allProducts;
      }
    }

    async function startScraping() {
      // Directly scrape using the default selector without prompting the user
      let products = await paginateAndScrape();
      console.log("[Content] Total products scraped:", products);
      chrome.runtime.sendMessage({ type: "scrapedProducts", products });
    }

    startScraping();
  });
})();
