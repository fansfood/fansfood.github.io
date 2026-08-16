const APP_VERSION = '1.0.2';

const AIRLINES = {
  CA: {
    name: '中国国际航空股份有限公司',
    english: 'Air China Limited',
    short: '中国国际航空',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png',
    baggage: {
      cabin: '经济舱：1×5kg 手提行李，单件≤55×40×20cm',
      fares: [
        ['经济舱', '1×23kg 托运行李'],
        ['公务舱', '2×32kg 托运行李']
      ],
      extra: '国际航线可预购最多 2 件额外托运行李；经济舱额外件通常每件≤23kg。具体收费需按客票号、航线与购买时间实时查询。'
    }
  },
  B2: {
    name: '白俄罗斯航空公司',
    english: 'Belavia Belarusian Airlines',
    short: '白俄罗斯航空',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Belavia_logo.svg/512px-Belavia_logo.svg.png',
    baggage: {
      cabin: '经济舱：1×10kg 手提行李，单件≤55×40×25cm',
      fares: [
        ['PROMO / LIGHT', '0 件免费托运行李'],
        ['SMART', '1×23kg 托运行李'],
        ['FLEX', '1×32kg 托运行李'],
        ['BUSINESS', '2×32kg 托运行李']
      ],
      extra: '中国属于附加行李第 3 区。自 2026-06-01 起，额外行李按票价品牌、购买时间及线上/线下渠道计价；第 3 区最高可达 €100/件。每位旅客最多可加购 3 件。'
    }
  }
};

const ROUTES = {
  PEK: {
    city: '北京', airport: '北京首都国际机场', code: 'PEK', airline: 'CA',
    chinaToMinsk: { flightNumber:'CA721', weekdays:[1,4], depart:'13:20', arrive:'17:20', arrivalOffset:0, duration:540, aircraft:'Airbus A330 / A330-200', effectiveStart:'2026-03-30', effectiveEnd:'2026-10-22', terminal:'T3', scheduleNote:'周一、周四' },
    minskToChina: { flightNumber:'CA722', weekdays:[1,4], depart:'19:20', arrive:'08:35', arrivalOffset:1, duration:495, aircraft:'Airbus A330-200', effectiveStart:'2026-03-30', effectiveEnd:'2026-10-22', terminal:'到达 T3', scheduleNote:'周一、周四' }
  },
  XIY: {
    city: '西安', airport: '西安咸阳国际机场', code: 'XIY', airline: 'CA',
    chinaToMinsk: { flightNumber:'CA813', weekdays:[6], depart:'14:20', arrive:'18:25', arrivalOffset:0, duration:545, aircraft:'Airbus A330', effectiveStart:'2026-04-04', effectiveEnd:'2026-10-24', terminal:'T5', scheduleNote:'周六' },
    minskToChina: { flightNumber:'CA814', weekdays:[6], depart:'20:30', arrive:'09:55', arrivalOffset:1, duration:505, aircraft:'Airbus A330', effectiveStart:'2026-04-04', effectiveEnd:'2026-10-24', terminal:'', scheduleNote:'周六' }
  },
  URC: {
    city: '乌鲁木齐', airport: '乌鲁木齐天山国际机场', code: 'URC', airline: 'B2',
    chinaToMinsk: { flightNumber:'B2752', weekdays:[1], depart:'22:50', arrive:'00:10', arrivalOffset:1, duration:380, aircraft:'Boeing 737 MAX 8', effectiveStart:'2026-01-01', effectiveEnd:'2026-09-28', terminal:'', scheduleNote:'周一' },
    minskToChina: { flightNumber:'B2751', weekdays:[1], depart:'10:40', arrive:'21:30', arrivalOffset:0, duration:350, aircraft:'Boeing 737 MAX 8', effectiveStart:'2026-01-01', effectiveEnd:'2026-09-28', terminal:'', scheduleNote:'周一' }
  },
  SYX: {
    city: '三亚', airport: '三亚凤凰国际机场', code: 'SYX', airline: 'B2',
    chinaToMinsk: { flightNumber:'B2754', weekdays:[3,6], depart:'23:50', arrive:'06:10', arrivalOffset:1, duration:680, aircraft:'Airbus A330-200', effectiveStart:'2026-08-02', effectiveEnd:'2026-10-24', terminal:'', scheduleNote:'近期公开班表：周三、周六；班期可能动态调整' },
    minskToChina: { flightNumber:'B2753', weekdays:[3,6], depart:'07:00', arrive:'22:20', arrivalOffset:0, duration:620, aircraft:'Airbus A330-200', effectiveStart:'2026-08-02', effectiveEnd:'2026-10-24', terminal:'', scheduleNote:'近期公开班表：周三、周六；班期可能动态调整' }
  }
};

