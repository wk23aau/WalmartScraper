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

    // Function to scrape the current page’s product grid
    function scrapePage() {
      // Select all product elements that are children of the parent with data-testid="item-stack"
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
          // Exclude if shipping info is present and does not indicate unavailability
          if (/Shipping/i.test(infoText) && !/not\s*available/i.test(infoText)) {
            console.log("[Content] Excluding item due to shipping available filter.");
            exclude = true;
          }
        }

        if (scrapeOptions && scrapeOptions.pickupNA) {
          // Exclude if pickup info is present and does not indicate unavailability
          if (/Pickup/i.test(infoText) && !/not\s*available/i.test(infoText)) {
            console.log("[Content] Excluding item due to pickup available filter.");
            exclude = true;
          }
        }

        if (scrapeOptions && scrapeOptions.deliveryNA) {
          // Exclude if delivery info is present and does not indicate unavailability
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

    // Function to prompt the user to confirm or adjust the selector (if needed)
    async function promptForSelector(products) {
      return new Promise((resolve) => {
        // Create overlay
        let overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
        overlay.style.zIndex = 10000;
        overlay.style.display = "flex";
        overlay.style.flexDirection = "column";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";

        // Create modal
        let modal = document.createElement("div");
        modal.style.background = "#fff";
        modal.style.padding = "20px";
        modal.style.borderRadius = "8px";
        modal.style.width = "80%";
        modal.style.maxHeight = "80%";
        modal.style.overflowY = "auto";

        // Build preview HTML
        modal.innerHTML = `
          <h2>Scraped ${products.length} products</h2>
          <p>Preview (first 3):</p>
          <ul>
            ${products.slice(0,3).map(p => `<li>wp_id: ${p.wp_id || "N/A"}, product_id: ${p.product_id || "N/A"}</li>`).join("")}
          </ul>
          <p>If this is not what you expected, enter a custom selector for product items below. Otherwise, click Continue.</p>
          <input id="customSelector" type="text" style="width:100%" placeholder='[data-testid="item-stack"] [data-item-id]' value='[data-testid="item-stack"] [data-item-id]' />
          <div style="margin-top:20px; text-align:right;">
            <button id="continueBtn">Continue</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById("continueBtn").onclick = function() {
          const customSel = document.getElementById("customSelector").value.trim();
          document.body.removeChild(overlay);
          resolve(customSel);
        };
      });
    }

    // Recursive function to paginate through search results
    async function paginateAndScrape(allProducts = [], selector) {
      const products = scrapePage();
      allProducts = allProducts.concat(products);

      const nextBtn = document.querySelector('[data-testid="NextPage"]');
      console.log("[Content] Next button element:", nextBtn);
      if (nextBtn) {
        console.log("[Content] Clicking Next Page button.");
        nextBtn.click();
        // Wait for AJAX load – adjust timing as needed.
        await new Promise(resolve => setTimeout(resolve, 2000));
        return paginateAndScrape(allProducts, selector);
      } else {
        console.log("[Content] No Next Page button found. Pagination complete.");
        return allProducts;
      }
    }

    async function startScraping() {
      // First run with the default selector
      let initialProducts = scrapePage();
      // Prompt user to confirm or adjust selector if needed
      let customSelector = await promptForSelector(initialProducts);
      // Now paginate and scrape using the user-provided selector
      let products = await paginateAndScrape([], customSelector);
      console.log("[Content] Total products scraped:", products);
      chrome.runtime.sendMessage({ type: "scrapedProducts", products });
    }

    startScraping();
  });
})();
