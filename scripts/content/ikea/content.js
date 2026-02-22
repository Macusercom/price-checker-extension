const REGIONS = {
  at: { label: '🇦🇹 AT', path: '/at/de/' },
  de: { label: '🇩🇪 DE', path: '/de/de/' },
  sk: { label: '🇸🇰 SK', path: '/sk/sk/' },
};

const LOCAL_REGION_KEY = Object.keys(REGIONS).find(k => window.location.href.includes(REGIONS[k].path)) ?? null;

function getPriceElement() {
  return document.querySelector('.pipcom-price-module__price') ?? null;
}

function getLocalPrice() {
  // Prefer the screen reader text which contains the full formatted price, e.g. "Preis € 59,99".
  const srText = document.querySelector('.pipcom-price__sr-text');
  if (srText) {
    const match = /\d+(?:[,.]\d+)?/.exec(srText.textContent);
    if (match) return match[0];
  }
  // Fallback: combine integer and decimal spans directly.
  const integer = document.querySelector('.pipcom-price__integer');
  const decimal = document.querySelector('.pipcom-price__decimal');
  if (integer) {
    const dec = decimal?.textContent.trim();
    return integer.textContent.trim() + (dec ? ',' + dec : '');
  }
  return null;
}

function extractPriceFromText(text) {
  // The screen reader span in the fetched HTML contains the full price, e.g. "Preis € 59,99".
  const srMatch = /pipcom-price__sr-text[^>]*>([^<]+)</.exec(text);
  if (srMatch) {
    const priceMatch = /\d+(?:[,.]\d+)?/.exec(srMatch[1]);
    if (priceMatch) return priceMatch[0];
  }
  return null;
}

async function fetchPrice(url) {
  try {
    const response = await new Promise(resolve =>
      chrome.runtime.sendMessage({ url }, resolve)
    );
    return response?.found ? extractPriceFromText(response.text) : null;
  } catch {
    return null;
  }
}

async function refreshPrice() {
  if (!LOCAL_REGION_KEY) return;

  const priceElement = getPriceElement();
  if (!priceElement) return;

  const localRegion = REGIONS[LOCAL_REGION_KEY];
  const otherRegions = Object.entries(REGIONS).filter(([k]) => k !== LOCAL_REGION_KEY);
  const href = window.location.href;

  const localPrice = getLocalPrice();
  const otherPrices = await Promise.all(
    otherRegions.map(([, r]) => fetchPrice(href.replace(localRegion.path, r.path)))
  );

  if (!localPrice) return;

  const prices = [
    { label: localRegion.label, value: localPrice, isLocal: true, url: href },
    ...otherRegions.map(([, r], i) => ({ label: r.label, value: otherPrices[i], url: href.replace(localRegion.path, r.path) })),
  ];

  const widget = renderWidget(prices);
  priceElement.parentNode.insertBefore(widget, priceElement.nextSibling);
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.message === 'refreshPrice') {
    setTimeout(refreshPrice, 1000);
  }
});

setTimeout(refreshPrice, 1000);