let tripType = 'oneway';
let currentDirection = 'to-minsk';
let currentResults = [];
let currentOutboundLegs = [];

const $ = id => document.getElementById(id);
const startDate=$('startDate'), endDate=$('endDate'), returnStartDate=$('returnStartDate'), returnEndDate=$('returnEndDate');
const returnRange=$('returnRange'), originOptions=$('originOptions'), results=$('results'), flightList=$('flightList'), calendarList=$('calendarList');
const winnerCard=$('winnerCard'), resultCount=$('resultCount'), sortSelect=$('sortSelect');

function isoDate(d){ const tz=d.getTimezoneOffset()*60000; return new Date(d-tz).toISOString().slice(0,10); }
function addDays(dateOrIso, n){ const d=typeof dateOrIso==='string'?new Date(dateOrIso+'T12:00:00'):new Date(dateOrIso); d.setDate(d.getDate()+n); return d; }
function formatDate(s){ const d=new Date(s+'T12:00:00'); return `${d.getMonth()+1}月${d.getDate()}日`; }
function weekday(s){ return ['周日','周一','周二','周三','周四','周五','周六'][new Date(s+'T12:00:00').getDay()]; }
function durationText(m){ return `${Math.floor(m/60)}小时${m%60?`${m%60}分`:''}`; }
function money(v){ return `¥${Number(v).toLocaleString('zh-CN')}`; }
function daysBetween(start,end){ const out=[]; let c=new Date(start+'T12:00:00'), stop=new Date(end+'T12:00:00'); while(c<=stop){ out.push(new Date(c)); c.setDate(c.getDate()+1); } return out; }
function hashNumber(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return Math.abs(h>>>0); }

const today=new Date();
const d7=addDays(today,7), d20=addDays(today,20), d28=addDays(today,28), d42=addDays(today,42);
startDate.value=isoDate(d7); endDate.value=isoDate(d20); returnStartDate.value=isoDate(d28); returnEndDate.value=isoDate(d42);
[startDate,endDate,returnStartDate,returnEndDate].forEach(el=>el.min=isoDate(today));

function flowKey(direction){ return direction==='to-minsk'?'chinaToMinsk':'minskToChina'; }
function reverseFlowKey(direction){ return direction==='to-minsk'?'minskToChina':'chinaToMinsk'; }

function renderOriginOptions(){
  originOptions.innerHTML=Object.values(ROUTES).map(route=>{
    const f=route[flowKey(currentDirection)];
    return `<label class="origin-chip"><input type="checkbox" value="${route.code}" checked><span><strong>${route.city}</strong><small>${f.flightNumber} · ${AIRLINES[route.airline].short} · ${f.scheduleNote}</small></span></label>`;
  }).join('');
  $('toggleAll').textContent='取消全选';
  $('cityFilterLabel').textContent=currentDirection==='to-minsk'?'比较哪些中国出发城市？':'比较到达哪些中国城市？';
}
renderOriginOptions();

function isOperating(flight,date){
  const s=isoDate(date);
  if(flight.effectiveStart && s<flight.effectiveStart) return false;
  if(flight.effectiveEnd && s>flight.effectiveEnd) return false;
  return flight.weekdays.includes(date.getDay());
}

