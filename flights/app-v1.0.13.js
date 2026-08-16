(() => {
  'use strict';

  const VERSION = '1.0.13';
  const API_URL = 'https://wcjcbbnvaejwynnrhfld.supabase.co/functions/v1/flight-live-search';
  // Supabase anon JWT 是公开前端密钥；航空公司/数据源私密凭据不会写入网页。
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjamNiYm52YWVqd3lubnJoZmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Nzc3NzksImV4cCI6MjEwMjQ1Mzc3OX0.8S4u8zAzFOmQ-Uk8daRVWt6fBlSgcuGYIPEyjh9PH-s';

  const AIRLINES = {
    CA: {
      name: '中国国际航空股份有限公司',
      english: 'Air China Limited',
      short: '中国国际航空',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png',
      official: 'https://www.airchina.com.cn/zh-CN',
      baggage: {
        carry: '经济舱手提行李通常为 1×5kg，公务舱规则以当前客票为准。',
        checked: '国际航线经济舱常见免费托运行李为 1×23kg，公务舱常见为 2×32kg；最终以具体票价品牌和出票页为准。',
        extra: '额外行李价格随航线、客票和购买时间变化，当前网页不伪造固定收费。'
      }
    },
    B2: {
      name: '白俄罗斯航空公司',
      english: 'Belavia Belarusian Airlines',
      short: '白俄罗斯航空',
      logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Belavia_logo.svg/1024px-Belavia_logo.svg.png',
      official: 'https://tickets.belavia.by/websky/search',
      baggage: {
        carry: '经济舱通常 1×10kg；Business 通常 2×10kg。',
        checked: '不同票价档行李不同：SMART 常见 1×23kg，FLEX 1×32kg，BUSINESS 2×32kg。官方搜索返回行李数据时，以本次查询结果优先。',
        extra: '额外行李收费按票价、购买渠道和区域动态变化，以白航购票页为准。'
      }
    }
  };

  const VARIANTS = [
    {
      key: 'PEK_CA721', group: 'PEK', city: '北京', airline: 'CA', direct: true,
      airport: '北京首都国际机场', code: 'PEK',
      toMinsk: { flightNumber: 'CA721', weekdays: [1,4], depart: '13:20', arrive: '17:20', offset: 0, duration: 540, aircraft: 'Airbus A330 / A330-200', terminalFrom: 'T3', terminalTo: '', start: '2026-03-30', end: '2026-10-22' },
      fromMinsk: { flightNumber: 'CA722', weekdays: [1,4], depart: '19:20', arrive: '08:35', offset: 1, duration: 495, aircraft: 'Airbus A330-200', terminalFrom: '', terminalTo: 'T3', start: '2026-03-30', end: '2026-10-22' }
    },
    {
      key: 'PEK_CA813', group: 'PEK', city: '北京', airline: 'CA', direct: false,
      airport: '北京首都国际机场', code: 'PEK',
      via: { city: '西安', code: 'XIY', airport: '西安咸阳国际机场', toArrive: '12:20', toDepart: '14:20', fromArrive: '09:55', fromDepart: '11:55' },
      toMinsk: { flightNumber: 'CA813', weekdays: [6], depart: '09:40', arrive: '18:25', offset: 0, duration: 825, aircraft: 'Airbus A330', terminalFrom: 'T3', terminalTo: '', start: '2026-04-04', end: '2026-10-24' },
      fromMinsk: { flightNumber: 'CA814', weekdays: [6], depart: '20:30', arrive: '14:15', offset: 1, duration: 765, aircraft: 'Airbus A330', terminalFrom: '', terminalTo: 'T3', start: '2026-04-04', end: '2026-10-24' }
    },
    {
      key: 'XIY_CA813', group: 'XIY', city: '西安', airline: 'CA', direct: true,
      airport: '西安咸阳国际机场', code: 'XIY',
      toMinsk: { flightNumber: 'CA813', weekdays: [6], depart: '14:20', arrive: '18:25', offset: 0, duration: 545, aircraft: 'Airbus A330', terminalFrom: 'T5', terminalTo: '', start: '2026-04-04', end: '2026-10-24' },
      fromMinsk: { flightNumber: 'CA814', weekdays: [6], depart: '20:30', arrive: '09:55', offset: 1, duration: 505, aircraft: 'Airbus A330', terminalFrom: '', terminalTo: '', start: '2026-04-04', end: '2026-10-24' }
    },
    {
      key: 'URC_B2', group: 'URC', city: '乌鲁木齐', airline: 'B2', direct: true,
      airport: '乌鲁木齐天山国际机场', code: 'URC',
      toMinsk: { flightNumber: 'B2752', weekdays: [1], depart: '22:50', arrive: '00:10', offset: 1, duration: 380, aircraft: 'Boeing 737 MAX 8', terminalFrom: 'T4', terminalTo: '', start: '2026-01-01', end: '2026-09-28' },
      fromMinsk: { flightNumber: 'B2751', weekdays: [1], depart: '10:40', arrive: '21:30', offset: 0, duration: 350, aircraft: 'Boeing 737 MAX 8', terminalFrom: '', terminalTo: 'T4', start: '2026-01-01', end: '2026-09-28' }
    },
    {
      key: 'SYX_B2', group: 'SYX', city: '三亚', airline: 'B2', direct: true,
      airport: '三亚凤凰国际机场', code: 'SYX',
      toMinsk: { flightNumber: 'B2754', weekdays: [3,6], depart: '23:50', arrive: '06:10', offset: 1, duration: 680, aircraft: 'Airbus A330-200', terminalFrom: '', terminalTo: '', start: '2026-08-02', end: '2026-10-24' },
      fromMinsk: { flightNumber: 'B2753', weekdays: [3,6], depart: '07:00', arrive: '22:20', offset: 0, duration: 620, aircraft: 'Airbus A330-200', terminalFrom: '', terminalTo: '', start: '2026-08-02', end: '2026-10-24' }
    }
  ];

  const state = {
    trip: 'oneway',
    direction: 'to-minsk',
    busy: false,
    outbound: [],
    inbound: [],
    items: [],
    apiResults: new Map()
  };

  const $ = (id) => document.getElementById(id);
  const startDate = $('startDate');
  const endDate = $('endDate');
  const returnStart = $('returnStartDate');
  const returnEnd = $('returnEndDate');
  const returnRange = $('returnRange');
  const cityGrid = $('cityGrid');
  const searchButton = $('searchButton');
  const searchButtonText = $('searchButtonText');
  const results = $('results');
  const resultTitle = $('resultTitle');
  const resultCount = $('resultCount');
  const flightList = $('flightList');
  const calendarList = $('calendarList');
  const sortSelect = $('sortSelect');
  const sourceStatus = $('sourceStatus');

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }

  function isoDate(date) {
    const d = new Date(date);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0,10);
  }
  function addDays(dateOrIso, n) {
    const d = typeof dateOrIso === 'string' ? new Date(`${dateOrIso}T12:00:00`) : new Date(dateOrIso);
    d.setDate(d.getDate() + n);
    return d;
  }
  function dateList(start, end) {
    const out = [];
    let d = new Date(`${start}T12:00:00`);
    const stop = new Date(`${end}T12:00:00`);
    while (d <= stop) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return out;
  }
  function formatDate(s) { const d = new Date(`${s}T12:00:00`); return `${d.getMonth()+1}月${d.getDate()}日`; }
  function week(s) { return ['周日','周一','周二','周三','周四','周五','周六'][new Date(`${s}T12:00:00`).getDay()]; }
  function durationText(m) { if (!Number.isFinite(Number(m))) return ''; const n=Number(m); return `${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}m`; }
  function money(n) { return `¥${Math.round(Number(n)).toLocaleString('zh-CN')}`; }
  function nativeMoney(n, c) {
    if (!Number.isFinite(Number(n))) return '';
    const code = String(c || '').toUpperCase();
    if (code === 'BYN') return `${Number(n).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} Б · BYN`;
    try { return new Intl.NumberFormat('zh-CN',{style:'currency',currency:code,maximumFractionDigits:2}).format(Number(n)); }
    catch { return `${Number(n).toLocaleString('zh-CN')} ${code}`; }
  }
  function flightSpec(variant, direction) { return direction === 'to-minsk' ? variant.toMinsk : variant.fromMinsk; }
  function isOperating(spec, d) {
    const s = isoDate(d);
    if (spec.start && s < spec.start) return false;
    if (spec.end && s > spec.end) return false;
    return spec.weekdays.includes(d.getDay());
  }
  function cityName(code) { return code === 'MSQ' ? '明斯克' : (VARIANTS.find(v => v.code === code)?.city || code); }

  function routeEndpoints(variant, direction) {
    if (direction === 'to-minsk') return { from: variant.code, to: 'MSQ', fromCity: variant.city, toCity: '明斯克' };
    return { from: 'MSQ', to: variant.code, fromCity: '明斯克', toCity: variant.city };
  }

  function routeLabel(variant, direction) {
    if (variant.via) {
      return direction === 'to-minsk'
        ? `${variant.city} → ${variant.via.city} → 明斯克`
        : `明斯克 → ${variant.via.city} → ${variant.city}`;
    }
    const e = routeEndpoints(variant, direction);
    return `${e.fromCity} → ${e.toCity}`;
  }

  function buildLegs(direction, start, end, groups) {
    const legs = [];
    for (const variant of VARIANTS.filter(v => groups.includes(v.group))) {
      const spec = flightSpec(variant, direction);
      for (const d of dateList(start, end)) {
        if (!isOperating(spec, d)) continue;
        const endpoints = routeEndpoints(variant, direction);
        const date = isoDate(d);
        legs.push({
          id: `${direction}|${variant.key}|${date}`,
          variantKey: variant.key,
          group: variant.group,
          variant,
          direction,
          date,
          spec,
          from: endpoints.from,
          to: endpoints.to,
          fromCity: endpoints.fromCity,
          toCity: endpoints.toCity,
          routeLabel: routeLabel(variant, direction),
          sourceKind: null,
          currentAvailable: null,
          availabilitySummary: null,
          offers: [],
          bestOffer: null,
          priceCny: null,
          errorCode: null
        });
      }
    }
    return legs;
  }

  function renderCities() {
    const groups = ['PEK','XIY','URC','SYX'];
    const labels = {
      PEK: ['北京','CA721 / CA813','直飞 + 经西安'], XIY: ['西安','CA813','直飞'],
      URC: ['乌鲁木齐','B2752 / B2751','白航'], SYX: ['三亚','B2754 / B2753','白航']
    };
    cityGrid.innerHTML = groups.map(g => `<label class="city-chip"><input type="checkbox" value="${g}" checked><span><strong>${labels[g][0]}</strong><small>${labels[g][1]} · ${labels[g][2]}</small></span></label>`).join('');
    $('toggleAll').textContent = '取消全选';
  }

  function selectedGroups() { return [...cityGrid.querySelectorAll('input:checked')].map(x => x.value); }

  function initDates() {
    const today = new Date();
    [startDate,endDate,returnStart,returnEnd].forEach(el => el.min = isoDate(today));
    startDate.value = isoDate(addDays(today,7));
    endDate.value = isoDate(addDays(today,21));
    returnStart.value = isoDate(addDays(today,30));
    returnEnd.value = isoDate(addDays(today,45));
  }

  function validate() {
    if (!selectedGroups().length) { alert('请至少选择一个中国城市。'); return false; }
    if (!startDate.value || !endDate.value || startDate.value > endDate.value) { alert('请选择正确的去程时间范围。'); return false; }
    if (dateList(startDate.value,endDate.value).length > 62) { alert('单次去程最多比较 62 天。'); return false; }
    if (state.trip === 'roundtrip') {
      if (!returnStart.value || !returnEnd.value || returnStart.value > returnEnd.value) { alert('请选择正确的返程时间范围。'); return false; }
      if (dateList(returnStart.value,returnEnd.value).length > 62) { alert('单次返程最多比较 62 天。'); return false; }
    }
    return true;
  }

  function apiSearchItem(leg) {
    return {
      id: leg.id,
      origin: leg.from,
      destination: leg.to,
      departure_date: leg.date,
      direct: leg.variant.direct,
      preferred_carrier: leg.variant.airline,
      preferred_flight_number: leg.spec.flightNumber
    };
  }

  async function postApi(searches) {
    const response = await fetch(API_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ searches })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  function setLoading(text) {
    results.classList.remove('hidden');
    resultTitle.textContent = '正在查询航空公司价格…';
    resultCount.textContent = '查询中';
    flightList.innerHTML = `<div class="loading-card"><div class="spinner"></div><strong>正在查询中…</strong><small id="loadingText">${esc(text)}</small></div>`;
    calendarList.innerHTML = '';
    searchButton.disabled = true;
    searchButtonText.textContent = '正在查询中…';
    results.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updateLoading(text) { const n=$('loadingText'); if(n) n.textContent=text; }

  async function queryAll(legs) {
    const unique = [...new Map(legs.map(l => [l.id,l])).values()];
    const chunks = [];
    for (let i=0;i<unique.length;i+=20) chunks.push(unique.slice(i,i+20));
    const map = new Map();
    for (let i=0;i<chunks.length;i++) {
      const b2 = chunks[i].filter(x => x.variant.airline==='B2').length;
      const ca = chunks[i].filter(x => x.variant.airline==='CA').length;
      updateLoading(`第 ${i+1}/${chunks.length} 组 · 白航官网当前查询 ${b2} 条 · 国航免费参考 ${ca} 条`);
      const data = await postApi(chunks[i].map(apiSearchItem));
      for (const r of Array.isArray(data?.results) ? data.results : []) map.set(r.id,r);
    }
    return map;
  }

  function chooseBest(offers) {
    const valid = (offers || []).filter(o => Number.isFinite(Number(o.amount_cny ?? o.amount)) && o.is_available !== false);
    valid.sort((a,b) => Number(a.amount_cny ?? a.amount) - Number(b.amount_cny ?? b.amount));
    return valid[0] || null;
  }

  function applyResult(leg, r) {
    if (!r) { leg.errorCode='no_response'; return; }
    leg.sourceKind = r.source_kind || null;
    leg.currentAvailable = r.current_availability ?? null;
    leg.availabilitySummary = r.availability_summary || null;
    leg.offers = Array.isArray(r.offers) ? r.offers : [];
    leg.errorCode = r.ok === false ? (r.code || 'provider_error') : null;
    leg.bestOffer = chooseBest(leg.offers);
    if (leg.bestOffer) leg.priceCny = Number(leg.bestOffer.amount_cny ?? leg.bestOffer.amount);
  }

  function buildItems() {
    if (state.trip === 'oneway') return [...state.outbound];
    const out = [];
    for (const o of state.outbound) {
      const backs = state.inbound.filter(i => i.variantKey === o.variantKey && i.date >= o.date);
      for (const i of backs) {
        const price = Number.isFinite(o.priceCny) && Number.isFinite(i.priceCny) ? o.priceCny + i.priceCny : null;
        const current = o.sourceKind === 'official-current' && i.sourceKind === 'official-current';
        out.push({ id:`${o.id}__${i.id}`, roundtrip:true, outbound:o, inbound:i, variant:o.variant, date:o.date, priceCny:price, currentOfficial:current, routeLabel:`${o.fromCity} ⇄ ${o.toCity}` });
      }
    }
    return out.slice(0,120);
  }

  function itemPrice(item) { return item.roundtrip ? item.priceCny : item.priceCny; }
  function itemDuration(item) { return item.roundtrip ? item.outbound.spec.duration + item.inbound.spec.duration : item.spec.duration; }
  function sortItems(items) {
    const arr=[...items];
    if(sortSelect.value==='date') arr.sort((a,b)=>a.date.localeCompare(b.date)||((itemPrice(a)??1e12)-(itemPrice(b)??1e12)));
    else if(sortSelect.value==='duration') arr.sort((a,b)=>itemDuration(a)-itemDuration(b));
    else arr.sort((a,b)=>(itemPrice(a)??1e12)-(itemPrice(b)??1e12)||a.date.localeCompare(b.date));
    return arr;
  }

  function sourceLabel(leg) {
    if (leg.sourceKind === 'official-current') return '白航官网当前查询';
    if (leg.sourceKind === 'recent-reference') return '近期价格参考';
    return '';
  }

  function priceBlockForLeg(leg) {
    if (leg.sourceKind === 'official-current') {
      if (leg.currentAvailable === false || !leg.bestOffer) return `<span class="price-main">—</span><span class="price-tag unavailable">官网暂无可售报价</span>`;
      const o=leg.bestOffer;
      const native=nativeMoney(o.amount,o.currency);
      const biz=leg.availabilitySummary==='business_only';
      return `<span class="price-main">${esc(money(leg.priceCny))}</span>${native?`<span class="price-native">${esc(native)} · 含税费</span>`:''}<span class="price-tag ${biz?'business':'current'}">${biz?'仅 BUSINESS':'当前可售'}</span>`;
    }
    if (leg.sourceKind === 'recent-reference' && leg.bestOffer) {
      return `<span class="price-main">约 ${esc(money(leg.priceCny))}</span><span class="price-tag reference">近期参考</span>`;
    }
    if (leg.variant.airline === 'CA') return `<span class="price-main no-quote">暂无当前价</span><span class="price-tag unavailable">国航官网需确认</span>`;
    if (leg.errorCode) return `<span class="price-main no-quote">查询失败</span><span class="price-tag unavailable">可稍后重试</span>`;
    return `<span class="price-main no-quote">暂无报价</span>`;
  }

  function priceBlock(item) {
    if (!item.roundtrip) return priceBlockForLeg(item);
    if (Number.isFinite(item.priceCny)) {
      const current=item.currentOfficial;
      return `<span class="price-main">${current?'':'约 '}${esc(money(item.priceCny))}</span><span class="price-tag ${current?'current':'reference'}">${current?'官网当前往返':'近期参考合计'}</span>`;
    }
    return `<span class="price-main no-quote">暂无完整报价</span>`;
  }

  function offerDetails(leg) {
    if (leg.sourceKind === 'official-current') {
      if (!leg.offers.length) return `<div class="official-box"><div class="box-title">白航官网当前查询</div><div class="fare-row"><span>当前结果</span><strong class="seat-none">官网未返回可售票价</strong></div></div>`;
      const rows=leg.offers.map(o=>{
        const cls=String(o.service_class||'').toLowerCase().includes('business')?'BUSINESS':'ECONOMY';
        const seats=Number.isFinite(Number(o.available_seats))?`至少 ${Number(o.available_seats)} 席`:'已通过可用性检查';
        const p=Number.isFinite(Number(o.amount_cny))?money(o.amount_cny):nativeMoney(o.amount,o.currency);
        return `<div class="fare-box"><div class="box-title">${esc(cls)} · ${esc(p)}</div><div class="fare-grid"><div class="fare-row"><span>原始价格</span><strong>${esc(nativeMoney(o.amount,o.currency))}</strong></div><div class="fare-row"><span>可售座位</span><strong class="seat-ok">${esc(seats)}</strong></div><div class="fare-row"><span>订座舱位</span><strong>${esc(o.booking_class||'—')}</strong></div><div class="fare-row"><span>票价代码</span><strong>${esc(o.fare_code||'—')}</strong></div><div class="fare-row"><span>税费口径</span><strong>官方搜索总价 · 含税费</strong></div></div></div>`;
      }).join('');
      return `<div class="official-box"><div class="box-title">白俄罗斯航空官网 · 当前库存检查</div><div class="fare-row"><span>查询状态</span><strong class="seat-ok">${leg.availabilitySummary==='business_only'?'经济舱未返回可售方案，仅 Business 可售':'已返回当前可售方案'}</strong></div></div>${rows}`;
    }
    if (leg.sourceKind === 'recent-reference' && leg.bestOffer) {
      return `<div class="reference-box"><div class="box-title">国航价格参考</div><div class="fare-row"><span>近期参考价</span><strong>${esc(money(leg.priceCny))}</strong></div><div class="fare-row"><span>当前仓位</span><strong>未由国航官网自动确认</strong></div><div class="fare-row"><span>原因</span><strong>当前不对国航官网进行未授权自动抓取</strong></div></div>`;
    }
    return `<div class="reference-box"><div class="box-title">价格状态</div><div class="fare-row"><span>当前结果</span><strong>${leg.variant.airline==='CA'?'暂未获得国航授权的免费当前库存接口':'本次官网查询未返回报价'}</strong></div></div>`;
  }

  function baggageHtml(leg) {
    const airline=AIRLINES[leg.variant.airline];
    const official=leg.sourceKind==='official-current' ? leg.offers.flatMap(o=>Array.isArray(o.baggage)?o.baggage.map(b=>`${o.service_class||''}：${b.value??''}${b.unit||''}`):[]) : [];
    return `<div class="baggage-wrap"><button class="baggage-toggle" type="button"><span>🧳 行李额度 · 点击展开</span><span>⌄</span></button><div class="baggage-content">${official.length?`<div><strong>本次官方返回：</strong>${official.map(esc).join('；')}</div>`:''}<div><strong>手提：</strong>${esc(airline.baggage.carry)}</div><div><strong>托运：</strong>${esc(airline.baggage.checked)}</div><div><strong>额外行李：</strong>${esc(airline.baggage.extra)}</div></div></div>`;
  }

  function timelineHtml(leg) {
    const v=leg.variant,s=leg.spec;
    const startAirport=leg.from==='MSQ'?'明斯克国家机场':v.airport;
    const endAirport=leg.to==='MSQ'?'明斯克国家机场':v.airport;
    return `<div class="timeline"><div class="airport-time"><strong>${esc(s.depart)}</strong><b>${esc(leg.fromCity)} ${esc(leg.from)}</b><small>${esc(startAirport)}${s.terminalFrom?` · ${esc(s.terminalFrom)}`:''}</small></div><div class="flight-mid"><span>${esc(durationText(s.duration))}</span><div class="flight-line"></div><span>${v.direct?'直飞':'经停 '+esc(v.via.city)}</span></div><div class="airport-time end"><strong>${esc(s.arrive)}${s.offset?'<sup>+1</sup>':''}</strong><b>${esc(leg.toCity)} ${esc(leg.to)}</b><small>${esc(endAirport)}${s.terminalTo?` · ${esc(s.terminalTo)}`:''}</small></div></div>`;
  }

  function legDetail(leg, title='') {
    const a=AIRLINES[leg.variant.airline],v=leg.variant,s=leg.spec;
    const via=v.via?`<div class="via-box"><strong>经停 ${esc(v.via.city)} ${esc(v.via.code)}</strong><span>${leg.direction==='to-minsk'?`${esc(v.via.toArrive)} 到达 · ${esc(v.via.toDepart)} 再起飞`:`${esc(v.via.fromArrive)} 到达 · ${esc(v.via.fromDepart)} 再起飞`}</span></div>`:'';
    return `<section class="leg-detail">${title?`<div class="box-title">${esc(title)}</div>`:''}<div class="airline-line"><div class="airline-id"><div class="airline-logo-wrap"><img class="airline-logo" src="${esc(a.logo)}" alt="${esc(a.short)} logo"><span class="airline-fallback hidden">${esc(a.short)}</span></div><div class="airline-text"><strong>${esc(a.name)}</strong><small>${esc(a.english)}</small></div></div><div class="flight-no"><small>航班号</small><strong>${esc(s.flightNumber)}</strong></div></div>${timelineHtml(leg)}<div class="chips"><span class="chip">${esc(formatDate(leg.date))} ${esc(week(leg.date))}</span><span class="chip">${esc(s.aircraft)}</span><span class="chip">${v.direct?'直飞':'经停西安'}</span><span class="chip">${esc(sourceLabel(leg)||'航班班期')}</span></div>${via}${offerDetails(leg)}${baggageHtml(leg)}<a class="official-link" href="${esc(a.official)}" target="_blank" rel="noopener">前往${esc(a.short)}官网核对 / 购买 →</a></section>`;
  }

  function cardHtml(item, bestPrice) {
    const leg=item.roundtrip?item.outbound:item;
    const route=item.roundtrip?`${leg.fromCity} ⇄ ${leg.toCity}`:leg.routeLabel;
    const meta=item.roundtrip?`${formatDate(item.outbound.date)} 去 · ${formatDate(item.inbound.date)} 回 · ${leg.spec.flightNumber}/${item.inbound.spec.flightNumber}`:`${formatDate(leg.date)} · ${week(leg.date)} · ${leg.spec.flightNumber}`;
    const p=itemPrice(item);
    const best=Number.isFinite(p)&&p===bestPrice;
    const details=item.roundtrip?`${legDetail(item.outbound,'去程')}${legDetail(item.inbound,'返程')}`:legDetail(leg);
    return `<article class="flight-card ${best?'best':''}" data-id="${esc(item.id)}"><div class="flight-summary" role="button" tabindex="0" aria-expanded="false"><div class="summary-route"><span class="type-pill ${leg.variant.direct?'':'stop'}">${leg.variant.direct?'直飞航班':'经停航班'}</span><h4>${esc(route)}</h4><small>${esc(meta)}</small></div><div class="summary-price">${priceBlock(item)}</div><span class="chevron">⌄</span></div><div class="flight-details">${details}</div></article>`;
  }

  function renderCalendar(items) {
    const legs=state.trip==='roundtrip'?state.outbound:items;
    const byDate=new Map();
    for(const leg of legs){
      const current=byDate.get(leg.date);
      if(!current || (Number.isFinite(leg.priceCny)&&(!Number.isFinite(current.priceCny)||leg.priceCny<current.priceCny))) byDate.set(leg.date,leg);
    }
    const arr=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
    const prices=arr.map(x=>x.priceCny).filter(Number.isFinite);
    const best=prices.length?Math.min(...prices):null;
    calendarList.innerHTML=arr.map(leg=>`<div class="calendar-row ${best!=null&&leg.priceCny===best?'best':''}"><div class="calendar-date"><strong>${esc(formatDate(leg.date))}</strong><small>${esc(week(leg.date))}</small></div><div class="calendar-route">${esc(leg.routeLabel)}<br>${esc(leg.spec.flightNumber)}</div><div class="calendar-price">${Number.isFinite(leg.priceCny)?`${leg.sourceKind==='recent-reference'?'约 ':''}${esc(money(leg.priceCny))}`:'—'}<small>${esc(leg.sourceKind==='official-current'?'官网当前':leg.sourceKind==='recent-reference'?'近期参考':'')}</small></div></div>`).join('') || '<div class="empty">该时间段没有匹配到班期。</div>';
  }

  function render() {
    state.items=buildItems();
    const sorted=sortItems(state.items);
    const prices=sorted.map(itemPrice).filter(Number.isFinite);
    const best=prices.length?Math.min(...prices):null;
    resultTitle.textContent=state.trip==='roundtrip'?'时间段往返航班价格比较':'时间段航班价格比较';
    resultCount.textContent=`${sorted.length} 个方案`;
    const hasCA=sorted.some(x=>(x.roundtrip?x.outbound:x).variant.airline==='CA');
    const warning=hasCA?`<div class="provider-warning"><strong>数据源说明：</strong>白俄罗斯航空 B2 通过其 WebSky 官方购票前端接口现场查询价格与可售座位；国航当前不做未经授权的官网自动抓取，因此有免费近期参考时只标“近期参考”，不会冒充当前仓位。</div>`:'';
    flightList.innerHTML=warning+(sorted.length?sorted.map(x=>cardHtml(x,best)).join(''):'<div class="empty">这个时间段没有匹配到候选航班。</div>');
    renderCalendar(sorted);
    bindDynamic();
  }

  function bindDynamic() {
    flightList.querySelectorAll('.flight-summary').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const card=btn.closest('.flight-card');
        const open=!card.classList.contains('open');
        card.classList.toggle('open',open);btn.setAttribute('aria-expanded',String(open));
      });
      btn.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();btn.click();}});
    });
    flightList.querySelectorAll('.baggage-toggle').forEach(btn=>btn.addEventListener('click',(e)=>{
      e.stopPropagation();const wrap=btn.closest('.baggage-wrap');const content=wrap.querySelector('.baggage-content');const open=!wrap.classList.contains('open');wrap.classList.toggle('open',open);content.classList.toggle('open',open);
    }));
    flightList.querySelectorAll('.airline-logo').forEach(img=>img.addEventListener('error',()=>{img.classList.add('hidden');img.nextElementSibling?.classList.remove('hidden');},{once:true}));
  }

  async function handleSearch() {
    if(state.busy||!validate()) return;
    state.busy=true;
    const groups=selectedGroups();
    state.outbound=buildLegs(state.direction,startDate.value,endDate.value,groups);
    const reverse=state.direction==='to-minsk'?'from-minsk':'to-minsk';
    state.inbound=state.trip==='roundtrip'?buildLegs(reverse,returnStart.value,returnEnd.value,groups):[];
    const all=[...state.outbound,...state.inbound];
    setLoading(`已匹配 ${all.length} 个候选航段，准备现场查询白航并获取国航免费参考…`);
    try{
      const map=await queryAll(all);
      state.apiResults=map;
      all.forEach(leg=>applyResult(leg,map.get(leg.id)));
      render();
      sourceStatus.textContent='白航：官方当前查询（含可用性检查） · 国航：当前不做未授权官网抓取，免费数据仅作近期参考。历史截图价格不参与当前结果。';
    }catch(err){
      all.forEach(leg=>{if(!leg.sourceKind)leg.errorCode='network_error';});
      render();
      const w=document.createElement('div');w.className='provider-warning error-note';w.textContent=`查询后端暂时异常：${err instanceof Error?err.message:'未知错误'}。请稍后重试。`;flightList.prepend(w);
    }finally{
      state.busy=false;searchButton.disabled=false;searchButtonText.textContent=state.trip==='roundtrip'?'搜索时间段内的往返组合':'搜索时间段内的航班';
    }
  }

  document.querySelectorAll('[data-trip]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-trip]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.trip=btn.dataset.trip;returnRange.classList.toggle('hidden',state.trip!=='roundtrip');searchButtonText.textContent=state.trip==='roundtrip'?'搜索时间段内的往返组合':'搜索时间段内的航班';results.classList.add('hidden');
  }));
  document.querySelectorAll('[data-direction]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-direction]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.direction=btn.dataset.direction;results.classList.add('hidden');
  }));
  $('toggleAll').addEventListener('click',()=>{const boxes=[...cityGrid.querySelectorAll('input')];const on=boxes.some(x=>!x.checked);boxes.forEach(x=>x.checked=on);$('toggleAll').textContent=on?'取消全选':'全选';});
  startDate.addEventListener('change',()=>{endDate.min=startDate.value;if(endDate.value<startDate.value)endDate.value=startDate.value;});
  returnStart.addEventListener('change',()=>{returnEnd.min=returnStart.value;if(returnEnd.value<returnStart.value)returnEnd.value=returnStart.value;});
  sortSelect.addEventListener('change',()=>{if(!results.classList.contains('hidden'))render();});
  searchButton.addEventListener('click',handleSearch);

  renderCities();initDates();
  document.title=`白俄留学生机票比价 · v${VERSION}`;
})();
