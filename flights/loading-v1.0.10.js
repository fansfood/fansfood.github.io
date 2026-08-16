(() => {
  const VERSION = '1.0.10';
  const button = document.getElementById('searchButton');
  const buttonText = document.getElementById('searchButtonText');
  const originalRunSearch = window.runSearch || runSearch;
  let busy = false;

  function realFare(quote) {
    if (!quote) return false;
    return quote.availability === 'verified' || quote.live === true || quote.dataSource === 'live';
  }

  function validateBeforeSearch() {
    const selected = [...originOptions.querySelectorAll('input:checked')];
    if (!selected.length) { alert('请至少选择一个中国城市。'); return false; }
    if (!startDate.value || !endDate.value) { alert('请选择完整的去程时间范围。'); return false; }
    if (startDate.value > endDate.value) { alert('去程最晚日期不能早于最早日期。'); return false; }
    if (tripType === 'roundtrip') {
      if (!returnStartDate.value || !returnEndDate.value) { alert('请选择完整的返程时间范围。'); return false; }
      if (returnStartDate.value > returnEndDate.value) { alert('返程最晚日期不能早于最早日期。'); return false; }
    }
    return true;
  }

  function buildRequestPayload() {
    return {
      tripType,
      direction: currentDirection,
      outbound: { start: startDate.value, end: endDate.value },
      inbound: tripType === 'roundtrip' ? { start: returnStartDate.value, end: returnEndDate.value } : null,
      cityGroups: [...originOptions.querySelectorAll('input:checked')].map(i => i.value),
      currency: 'CNY',
      passengers: { adults: 1 }
    };
  }

  function showLoading() {
    results.classList.remove('hidden');
    results.classList.add('live-querying');
    resultCount.textContent = '查询中';
    $('resultTitle').textContent = '正在查询实时票价…';
    flightList.innerHTML = `<div class="live-query-card"><div class="live-query-spinner"></div><strong>正在查询实时票价<span class="live-query-dots"></span></strong><span>正在匹配国航 CA721 / CA813 与白航 B2752 / B2754 的可售价格</span></div>`;
    calendarList.innerHTML = '';
    if (buttonText) buttonText.textContent = '正在查询中…';
    button.disabled = true;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function requestLivePrices(payload) {
    const apiUrl = window.FLIGHT_LIVE_API_URL || document.querySelector('meta[name="flight-live-api"]')?.content || '';
    if (!apiUrl) return { ok: false, reason: 'api-not-configured' };
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store'
      });
      if (!response.ok) return { ok: false, reason: `http-${response.status}` };
      const data = await response.json();
      return { ok: true, data };
    } catch (error) {
      return { ok: false, reason: 'network-error' };
    }
  }

  function quoteMatchesLeg(quote, leg) {
    if (!quote || !leg) return false;
    if (quote.date && quote.date !== leg.date) return false;
    if (quote.flightNumber && quote.flightNumber !== leg.flight?.flightNumber) return false;
    if (quote.direction && quote.direction !== leg.direction) return false;
    if (quote.origin && quote.origin !== leg.from?.code) return false;
    if (quote.destination && quote.destination !== leg.to?.code) return false;
    return true;
  }

  function applyQuoteToLeg(leg, quote) {
    leg.priceQuote = {
      amount: Number(quote.amount),
      currency: quote.currency || 'CNY',
      taxIncluded: quote.taxIncluded !== false,
      availability: 'verified',
      live: true,
      dataSource: 'live',
      source: quote.source || '实时票价',
      bundle: quote.bundle || null,
      availableBundles: quote.availableBundles || null
    };
    leg.availability = 'verified';
    leg.fareBundle = leg.priceQuote.bundle;
    leg.availableBundles = leg.priceQuote.availableBundles;
    leg.taxIncluded = leg.priceQuote.taxIncluded;
  }

  function mergeLiveResponse(data) {
    const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
    if (!quotes.length) return;
    const items = Array.isArray(currentResults) ? currentResults : [];
    items.forEach(item => {
      const legs = tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
      legs.forEach(leg => {
        const quote = quotes.find(q => quoteMatchesLeg(q, leg));
        if (quote) applyQuoteToLeg(leg, quote);
      });
      if (tripType === 'roundtrip' && realFare(item.outbound?.priceQuote) && realFare(item.inbound?.priceQuote)) {
        item.priceQuote = sumQuotes(item.outbound.priceQuote, item.inbound.priceQuote);
        item.priceQuote.live = true;
        item.priceQuote.dataSource = 'live';
        item.priceQuote.availability = 'verified';
      }
    });
  }

  function resultItemHasRealFare(item) {
    if (tripType === 'roundtrip') return realFare(item.outbound?.priceQuote) && realFare(item.inbound?.priceQuote);
    return realFare(item.priceQuote);
  }

  function markUnavailableResults() {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item || resultItemHasRealFare(item)) return;
      const price = card.querySelector('.price-block');
      if (price) price.innerHTML = `<span class="price-unavailable">暂未获取到实时报价</span><span class="price-unavailable-note">请稍后重新查询</span>`;
    });
    document.querySelectorAll('#calendarList .calendar-price').forEach(cell => {
      if (cell.textContent.trim() === '—' || cell.querySelector('.price-rmb-main')?.textContent.trim() === '—') {
        cell.innerHTML = '<span class="calendar-unavailable">暂无报价</span>';
      }
    });
  }

  function finishState() {
    results.classList.remove('live-querying');
    button.disabled = false;
    if (buttonText) buttonText.textContent = tripType === 'roundtrip' ? '搜索时间段内的往返组合' : '搜索时间段内的航班';
  }

  async function handleSearch(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy || !validateBeforeSearch()) return;
    busy = true;
    showLoading();

    const payload = buildRequestPayload();
    const started = Date.now();
    const liveResult = await requestLivePrices(payload);
    const elapsed = Date.now() - started;
    if (elapsed < 550) await new Promise(resolve => setTimeout(resolve, 550 - elapsed));

    originalRunSearch();
    if (liveResult.ok) {
      mergeLiveResponse(liveResult.data);
      renderFlights();
    }
    markUnavailableResults();
    finishState();
    busy = false;
  }

  button?.addEventListener('click', handleSearch, true);
  document.title = `白俄留学生机票比价 · v${VERSION}`;
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
