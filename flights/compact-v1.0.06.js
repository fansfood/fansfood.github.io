(() => {
  const VERSION = '1.0.06';
  const VERIFIED_FARES = {
    // User-verified Belavia booking result: 31 Aug 2026, B2752 URC -> MSQ.
    // The screenshot shows only Business available at 2 857.23 BYN.
    'to-minsk|URC|2026-08-31': {
      availability: 'verified',
      availableBundles: ['BUSINESS'],
      bundle: 'BUSINESS',
      amount: 2857.23,
      currency: 'BYN',
      taxIncluded: true,
      source: '白航官网结果已核验 · BUSINESS · 含税费'
    }
  };

  const previousDemoPrice = demoPrice;
  demoPrice = function(route, dateIso, direction) {
    const verified = VERIFIED_FARES[`${direction}|${route.code}|${dateIso}`];
    if (verified) return { ...verified };

    const quote = previousDemoPrice(route, dateIso, direction);
    if (route.airline === 'CA') {
      return {
        ...quote,
        availability: 'unverified',
        taxIncluded: false,
        taxStatus: 'pending',
        source: '国航票面演示价 · 未含税 · 票态待实时核验'
      };
    }
    return {
      ...quote,
      availability: 'unverified',
      taxIncluded: true,
      source: '白航 BYN 演示价 · 票态待实时核验 · 非实时'
    };
  };

  const previousCreateLeg = createLeg;
  createLeg = function(route, date, direction) {
    const leg = previousCreateLeg(route, date, direction);
    const q = leg.priceQuote || {};
    leg.availability = q.availability || 'unverified';
    leg.availableBundles = q.availableBundles || null;
    leg.fareBundle = q.bundle || null;
    leg.taxIncluded = q.taxIncluded === true;
    leg.taxStatus = q.taxStatus || null;
    return leg;
  };

  // RMB is the main comparison value. Airline source currency remains visible underneath.
  priceHtml = function(quote, compact = false) {
    const converted = quoteCny(quote);
    let rmbMain;
    if (quote.currency === 'CNY') {
      rmbMain = formatCurrency(Math.round(quote.amount), 'CNY');
    } else if (Number.isFinite(converted)) {
      rmbMain = formatCurrency(Math.round(converted), 'CNY');
    } else {
      rmbMain = '人民币换算中';
    }

    let sourceLine = '';
    if (quote.currency === 'CNY') {
      sourceLine = quote.taxIncluded === false
        ? '国航票面价 · 未含税费'
        : '人民币原始报价';
    } else {
      sourceLine = `${formatCurrency(quote.amount, quote.currency)} · ${quote.currency}`;
      if (quote.taxIncluded === true) sourceLine += ' · 含税费';
    }

    if (compact) {
      return `<span class="price-rmb-main">${rmbMain}</span><span class="price-native-secondary">${sourceLine}</span>`;
    }
    return `<span class="price-rmb-main">${rmbMain}</span><span class="price-native-secondary">${sourceLine}</span><small class="price-source">${quote.source || ''}</small>`;
  };

  function availabilityMeta(item) {
    if (tripType === 'roundtrip') {
      const legs = [item.outbound, item.inbound];
      const verified = legs.filter(x => x?.availability === 'verified');
      if (verified.length === legs.length) return { cls: 'verified', text: '往返票态已核验', tax: '价格状态已核' };
      if (verified.length) return { cls: 'verified', text: '含已核票价', tax: '另一段待核验' };
      return { cls: '', text: '票态待实时核验', tax: '非实时库存' };
    }
    if (item.availability === 'verified' && item.fareBundle === 'BUSINESS') {
      return { cls: 'business-only', text: '仅 BUSINESS 有票', tax: item.taxIncluded ? '含税总价' : '税费待核' };
    }
    if (item.route?.airline === 'CA') return { cls: '', text: '票态待实时核验', tax: '国航税费待核' };
    return { cls: '', text: '票态待实时核验', tax: item.taxIncluded ? '白航规则：含税展示' : '税费待核' };
  }

  function fareInfoHtml(leg) {
    if (leg.availability === 'verified' && leg.flight?.flightNumber === 'B2752' && leg.date === '2026-08-31') {
      return `<div class="fare-availability-box">
        <div class="fare-row"><strong>当前可售票价档</strong><span class="business-live">仅 BUSINESS</span></div>
        <div class="fare-row"><span>白航官网核验价格</span><strong>2 857.23 Б（BYN）</strong></div>
        <div class="fare-row"><span>税费状态</span><strong>官网结果页总价 · 已含税费</strong></div>
        <div class="fare-row"><span>票态来源</span><span>2026-08-31 B2752 用户提供白航官网结果</span></div>
      </div>`;
    }

    if (leg.route?.airline === 'B2') {
      return `<div class="fare-availability-box">
        <div class="fare-row"><strong>当前票态</strong><span>待接入白航实时库存</span></div>
        <div class="fare-row"><span>说明</span><span>班期已匹配，但当前 SMART / FLEX / BUSINESS 是否仍有票尚未实时核验。</span></div>
      </div>`;
    }
    return '';
  }

  function taxInfoHtml(leg) {
    if (leg.route?.airline !== 'CA') return '';
    const base = formatCurrency(leg.priceQuote?.amount || 0, 'CNY');
    return `<div class="tax-breakdown-box">
      <div class="tax-row"><strong>国航票面演示价</strong><span>${base}</span></div>
      <div class="tax-row"><span>政府税费 / 机场费用 / 燃油附加</span><span class="pending">待国航系统实时计算</span></div>
      <div class="tax-row"><span>含税总价</span><strong class="pending">尚未核验，暂不伪造</strong></div>
      <div class="tax-row"><span>显示原则</span><span>国航列表价本身不含税；接入实时结果后主价格将改为含税订单总价。</span></div>
    </div>`;
  }

  function enhanceLegCard(card, leg) {
    if (!card || !leg || card.dataset.v106Enhanced === '1') return;
    card.dataset.v106Enhanced = '1';
    const schedule = card.querySelector('.schedule-row');
    const extra = `${fareInfoHtml(leg)}${taxInfoHtml(leg)}`;
    if (extra) (schedule || card.querySelector('.baggage-box') || card).insertAdjacentHTML('afterend', extra);
  }

  function enhanceCards() {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;
      card.classList.remove('is-expanded');
      const head = card.querySelector('.itinerary-head');
      if (!head) return;
      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', 'false');
      head.title = '点击展开航班详情';

      let status = head.querySelector('.compact-status');
      if (!status) {
        status = document.createElement('div');
        status.className = 'compact-status';
        head.appendChild(status);
      }
      const meta = availabilityMeta(item);
      status.innerHTML = `<span class="availability-pill ${meta.cls}">${meta.text}</span><span class="tax-pill">${meta.tax}</span><span class="expand-chevron" aria-hidden="true">⌄</span>`;

      const legs = tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
      [...card.querySelectorAll(':scope > .leg-card')].forEach((legCard, i) => enhanceLegCard(legCard, legs[i]));
    });

    const panel = document.querySelector('.flights-panel');
    if (panel && !panel.querySelector('.compact-help')) {
      const help = document.createElement('div');
      help.className = 'compact-help';
      help.textContent = '默认只显示路线、日期/航班号、人民币参考价和票态。点击任意一行，可在原位置展开起降时间、机型、航空公司、票价档、税费和行李详情。';
      panel.querySelector('.panel-title')?.insertAdjacentElement('afterend', help);
    }
  }

  const previousRenderFlights = renderFlights;
  renderFlights = function() {
    previousRenderFlights();
    enhanceCards();
  };

  const listRoot = document.getElementById('flightList');
  listRoot?.addEventListener('click', (event) => {
    const head = event.target.closest('.itinerary-head');
    if (!head || !listRoot.contains(head)) return;
    const card = head.closest('.itinerary-card');
    const open = !card.classList.contains('is-expanded');
    card.classList.toggle('is-expanded', open);
    head.setAttribute('aria-expanded', String(open));
    head.title = open ? '点击收起航班详情' : '点击展开航班详情';
  });
  listRoot?.addEventListener('keydown', (event) => {
    const head = event.target.closest('.itinerary-head');
    if (!head || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    head.click();
  });

  function normalizeVersion(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      if (!node.nodeValue) return;
      node.nodeValue = node.nodeValue
        .replaceAll('v1.0.3', `v${VERSION}`)
        .replaceAll('v1.0.4', `v${VERSION}`)
        .replaceAll('v1.0.5', `v${VERSION}`)
        .replaceAll('v1.0.05', `v${VERSION}`)
        .replaceAll('1.0.05', VERSION);
    });
  }

  normalizeVersion(document);
  const versionObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) normalizeVersion(node);
    }));
  });
  versionObserver.observe(document.body, { childList: true, subtree: true });
})();
