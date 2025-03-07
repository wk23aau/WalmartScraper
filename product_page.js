(async function () {
  console.log("[Product Page] Starting product page scraping...");

  // Utility function to wait for a given number of milliseconds.
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Utility: Clean price string by removing non-digit characters.
  function cleanPrice(priceStr) {
    console.log("[Product Page] Cleaning price string:", priceStr);
    return priceStr.replace(/[^\d.]/g, '');
  }

  // Utility: Clean image URL by stripping off extra query parameters.
  function cleanImageUrl(url) {
    console.log("[Product Page] Cleaning image URL:", url);
    const match = url.match(/(https?:\/\/[^?"']+\.(?:jpg|jpeg|png|webp))/i);
    return match ? match[1] : url;
  }

  // Utility: Try a selector and return its innerText.
  function getText(selector, description) {
    let el = document.querySelector(selector);
    console.log(`[Product Page] Trying selector "${selector}" for ${description}:`, el);
    return el ? el.innerText.trim() : "";
  }

  // 0. Extract product_id from URL.
  let product_id = "";
  const urlMatch = window.location.href.match(/\/ip\/([^/?#]+)/);
  if (urlMatch) {
    product_id = urlMatch[1];
  }
  console.log("[Product Page] Extracted product_id from URL:", product_id);

  // 1. Extract Title – try first h1[data-fs-element="name"], fallback to span[data-automation-id="product-title"].
  let title = getText('h1[data-fs-element="name"]', "Title");
  if (!title) {
    title = getText('span[data-automation-id="product-title"]', "Title (alternate)");
  }
  console.log("[Product Page] Extracted title:", title);

  // 2. Extract Brand – using a[data-seo-id="brand-name"].
  let brand = getText('a[data-seo-id="brand-name"]', "Brand");
  console.log("[Product Page] Extracted brand:", brand);

  // 3. Extract Market Price – using ".buy-box-container span[itemprop='price']".
  let priceEl = document.querySelector(".buy-box-container span[itemprop='price']");
  console.log("[Product Page] Price element:", priceEl);
  let rawPrice = priceEl ? priceEl.innerText.trim() : "";
  let market_price = cleanPrice(rawPrice);
  console.log("[Product Page] Extracted market price:", market_price);

  // 4. Extract up to 5 Images – using ".tc img".
  let imageEls = document.querySelectorAll(".tc img");
  console.log("[Product Page] Found image elements:", imageEls);
  let images = Array.from(imageEls).map(img => cleanImageUrl(img.getAttribute("src") || ""));
  images = images.slice(0, 5);
  // If any image from 2 to 5 is empty, populate with image1.
  if (!images[1]) images[1] = images[0];
  if (!images[2]) images[2] = images[0];
  if (!images[3]) images[3] = images[0];
  if (!images[4]) images[4] = images[0];
  let image1 = images[0] || "";
  let image2 = images[1] || "";
  let image3 = images[2] || "";
  let image4 = images[3] || "";
  let image5 = images[4] || "";
  console.log("[Product Page] Extracted images:", { image1, image2, image3, image4, image5 });

  // 5. Extract Summary – using a selector inside product description content.
  let summary = getText('[data-testid="product-description-content"] .dangerous-html', "Summary");
  if (!summary) {
    summary = getText('.dangerous-html:not(.w_LDl2 .dangerous-html)', "Summary (alternate)");
  }
  if (!summary) {
    summary = title;
    console.log("[Product Page] Summary was empty; using title as summary.");
  }
  console.log("[Product Page] Extracted summary:", summary);

  // 6. Extract Key Features.
  // First, try to find the UL element that contains the key features.
  let keyfeatures = [];
  let keyFeatureUL = document.querySelector(
    'div[data-testid="product-description-content"] div.mb3:nth-of-type(2) div.dangerous-html.mb3 ul'
  );
  if (keyFeatureUL) {
    let liEls = keyFeatureUL.querySelectorAll("li");
    keyfeatures = Array.from(liEls)
      .map(li => li.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  } else {
    console.warn("[Product Page] No UL found for key features; falling back.");
    // Fallback: find any container that has a UL.
    let candidates = document.querySelectorAll('div[data-testid="product-description-content"] div.dangerous-html.mb3');
    let keyFeatureContainer = Array.from(candidates).find(div => div.querySelector("ul"));
    if (keyFeatureContainer) {
      let rawText = keyFeatureContainer.textContent;
      console.log("[Product Page] Raw key features text:", rawText);
      keyfeatures = rawText.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s);
    }
  }
  // For backward compatibility, we assign the first two items and join the rest.
  let keyFeature1 = keyfeatures[0] || "";
  let keyFeature2 = keyfeatures[1] || "";
  // Also, capture all remaining key features in one additional field.
  let keyFeature3 = keyfeatures.slice(2).join("; ");
  console.log("[Product Page] Extracted key features:", { keyFeature1, keyFeature2, keyFeature3 });

  // 8. Extract Shipping Status – using data-testid="shipping-tile"
  let shipping_status = "";
  let shippingTile = document.querySelector('[data-testid="shipping-tile"]');
  if (shippingTile) {
    shipping_status = shippingTile.textContent.trim();
  }
  console.log("[Product Page] Extracted shipping status:", shipping_status);

  // 9. Extract Pickup Status – using data-testid="pickup-tile"
  let pickup_status = "";
  let pickupTile = document.querySelector('[data-testid="pickup-tile"]');
  if (pickupTile) {
    pickup_status = pickupTile.textContent.trim();
  }
  console.log("[Product Page] Extracted pickup status:", pickup_status);

  // 10. Extract Delivery Status – using data-testid="delivery-tile"
  let delivery_status = "";
  let deliveryTile = document.querySelector('[data-testid="delivery-tile"]');
  if (deliveryTile) {
    delivery_status = deliveryTile.textContent.trim();
  }
  console.log("[Product Page] Extracted delivery status:", delivery_status);
  
  // 10. Extract Additional Details by clicking the "More Details" button (if present).
  let details = [];
  let specsMoreBtn = document.querySelector("button.mt3");
  let detailsData = {};
  if (specsMoreBtn) {
    console.log("[Product Page] More Details button found. Clicking to load extra details...");
    specsMoreBtn.click();
    await wait(2000); // Wait for modal/AJAX content to load.
    let detailEls = document.querySelectorAll(".w_s1fw .pb2 h3, .w_s1fw .pb2 span");
    details = Array.from(detailEls)
      .map(el => el.textContent.trim())
      .filter(text => text !== "");
    console.log("[Product Page] Extracted raw details array:", details);
    // Process details into key-value pairs: pair elements as header and value.
    for (let i = 0; i < details.length; i += 2) {
      let header = details[i];
      let value = details[i + 1] || "";
      if (header) {
        detailsData[header] = value;
      }
    }
    console.log("[Product Page] Processed details into key-value pairs:", detailsData);
  } else {
    console.log("[Product Page] More Details button not found; skipping extra details.");
  }

  // 11. Build final data object.
  let dataToSend = {
    product_id,
    title,
    brandName: brand,
    market_price,
    image1,
    image2,
    image3,
    image4,
    image5,
    summary,
    keyFeature1,
    keyFeature2,
    keyFeature3,
    shipping_status,
    pickup_status,
    delivery_status,
    // Append the extra details (dynamic columns) as last keys.
    ...detailsData
  };

  console.log("[Product Page] Final scraped data:", dataToSend);

  // Send scraped product details to the background script.
  chrome.runtime.sendMessage({ type: 'productDetails', data: dataToSend }, (response) => {
    console.log("[Product Page] Sent product details to background. Response:", response);
    // Close this tab after scraping is complete.
    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'closeTab' });
      console.log("[Product Page] Sent closeTab message.");
    }, 500);
  });
})();
