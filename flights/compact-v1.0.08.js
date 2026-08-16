(() => {
  const VERSION = '1.0.08';

  // v1.0.08 fixes the v1.0.07 freeze by removing the page-wide MutationObserver.
  // We only simplify the result rows immediately after renderFlights completes.

  function airChinaTaxEstimate(quote) {
    const base = Number(quote?.amount || 0);
    return Math.round((base * 0.20) / 10) * 10;
  }

  const previousPriceHtml = priceHtml;
  priceHtml = function(quote, compact = false) {
    if (quote?.currency === 'CNY' && quote?.taxIncluded === false) {
      const base = Math.round(Number(quote.amount || 0));
      const tax = airChinaTaxEstimate(quote);
      const main = formatCurrency(base, 'CNY');
      return `<span class="price-rmb-main">${main}</span><span class="tax-summary"><b class="tax-red">未含税</b><span>税费约 ${formatCurrency(tax,'CNY')}</span></span>`;
    }

    const html = previousPriceHtml(quote, compact);
    if (quote?.bundle === 'BUSINESS' || (quote?.availableBundles?.length === 1 && quote.availableBundles[0] === 'BUSINESS')) {
      return `${html}<span class="bundle-secondary">仅 BUSINESS</span>`;
    }
    return html;
  };

  function itemLegs(item) {
    return tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
  }

  function routeLabel(item) {
    if (tripType === 'roundtrip') return `${item.outbound.route.city} ⇄ 明斯克`;
    return `${item.from.city} → ${item.to.city}`;
  }

  function rewriteTaxDetail(legCard, leg) {
    if (!legCard || !leg || leg.route?.airline !== 'CA') return;
    const box = legCard.querySelector('.tax-breakdown-box');
    if (!box || box.dataset.v108 === '1') return;

    const base = Math.round(Number(leg.priceQuote?.amount || 0));
    const tax = airChinaTaxEstimate(leg.priceQuote);
    const total = base + tax;
    box.dataset.v108 = '1';
    box.innerHTML = `
      <div class="tax-row"><strong>国航票面价</strong><span>${formatCurrency(base,'CNY')}</span></div>
      <div class="tax-row"><span>税费参考估算</span><span class="estimated-tax">约 ${formatCurrency(tax,'CNY')}</span></div>
      <div class="tax-row"><span>预计含税参考</span><strong class="estimated-total">约 ${formatCurrency(total,'CNY')}</strong></div>
      <div class="tax-row"><span>说明</span><span>当前按票面价约 20% 仅作横向比价参考；国际税费、机场费用与燃油附加最终以国航订单系统计算为准。</span></div>`;
  }

  function simplifyRows() {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];

    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;

      const head = card.querySelector('.itinerary-head');
      if (!head) return;

      const left = head.firstElementChild;
      const routeStrong = left?.querySelector('strong');
      const label = routeLabel(item);
      if (routeStrong && routeStrong.textContent !== label) routeStrong.textContent = label;

      // Remove v1.0.06 status pills and keep only the expand arrow.
      const status = head.querySelector('.compact-status');
      if (status && status.dataset.v108 !== '1') {
        status.dataset.v108 = '1';
        status.innerHTML = '<span class="expand-chevron" aria-hidden="true">⌄</span>';
      }

      const legs = itemLegs(item);
      [...card.querySelectorAll(':scope > .leg-card')].forEach((legCard, i) => rewriteTaxDetail(legCard, legs[i]));
    });

    document.querySelectorAll('.compact-help').forEach(el => el.remove());
  }

  const previousRenderFlights = renderFlights;
  renderFlights = function() {
    previousRenderFlights();
    simplifyRows();
  };

  // No MutationObserver here. That observer was the cause of v1.0.07 freezing.
  document.title = `白俄留学生机票比价 · v${VERSION}`;
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