function demoPrice(route,dateIso,direction){
  const base={PEK:4300,XIY:4000,URC:3550,SYX:4200}[route.code];
  const seed=hashNumber(`${route.code}-${dateIso}-${direction}`);
  return Math.round((base+(seed%1000)-360)/10)*10;
}

function createLeg(route,date,direction){
  const dateIso=isoDate(date), flow=flowKey(direction), flight=route[flow], airline=AIRLINES[route.airline];
  const from = direction==='to-minsk' ? {city:route.city, code:route.code, airport:route.airport} : {city:'明斯克', code:'MSQ', airport:'明斯克国家机场'};
  const to = direction==='to-minsk' ? {city:'明斯克', code:'MSQ', airport:'明斯克国家机场'} : {city:route.city, code:route.code, airport:route.airport};
  return { id:`${direction}-${route.code}-${dateIso}`, cityCode:route.code, date:dateIso, direction, route, flight, airline, from, to, price:demoPrice(route,dateIso,direction), duration:flight.duration };
}

function buildLegs(direction,start,end,selectedCodes){
  const flow=flowKey(direction), output=[];
  Object.values(ROUTES).filter(r=>selectedCodes.includes(r.code)).forEach(route=>{
    daysBetween(start,end).forEach(date=>{ if(isOperating(route[flow],date)) output.push(createLeg(route,date,direction)); });
  });
  return output;
}

function buildRoundTrips(outStart,outEnd,backStart,backEnd,selectedCodes){
  const outbound=buildLegs(currentDirection,outStart,outEnd,selectedCodes);
  const reverseDirection=currentDirection==='to-minsk'?'from-minsk':'to-minsk';
  const inbound=buildLegs(reverseDirection,backStart,backEnd,selectedCodes);
  const combos=[];
  outbound.forEach(out=>inbound.forEach(back=>{
    if(out.cityCode!==back.cityCode) return;
    if(back.date<=out.date) return;
    combos.push({ id:`${out.id}__${back.id}`, outbound:out, inbound:back, date:out.date, price:out.price+back.price, duration:out.duration+back.duration, cityCode:out.cityCode });
  }));
  currentOutboundLegs=outbound;
  return combos;
}

function baggageHtml(airline){
  return `<div class="baggage-box">
    <div class="baggage-title"><span>🧳</span><strong>行李额度</strong></div>
    <div class="baggage-cabin">${airline.baggage.cabin}</div>
    <div class="fare-baggage">${airline.baggage.fares.map(([fare,allowance])=>`<div><span>${fare}</span><strong>${allowance}</strong></div>`).join('')}</div>
    <div class="extra-baggage"><span class="extra-label">额外行李</span><span>${airline.baggage.extra}</span></div>
  </div>`;
}

function legHtml(leg,label){
  const f=leg.flight, a=leg.airline;
  return `<div class="leg-card">
    <div class="leg-topline"><span class="leg-label">${label}</span><span class="verified-pill">班期已按公开时刻表匹配</span></div>
    <div class="airline-full">
      <div class="logo-wrap"><img src="${a.logo}" alt="${a.short} Logo" loading="lazy"></div>
      <div class="airline-name"><strong>${a.name}</strong><small>${a.english}</small></div>
      <div class="flight-number"><small>航班号</small><strong>${f.flightNumber}</strong></div>
    </div>
    <div class="timeline">
      <div class="time-point"><strong>${f.depart}</strong><span>${leg.from.city} ${leg.from.code}</span><small>${leg.from.airport}</small></div>
      <div class="flight-line"><span>${durationText(f.duration)}</span><div><i></i><b>✈</b><i></i></div><small>直飞 · ${f.aircraft}</small></div>
      <div class="time-point arrival"><strong>${f.arrive}${f.arrivalOffset?'<sup>+1</sup>':''}</strong><span>${leg.to.city} ${leg.to.code}</span><small>${leg.to.airport}</small></div>
    </div>
    <div class="schedule-row"><span>📅 ${formatDate(leg.date)} ${weekday(leg.date)}</span><span>每周：${f.scheduleNote}</span>${f.terminal?`<span>航站楼：${f.terminal}</span>`:''}</div>
    ${baggageHtml(a)}
  </div>`;
}

