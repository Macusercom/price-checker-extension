const LOCAL_COUNTRY = window.location.hostname.endsWith('.at') ? 'at' : 'de';
const OTHER_COUNTRY = LOCAL_COUNTRY === 'at' ? 'de' : 'at';
const FLAGS = { at: '🇦🇹', de: '🇩🇪' };

function getPriceElement() {
  // The DM price DOM is deeply nested; XPath is the most reliable selector available.
  const xpath = "//div[1]/div/main/div[2]/div[1]/div[2]/div[1]/div[*]/div[1]/div[1]/div/div[2]/div/div[1]/span/span";
  const snapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
  return snapshot.snapshotLength > 0 ? snapshot.snapshotItem(0) : null;
}

function getGtin() {
  const match = document.location.href.match(/-p(\d+)\.html/);
  return match ? match[1] : null;
}

async function fetchPrice(gtin, country) {
  try {
    const response = await new Promise(resolve =>
      chrome.runtime.sendMessage({ gtin, country }, resolve)
    );
    return response?.found ? response.price : null;
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
  const priceElement = getPriceElement();
  if (!priceElement) return;

  const gtin = getGtin();
  if (!gtin) return;

  const localPrice = priceElement.innerText.trim();
  const otherPrice = await fetchPrice(gtin, OTHER_COUNTRY);

  const prices = [
    { label: `${FLAGS[LOCAL_COUNTRY]} ${LOCAL_COUNTRY.toUpperCase()}`, value: localPrice, isLocal: true, url: window.location.href },
    { label: `${FLAGS[OTHER_COUNTRY]} ${OTHER_COUNTRY.toUpperCase()}`, value: otherPrice, url: window.location.href.replace(`dm.${LOCAL_COUNTRY}`, `dm.${OTHER_COUNTRY}`) },
  ];

  const widget = renderWidget(prices);
  priceElement.parentNode.insertBefore(widget, priceElement.nextSibling);
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.message === 'refreshPrice') {
    setTimeout(refreshPrice, 1000);
  }
});
