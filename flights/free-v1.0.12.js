(() => {
  const VERSION = '1.0.12';
  const API_URL = 'https://wcjcbbnvaejwynnrhfld.supabase.co/functions/v1/flight-live-search';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamNiYm52YWVqd3lubnJoZmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzc3NzksImV4cCI6MjEwMjQ1Mzc3OX0.8S4u8zAzFOmQ-Uk8daRVWt6fBlSgcuGYIPEyjh9PH-s';

  const button = document.getElementById('searchButton');
  const buttonText = document.getElementById('searchButtonText');
  const originalRunSearch = window.runSearch || runSearch;
  let busy = false;

  function selectedGroups() {
    return [...originOptions.querySelectorAll('input:checked')].map(i => i.value);
  }

  function validateBeforeSearch() {
    if (!selectedGroups().length) { alert('请至少选择一个中国城市。'); return false; }
    if (!startDate.value || !endDate.value) { alert('请选择完整的去程时间范围。'); return false; }
    if (startDate.value > endDate.value) { alert('去程最晚日期不能早于最早日期。'); return false; }
    if (daysBetween(startDate.value, endDate.value).length > 62) { alert('去程单次最多比较 62 天。'); return false; }
    if (tripType === 'roundtrip') {
      if (!returnStartDate.value || !returnEndDate.value) { alert('请选择完整的返程时间范围。'); return false; }
      if (returnStartDate.value > returnEndDate.value) { alert('返程最晚日期不能早于最早日期。'); return false; }
      if (daysBetween(returnStartDate.value, returnEndDate.value).length > 62) { alert('返程单次最多比较 62 天。'); return false; }
    }
    return true;
  }

  function candidateLegs() {
    const groups = selectedGroups();
    const out = buildLegs(currentDirection, startDate.value, endDate.value, groups);
    if (tripType !== 'roundtrip') return out;
    const reverse = currentDirection === 'to-minsk' ? 'from-minsk' : 'to-minsk';
    const back = buildLegs(reverse, returnStartDate.value, returnEndDate.value, groups);
    const map = new Map();
    [...out, ...back].forEach(leg => map.set(leg.id, leg));
    return [...map.values()];
  }

  function searchItemForLeg(leg) {
    return {
      id: leg.id,
      origin: leg.from.code,
      destination: leg.to.code,
      departure_date: leg.date,
      direct: !leg.via,
      preferred_carrier: leg.route?.airline || '',
      preferred_flight_number: leg.flight?.flightNumber || '',
    };
  }

  function showLoading(count) {
    results.classList.remove('hidden');
    results.classList.add('live-querying');
    resultCount.textContent = '查询中';
    $('resultTitle').textContent = '正在查询免费价格源…';
    flightList.innerHTML = `
      <div class="live-query-card free-query-card">
        <div class="live-query-spinner"></div>
        <strong>正在查询近期可见价格<span class="live-query-dots"></span></strong>
        <span>正在匹配 ${count} 个候选航班 · 国航 / 白俄罗斯航空</span>
        <small id="freeQueryProgress">正在连接免费价格后端…</small>
      </div>`;
    calendarList.innerHTML = '';
    if (buttonText) buttonText.textContent = '正在查询中…';
    button.disabled = true;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setProgress(text) {
    const node = document.getElementById('freeQueryProgress');
    if (node) node.textContent = text;
  }

  async function postApi(payload) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
      return { ok: false, status: 0, data: { error: 'network-error' } };
    }
  }

  async function queryFreeSource(searches) {
    const chunks = [];
    for (let i = 0; i < searches.length; i += 24) chunks.push(searches.slice(i, i + 24));
    const all = [];
    let providerConfigured = true;
    for (let i = 0; i < chunks.length; i++) {
      setProgress(`正在查询免费价格源 ${i + 1}/${chunks.length}…`);
      const res = await postApi({ searches: chunks[i] });
      if (!res.ok) return { ok: false, results: all, providerConfigured: false, error: res.data };
      const rows = Array.isArray(res.data?.results) ? res.data.results : [];
      all.push(...rows);
      if (rows.some(r => r?.code === 'free_provider_not_configured')) providerConfigured = false;
    }
    return { ok: true, results: all, providerConfigured };
  }

  function resultForLeg(apiResults, leg) {
    return apiResults.find(r => r?.id === leg.id || r?.search?.id === leg.id) || null;
  }

  function bestOffer(result, leg) {
    if (!result?.ok || !Array.isArray(result.offers) || !result.offers.length) return null;
    const wanted = String(leg.flight?.flightNumber || '').replace(/\D/g, '');
    const exact = result.offers.filter(o => {
      const fn = String(o.flight_number || o.preferred_flight_number || '').replace(/\D/g, '');
      return !wanted || fn === wanted;
    });
    const pool = exact.length ? exact : result.offers;
    return [...pool].sort((a, b) => Number(a.amount) - Number(b.amount))[0] || null;
  }

  function buildQuote(result, offer) {
    const verified = result?.source_kind === 'verified';
    const currency = String(offer.currency || 'CNY').toUpperCase();
    return {
      amount: Number(offer.amount),
      currency,
      taxIncluded: offer.tax_included === true,
      availability: verified ? 'verified' : 'recent',
      live: false,
      dataSource: verified ? 'verified-cache' : 'travelpayouts-recent',
      source: offer.source || (verified ? '已核验航空公司价格' : 'Aviasales 近期价格'),
      bundle: offer.bundle || null,
      availableBundles: offer.bundle ? [offer.bundle] : null,
      foundAt: offer.found_at || null,
      transfers: offer.transfers,
      bookingLink: offer.booking_link || null,
      freshness: result?.freshness || null,
    };
  }

  function applyFreeQuotes(apiResults, legs) {
    const quotes = new Map();
    legs.forEach(leg => {
      const result = resultForLeg(apiResults, leg);
      const offer = bestOffer(result, leg);
      if (offer) quotes.set(leg.id, buildQuote(result, offer));
    });
    return quotes;
  }

  function applyQuoteToLeg(leg, quote) {
    if (!leg || !quote) return;
    leg.priceQuote = quote;
    leg.availability = quote.availability;
    leg.fareBundle = quote.bundle || null;
    leg.availableBundles = quote.availableBundles || null;
    leg.taxIncluded = quote.taxIncluded;
  }

  function mergeQuotesIntoCurrent(quoteMap) {
    const items = Array.isArray(currentResults) ? currentResults : [];
    items.forEach(item => {
      const legs = tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
      legs.forEach(leg => {
        const quote = quoteMap.get(leg.id);
        if (quote) applyQuoteToLeg(leg, quote);
      });
      if (tripType === 'roundtrip') {
        const outOk = ['verified','recent'].includes(item.outbound?.priceQuote?.availability);
        const inOk = ['verified','recent'].includes(item.inbound?.priceQuote?.availability);
        if (outOk && inOk) {
          item.priceQuote = sumQuotes(item.outbound.priceQuote, item.inbound.priceQuote);
          item.priceQuote.availability = 'recent';
          item.priceQuote.dataSource = 'free-combined';
          item.priceQuote.source = '免费数据源往返参考合计';
        }
      }
    });
  }

  function hasUsableFare(quote) {
    return quote?.availability === 'verified' || quote?.availability === 'recent' || quote?.dataSource === 'verified-cache' || quote?.dataSource === 'travelpayouts-recent';
  }

  function markMissing(providerConfigured) {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;
      const quote = item.priceQuote;
      if (hasUsableFare(quote)) return;
      const price = card.querySelector('.price-block');
      if (!price) return;
      price.innerHTML = providerConfigured
        ? '<span class="price-unavailable">暂无近期报价</span><span class="price-unavailable-note">免费数据源本次没有匹配价格</span>'
        : '<span class="price-unavailable">免费价格源待配置</span><span class="price-unavailable-note">无需付费 · 配置免费 API Token 后启用</span>';
    });
  }

  function decorateSourceDetails() {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;
      const legs = tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
      const legCards = [...card.querySelectorAll(':scope > .leg-card')];
      legCards.forEach((legCard, i) => {
        const leg = legs[i];
        const q = leg?.priceQuote;
        if (!q || !hasUsableFare(q)) return;
        if (legCard.querySelector('.free-source-note')) return;
        const note = document.createElement('div');
        note.className = `free-source-note ${q.availability === 'verified' ? 'verified' : ''}`;
        if (q.availability === 'verified') {
          note.innerHTML = `<strong>已核验价格</strong><span>${q.source}${q.bundle ? ` · ${q.bundle}` : ''}</span>`;
        } else {
          const when = q.foundAt ? ` · 数据发现于 ${String(q.foundAt).replace('T',' ').slice(0,16)}` : '';
          note.innerHTML = `<strong>近期价格参考</strong><span>${q.source}${when} · 不是航空公司实时库存，购买前请以出票页为准。</span>`;
        }
        legCard.appendChild(note);
      });
    });
  }

  function showFreeSetupMessage() {
    const panel = document.querySelector('.flights-panel');
    if (!panel || panel.querySelector('.free-setup-note')) return;
    const note = document.createElement('div');
    note.className = 'backend-setup-note free-setup-note';
    note.innerHTML = '<strong>免费方案已启用</strong><span>后端已完全移除 Duffel。免费 Travelpayouts / Aviasales Data API Token 配好后，可查询最近约 48 小时内出现过的航班价格；不需要绑定付费 API。</span>';
    panel.querySelector('.panel-title')?.insertAdjacentElement('afterend', note);
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

    const legs = candidateLegs();
    showLoading(legs.length);
    const searches = legs.map(searchItemForLeg);
    const started = Date.now();
    const api = await queryFreeSource(searches);
    const elapsed = Date.now() - started;
    if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));

    originalRunSearch();
    const quoteMap = applyFreeQuotes(api.results || [], legs);
    mergeQuotesIntoCurrent(quoteMap);
    renderFlights();
    decorateSourceDetails();
    markMissing(api.providerConfigured !== false);
    if (api.providerConfigured === false) showFreeSetupMessage();

    $('resultTitle').textContent = tripType === 'roundtrip' ? '时间段往返价格参考' : '时间段航班价格参考';
    finishState();
    busy = false;
  }

  button?.addEventListener('click', handleSearch, true);
  document.title = `白俄留学生机票比价 · v${VERSION}`;
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