function sortedResults(){
  const d=[...currentResults];
  if(sortSelect.value==='date') d.sort((a,b)=>a.date.localeCompare(b.date)||a.price-b.price);
  else if(sortSelect.value==='duration') d.sort((a,b)=>a.duration-b.duration||a.price-b.price);
  else d.sort((a,b)=>a.price-b.price||a.date.localeCompare(b.date));
  return d;
}

function renderWinner(list){
  if(!list.length){ winnerCard.innerHTML='<div class="empty light-empty">这个时间段没有匹配到可用的直飞方案。可以扩大日期范围或增加城市。</div>'; return; }
  const best=[...list].sort((a,b)=>a.price-b.price)[0];
  if(tripType==='roundtrip'){
    winnerCard.innerHTML=`<div class="winner-grid"><div><span class="winner-badge">🏆 当前最低往返组合 · 演示票价</span><h3>${best.outbound.route.city} ⇄ 明斯克</h3><div class="winner-meta">去程 ${formatDate(best.outbound.date)} ${best.outbound.flight.flightNumber} · 返程 ${formatDate(best.inbound.date)} ${best.inbound.flight.flightNumber}</div></div><div class="winner-price"><strong>${money(best.price)}</strong><small>两段合计演示价 · v${APP_VERSION}</small></div></div>`;
  } else {
    winnerCard.innerHTML=`<div class="winner-grid"><div><span class="winner-badge">🏆 当前最低单程 · 演示票价</span><h3>${best.from.city} → ${best.to.city}</h3><div class="winner-meta">${formatDate(best.date)} ${weekday(best.date)} · ${best.flight.flightNumber} · ${best.airline.short} · ${durationText(best.duration)}</div></div><div class="winner-price"><strong>${money(best.price)}</strong><small>演示票价 · v${APP_VERSION}</small></div></div>`;
  }
}

function renderCalendar(){
  const list=tripType==='roundtrip'?currentOutboundLegs:currentResults;
  if(!list.length){ calendarList.innerHTML='<div class="empty">暂无日期</div>'; return; }
  const byDate=Object.values(list.reduce((acc,leg)=>{ if(!acc[leg.date]||leg.price<acc[leg.date].price) acc[leg.date]=leg; return acc; },{})).sort((a,b)=>a.date.localeCompare(b.date));
  const cheapest=Math.min(...byDate.map(x=>x.price));
  calendarList.innerHTML=byDate.map(leg=>`<div class="calendar-row ${leg.price===cheapest?'best':''}"><div class="calendar-date"><strong>${formatDate(leg.date)}</strong><small>${weekday(leg.date)}</small></div><div class="calendar-route">${leg.from.city} → ${leg.to.city}<br>${leg.flight.flightNumber}</div><div class="calendar-price ${leg.price===cheapest?'best':''}">${money(leg.price)}<small>演示</small></div></div>`).join('');
}

function renderFlights(){
  const list=sortedResults(); resultCount.textContent=`${list.length} 个${tripType==='roundtrip'?'往返组合':'航班'}`;
  if(!list.length){ flightList.innerHTML='<div class="empty">暂无结果</div>'; renderWinner(list); renderCalendar(); return; }
  const cheapest=Math.min(...list.map(x=>x.price));
  if(tripType==='roundtrip'){
    flightList.innerHTML=list.slice(0,160).map(combo=>`<article class="itinerary-card ${combo.price===cheapest?'cheapest':''}"><div class="itinerary-head"><div><span class="tag best">${combo.price===cheapest?'🏆 区间最低往返':'往返组合'}</span><strong>${combo.outbound.route.city} ⇄ 明斯克</strong><small>${formatDate(combo.outbound.date)} 去 · ${formatDate(combo.inbound.date)} 回</small></div><div class="price-block"><strong>${money(combo.price)}</strong><small>两段演示总价</small></div></div>${legHtml(combo.outbound,'去程')}${legHtml(combo.inbound,'返程')}</article>`).join('');
  } else {
    flightList.innerHTML=list.map(leg=>`<article class="itinerary-card ${leg.price===cheapest?'cheapest':''}"><div class="itinerary-head"><div><span class="tag best">${leg.price===cheapest?'🏆 区间最低':'直飞航班'}</span><strong>${leg.from.city} → ${leg.to.city}</strong><small>${formatDate(leg.date)} · ${leg.flight.flightNumber}</small></div><div class="price-block"><strong>${money(leg.price)}</strong><small>演示票价</small></div></div>${legHtml(leg,'单程')}</article>`).join('');
  }
  renderWinner(list); renderCalendar();
}

