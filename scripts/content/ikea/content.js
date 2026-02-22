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
    const match = /\d+[,.]\d+/.exec(srText.textContent);
    if (match) return match[0];
  }
  // Fallback: combine integer and decimal spans directly.
  const integer = document.querySelector('.pipcom-price__integer');
  const decimal = document.querySelector('.pipcom-price__decimal');
  if (integer) return integer.textContent.trim() + (decimal?.textContent.trim() ?? '');
  return null;
}

function extractPriceFromText(text) {
  // The screen reader span in the fetched HTML contains the full price, e.g. "Preis € 59,99".
  const srMatch = /pipcom-price__sr-text[^>]*>([^<]+)</.exec(text);
  if (srMatch) {
    const priceMatch = /\d+[,.]\d+/.exec(srMatch[1]);
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

function parsePrice(str) {
  return str ? parseFloat(String(str).replace(',', '.')) : null;
}

function formatPrice(value) {
  return String(value).replace('.', ',');
}

function renderWidget(prices) {
  document.getElementById('price-checker-widget')?.remove();

  const numericValues = prices.map(p => parsePrice(p.value)).filter(v => v !== null);
  const minPrice = numericValues.length > 0 ? Math.min(...numericValues) : null;

  const widget = document.createElement('div');
  widget.id = 'price-checker-widget';
  widget.style.cssText = [
    'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;',
    'font-size:13px;',
  ].join('');

  for (const { label, value, isLocal, url } of prices) {
    const numVal = parsePrice(value);
    const isCheapest = minPrice !== null && numVal === minPrice && numericValues.length > 1;

    const chip = document.createElement('a');
    chip.href = url;
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.style.cssText = [
      'display:inline-flex;align-items:center;padding:3px 8px;border-radius:12px;',
      'cursor:pointer;text-decoration:none;',
      `border:1px solid ${isCheapest ? '#22c55e' : '#d1d5db'};`,
      `background:${isCheapest ? '#f0fdf4' : isLocal ? '#eff6ff' : '#f9fafb'};`,
      `color:${isCheapest ? '#15803d' : '#374151'};`,
      `font-weight:${isLocal ? '600' : '400'};`,
    ].join('');
    chip.textContent = `${label} ${value ? `€\u202F${formatPrice(value)}` : '—'}`;
    widget.appendChild(chip);
  }

  return widget;
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
