(() => {
  const VERSION = '1.0.11';
  const API_URL = 'https://wcjcbbnvaejwynnrhfld.supabase.co/functions/v1/flight-live-search';
  // Supabase anon key is intentionally public; private airline-provider tokens stay server-side.
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

  function searchItemForLeg(leg, cabin = 'economy') {
    return {
      id: `${leg.id}|${cabin}`,
      origin: leg.from.code,
      destination: leg.to.code,
      departure_date: leg.date,
      cabin_class: cabin,
      max_connections: leg.via ? 1 : 0,
      preferred_carrier: 'CA',
    };
  }

  function showLoading(caCount, belaviaCount) {
    results.classList.remove('hidden');
    results.classList.add('live-querying');
    resultCount.textContent = '查询中';
    $('resultTitle').textContent = '正在查询实时票价…';
    const detail = [
      caCount ? `国航 ${caCount} 个候选航班` : '',
      belaviaCount ? `白航 ${belaviaCount} 个候选航班` : ''
    ].filter(Boolean).join(' · ');
    flightList.innerHTML = `
      <div class="live-query-card backend-live-card">
        <div class="live-query-spinner"></div>
        <strong>正在查询实时票价<span class="live-query-dots"></span></strong>
        <span>${detail || '正在匹配可售航班'}</span>
        <small id="liveQueryProgress">正在连接实时价格后端…</small>
      </div>`;
    calendarList.innerHTML = '';
    if (buttonText) buttonText.textContent = '正在查询中…';
    button.disabled = true;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setProgress(text) {
    const node = document.getElementById('liveQueryProgress');
    if (node) node.textContent = text;
  }

  async function postApi(payload) {
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
  }

  async function queryInChunks(searches, onProgress) {
    const chunks = [];
    for (let i = 0; i < searches.length; i += 20) chunks.push(searches.slice(i, i + 20));
    const all = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(`正在查询国航实时价格 ${i + 1}/${chunks.length}…`);
      const res = await postApi({ provider: 'duffel', searches: chunks[i] });
      if (!res.ok) return { ok: false, status: res.status, data: res.data, results: all };
      all.push(...(res.data?.results || []));
    }
    return { ok: true, results: all };
  }

  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  function offerMatchesLeg(offer, leg) {
    const segs = Array.isArray(offer?.segments) ? offer.segments : [];
    if (!segs.length) return false;
    const wanted = digits(leg.flight?.flightNumber);
    const first = segs[0], last = segs[segs.length - 1];
    if (first.origin !== leg.from.code || last.destination !== leg.to.code) return false;
    const numberMatches = segs.some(seg =>
      digits(seg.marketing_carrier_flight_number) === wanted &&
      String(seg.marketing_carrier?.iata_code || '').toUpperCase() === 'CA'
    );
    if (!numberMatches) return false;
    if (leg.via) {
      const viaCode = leg.via.code;
      const touchesVia = segs.some(seg => seg.origin === viaCode || seg.destination === viaCode);
      if (!touchesVia) return false;
    } else if (segs.length !== 1) {
      return false;
    }
    return true;
  }

  function bestOfferForLeg(apiResults, leg, cabin) {
    const result = apiResults.find(r => r.id === `${leg.id}|${cabin}`);
    if (!result?.ok || result.live_mode === false) return null;
    const matches = (result.offers || []).filter(offer => offerMatchesLeg(offer, leg));
    matches.sort((a, b) => {
      const av = Number.isFinite(a.total_cny) ? a.total_cny : Number.POSITIVE_INFINITY;
      const bv = Number.isFinite(b.total_cny) ? b.total_cny : Number.POSITIVE_INFINITY;
      return av - bv;
    });
    return matches[0] || null;
  }

  function buildLiveQuote(offer, cabin) {
    const cny = Number.isFinite(offer.total_cny) ? offer.total_cny : (offer.total_currency === 'CNY' ? Math.round(offer.total_amount) : null);
    if (!Number.isFinite(cny)) return null;
    return {
      amount: cny,
      currency: 'CNY',
      taxIncluded: true,
      availability: 'verified',
      live: true,
      dataSource: 'duffel-live',
      source: '国航实时可售含税总价',
      bundle: cabin.toUpperCase(),
      availableBundles: [cabin.toUpperCase()],
      originalAmount: offer.total_amount,
      originalCurrency: offer.total_currency,
      taxAmount: offer.tax_cny,
      baseAmount: offer.base_cny,
      originalTaxAmount: offer.tax_amount,
      originalTaxCurrency: offer.tax_currency,
      expiresAt: offer.expires_at,
      offerId: offer.id,
    };
  }

  async function queryAirChina(legs) {
    const caLegs = legs.filter(leg => leg.route?.airline === 'CA');
    if (!caLegs.length) return { ok: true, quotes: new Map(), configured: true };

    const economySearches = caLegs.map(leg => searchItemForLeg(leg, 'economy'));
    const economy = await queryInChunks(economySearches, setProgress);
    if (!economy.ok) return { ok: false, providerError: economy, quotes: new Map(), configured: economy.data?.code !== 'provider_not_configured' };

    const quotes = new Map();
    const missing = [];
    caLegs.forEach(leg => {
      const offer = bestOfferForLeg(economy.results, leg, 'economy');
      if (offer) quotes.set(leg.id, buildLiveQuote(offer, 'economy'));
      else missing.push(leg);
    });

    if (missing.length) {
      setProgress(`经济舱查询完成，继续检查 ${missing.length} 个航班的公务舱…`);
      const business = await queryInChunks(missing.map(leg => searchItemForLeg(leg, 'business')), setProgress);
      if (business.ok) {
        missing.forEach(leg => {
          const offer = bestOfferForLeg(business.results, leg, 'business');
          if (offer) quotes.set(leg.id, buildLiveQuote(offer, 'business'));
        });
      }
    }

    return { ok: true, quotes, configured: true };
  }

  function applyQuoteToLeg(leg, quote) {
    if (!leg || !quote) return;
    leg.priceQuote = quote;
    leg.availability = 'verified';
    leg.fareBundle = quote.bundle || null;
    leg.availableBundles = quote.availableBundles || null;
    leg.taxIncluded = true;
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
        const outLive = item.outbound?.priceQuote?.live === true || item.outbound?.priceQuote?.availability === 'verified';
        const inLive = item.inbound?.priceQuote?.live === true || item.inbound?.priceQuote?.availability === 'verified';
        if (outLive && inLive) {
          item.priceQuote = sumQuotes(item.outbound.priceQuote, item.inbound.priceQuote);
          item.priceQuote.live = true;
          item.priceQuote.dataSource = 'live';
          item.priceQuote.availability = 'verified';
          item.priceQuote.taxIncluded = true;
        }
      }
    });
  }

  function realFare(quote) {
    return quote?.live === true || quote?.dataSource === 'live' || quote?.availability === 'verified';
  }

  function liveTaxDetailHtml(quote) {
    if (!quote?.live || quote.dataSource !== 'duffel-live') return '';
    const rows = [
      `<div class="tax-row"><strong>实时含税总价</strong><strong>${formatCurrency(Math.round(quote.amount),'CNY')}</strong></div>`,
    ];
    if (Number.isFinite(quote.baseAmount)) rows.push(`<div class="tax-row"><span>票面部分</span><span>${formatCurrency(Math.round(quote.baseAmount),'CNY')}</span></div>`);
    if (Number.isFinite(quote.taxAmount)) rows.push(`<div class="tax-row"><span>税费</span><span>${formatCurrency(Math.round(quote.taxAmount),'CNY')}</span></div>`);
    if (quote.originalCurrency && quote.originalCurrency !== 'CNY') rows.push(`<div class="tax-row"><span>供应商原币种</span><span>${quote.originalAmount} ${quote.originalCurrency}</span></div>`);
    rows.push(`<div class="tax-row"><span>票价档</span><span>${quote.bundle === 'BUSINESS' ? '公务舱 BUSINESS' : '经济舱 ECONOMY'}</span></div>`);
    rows.push(`<div class="tax-row"><span>来源</span><span>Duffel Live · 实时可售报价</span></div>`);
    return rows.join('');
  }

  function postRenderLiveDetails() {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;
      const legs = tripType === 'roundtrip' ? [item.outbound, item.inbound] : [item];
      const legCards = [...card.querySelectorAll(':scope > .leg-card')];
      legCards.forEach((legCard, i) => {
        const leg = legs[i];
        if (!leg) return;
        if (leg.route?.airline === 'CA' && realFare(leg.priceQuote) && leg.priceQuote?.live) {
          const box = legCard.querySelector('.tax-breakdown-box');
          if (box) box.innerHTML = liveTaxDetailHtml(leg.priceQuote);
        }
      });
    });
  }

  function markNoLiveQuotes(providerConfigured) {
    const list = sortedResults();
    const cards = [...document.querySelectorAll('#flightList .itinerary-card')];
    cards.forEach((card, index) => {
      const item = list[index];
      if (!item) return;
      const quote = tripType === 'roundtrip' ? item.priceQuote : item.priceQuote;
      if (realFare(quote)) return;
      const price = card.querySelector('.price-block');
      if (!price) return;
      const airline = tripType === 'roundtrip' ? item.outbound?.route?.airline : item.route?.airline;
      if (airline === 'CA' && !providerConfigured) {
        price.innerHTML = '<span class="price-unavailable">实时源待配置</span><span class="price-unavailable-note">国航后端已接好</span>';
      } else {
        price.innerHTML = '<span class="price-unavailable">暂未获取到报价</span><span class="price-unavailable-note">本次实时查询无可售结果</span>';
      }
    });
  }

  function showBackendSetupMessage() {
    const panel = document.querySelector('.flights-panel');
    if (!panel || panel.querySelector('.backend-setup-note')) return;
    const note = document.createElement('div');
    note.className = 'backend-setup-note';
    note.innerHTML = '<strong>国航实时查询后端已经上线</strong><span>还差服务端配置 Duffel Live Access Token。配置后，点击查询就会直接返回 CA721 / CA813 / CA814 的实时可售总价和税费。</span>';
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

    const candidates = candidateLegs();
    const caCount = candidates.filter(x => x.route?.airline === 'CA').length;
    const b2Count = candidates.filter(x => x.route?.airline === 'B2').length;
    showLoading(caCount, b2Count);

    let airChina;
    try {
      airChina = await queryAirChina(candidates);
    } catch (error) {
      airChina = { ok: false, configured: true, quotes: new Map(), error };
    }

    setProgress('正在整理航班结果…');
    originalRunSearch();
    mergeQuotesIntoCurrent(airChina.quotes || new Map());
    renderFlights();
    postRenderLiveDetails();
    markNoLiveQuotes(airChina.configured !== false);
    if (airChina.configured === false) showBackendSetupMessage();

    if (b2Count) {
      const title = $('resultTitle');
      if (title) title.textContent += ' · 白航实时源待接入';
    }

    finishState();
    busy = false;
  }

  button?.addEventListener('click', handleSearch, true);
  document.title = `白俄留学生机票比价 · v${VERSION}`;
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