function validateRange(start,end,label){
  if(!start||!end){ alert(`请选择完整的${label}时间范围。`); return false; }
  if(start>end){ alert(`${label}最晚日期不能早于最早日期。`); return false; }
  if(daysBetween(start,end).length>62){ alert(`${label}单次最多比较 62 天，请缩短时间范围。`); return false; }
  return true;
}

function runSearch(){
  const selected=[...originOptions.querySelectorAll('input:checked')].map(i=>i.value);
  if(!selected.length) return alert('请至少选择一个中国城市。');
  if(!validateRange(startDate.value,endDate.value,'去程')) return;
  if(tripType==='roundtrip'){
    if(!validateRange(returnStartDate.value,returnEndDate.value,'返程')) return;
    if(returnEndDate.value<=startDate.value) return alert('返程日期需要晚于去程日期。');
    currentResults=buildRoundTrips(startDate.value,endDate.value,returnStartDate.value,returnEndDate.value,selected);
    $('resultTitle').textContent=`${formatDate(startDate.value)}—${formatDate(endDate.value)} 出发 · 往返直飞组合`;
    $('listTitle').textContent='往返航班组合'; $('calendarTitle').textContent='去程价格日历';
  } else {
    currentResults=buildLegs(currentDirection,startDate.value,endDate.value,selected); currentOutboundLegs=currentResults;
    $('resultTitle').textContent=`${formatDate(startDate.value)}—${formatDate(endDate.value)} 的直飞比价`;
    $('listTitle').textContent='航班横向比较'; $('calendarTitle').textContent='价格日历';
  }
  results.classList.remove('hidden'); renderFlights(); results.scrollIntoView({behavior:'smooth',block:'start'});
}

function setTrip(type){
  tripType=type;
  document.querySelectorAll('.trip-tab').forEach(b=>b.classList.toggle('active',b.dataset.trip===type));
  returnRange.classList.toggle('hidden',type!=='roundtrip');
  $('searchButtonText').textContent=type==='roundtrip'?'搜索时间段内的往返组合':'搜索时间段内的直飞';
  results.classList.add('hidden');
}

document.querySelectorAll('.trip-tab').forEach(b=>b.addEventListener('click',()=>setTrip(b.dataset.trip)));
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); currentDirection=tab.dataset.direction; renderOriginOptions(); results.classList.add('hidden');
}));
$('searchButton').addEventListener('click',runSearch); sortSelect.addEventListener('change',renderFlights);
$('toggleAll').addEventListener('click',()=>{ const boxes=[...originOptions.querySelectorAll('input')], check=boxes.some(b=>!b.checked); boxes.forEach(b=>b.checked=check); $('toggleAll').textContent=check?'取消全选':'全选'; });
startDate.addEventListener('change',()=>{ endDate.min=startDate.value; if(endDate.value<startDate.value) endDate.value=startDate.value; const minReturn=isoDate(addDays(startDate.value,1)); returnStartDate.min=minReturn; returnEndDate.min=minReturn; if(returnStartDate.value<=startDate.value) returnStartDate.value=minReturn; if(returnEndDate.value<returnStartDate.value) returnEndDate.value=returnStartDate.value; });
returnStartDate.addEventListener('change',()=>{ returnEndDate.min=returnStartDate.value; if(returnEndDate.value<returnStartDate.value) returnEndDate.value=returnStartDate.value; });
