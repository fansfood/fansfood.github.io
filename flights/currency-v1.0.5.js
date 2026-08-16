(() => {
  // v1.0.5: Belavia prices must preserve the source currency. For the current
  // Belarus-region booking flow, the source display is BYN (shown by Belavia as “Б”).
  AIRLINES.B2.demoCurrency = 'BYN';

  const originalFormatCurrency = formatCurrency;
  formatCurrency = function(amount, currency) {
    if (currency === 'BYN') {
      const value = Number(amount).toLocaleString('ru-BY', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).replace(/\u00a0/g, ' ');
      return `${value} Б`;
    }
    return originalFormatCurrency(amount, currency);
  };

  demoPrice = function(route, dateIso, direction) {
    const seed = hashNumber(`${route.code}-${dateIso}-${direction}`);
    if (route.airline === 'B2') {
      // Demo only. Keep a BYN-shaped quote so the UI exercises the correct
      // currency pipeline. It is intentionally not presented as a live fare.
      const base = { URC: 1450, SYX: 1750 }[route.code] || 1550;
      const amount = Math.max(850, Math.round((base + (seed % 420) - 150) * 100) / 100);
      return { amount, currency: 'BYN', source: '白航 BYN 演示价 · 非实时' };
    }
    const base = { PEK: 4300, XIY: 4000 }[route.code] || 4200;
    const amount = Math.round((base + (seed % 1000) - 360) / 10) * 10;
    return { amount, currency: 'CNY', source: '国航人民币演示价 · 非实时' };
  };

  const oldPriceHtml = priceHtml;
  priceHtml = function(quote, compact = false) {
    const html = oldPriceHtml(quote, compact);
    if (quote.currency !== 'BYN') return html;
    return html.replace('原始币种 ·', '白航原始币种 BYN ·');
  };

  function updateVisibleVersion(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach((n) => {
      if (n.nodeValue?.includes('v1.0.4')) n.nodeValue = n.nodeValue.replaceAll('v1.0.4', 'v1.0.5');
      if (n.nodeValue?.includes('1.0.4')) n.nodeValue = n.nodeValue.replaceAll('1.0.4', '1.0.5');
    });
  }

  function addSourceCurrencyHint(root = document) {
    root.querySelectorAll?.('.price-block, .winner-price, .calendar-price').forEach((box) => {
      const native = box.querySelector('.price-native');
      if (!native || !native.textContent.includes('Б')) return;
      if (box.querySelector('.byn-code')) return;
      const code = document.createElement('small');
      code.className = 'byn-code';
      code.textContent = 'BYN · 白俄罗斯卢布';
      native.insertAdjacentElement('afterend', code);
    });
  }

  function enhance(root = document) {
    updateVisibleVersion(root);
    addSourceCurrencyHint(root);
  }

  enhance(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();