const APP_VERSION = '1.0.1';

const routes = {
  'to-minsk': [
    { code:'PEK', city:'北京', dest:'MSQ', destCity:'明斯克', airline:'中国国际航空', airlineShort:'国航', duration:610, scheduleMode:'demo' },
    { code:'XIY', city:'西安', dest:'MSQ', destCity:'明斯克', airline:'中国国际航空', airlineShort:'国航', duration:565, scheduleMode:'demo' },
    { code:'URC', city:'乌鲁木齐', dest:'MSQ', destCity:'明斯克', airline:'白俄罗斯航空', airlineShort:'白航', duration:380, flightNumber:'B2752', scheduleMode:'verified', weekdays:[1], scheduleEnd:'2026-09-28' },
    { code:'SYX', city:'三亚', dest:'MSQ', destCity:'明斯克', airline:'白俄罗斯航空', airlineShort:'白航', duration:690, scheduleMode:'demo' }
  ],
  'from-minsk': [
    { code:'MSQ', city:'明斯克', dest:'PEK', destCity:'北京', airline:'中国国际航空', airlineShort:'国航', duration:590, key:'PEK', scheduleMode:'demo' },
    { code:'MSQ', city:'明斯克', dest:'XIY', destCity:'西安', airline:'中国国际航空', airlineShort:'国航', duration:545, key:'XIY', scheduleMode:'demo' },
    { code:'MSQ', city:'明斯克', dest:'URC', destCity:'乌鲁木齐', airline:'白俄罗斯航空', airlineShort:'白航', duration:350, key:'URC', flightNumber:'B2751', scheduleMode:'verified', weekdays:[1], scheduleEnd:'2026-09-28' },
    { code:'MSQ', city:'明斯克', dest:'SYX', destCity:'三亚', airline:'白俄罗斯航空', airlineShort:'白航', duration:660, key:'SYX', scheduleMode:'demo' }
  ]
};

let currentDirection = 'to-minsk';
let currentResults = [];
const $ = id => document.getElementById(id);
const startDate=$('startDate'), endDate=$('endDate'), originOptions=$('originOptions'), results=$('results');
const flightList=$('flightList'), calendarList=$('calendarList'), winnerCard=$('winnerCard'), resultCount=$('resultCount'), sortSelect=$('sortSelect');

function isoDate(d){ const tz=d.getTimezoneOffset()*60000; return new Date(d-tz).toISOString().slice(0,10); }
const today=new Date(), d7=new Date(today), d20=new Date(today); d7.setDate(today.getDate()+7); d20.setDate(today.getDate()+20);
startDate.value=isoDate(d7); endDate.value=isoDate(d20); startDate.min=isoDate(today); endDate.min=isoDate(today);

function routeIdentity(r){ return r.key || r.code; }
function renderOriginOptions(){
  originOptions.innerHTML=routes[currentDirection].map(r=>`<label class="origin-chip"><input type="checkbox" value="${routeIdentity(r)}" checked><span><strong>${currentDirection==='to-minsk'?r.city:r.destCity}</strong><small>${currentDirection==='to-minsk'?r.code:r.dest} · ${r.airlineShort}${r.flightNumber?' · '+r.flightNumber:''}</small></span></label>`).join('');
}
renderOriginOptions();

function daysBetween(start,end){ const out=[]; let c=new Date(start+'T12:00:00'), s=new Date(end+'T12:00:00'); while(c<=s){out.push(new Date(c)); c.setDate(c.getDate()+1);} return out; }
function hashNumber(str){ let h=2166136261; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);} return Math.abs(h>>>0); }
function isScheduled(route,date,routeIndex){
  const day=date.getDay();
  if(route.scheduleMode==='verified'){
    const dateIso=isoDate(date);
    if(route.scheduleEnd && dateIso>route.scheduleEnd) return false;
    return route.weekdays.includes(day);
  }
  return route.airlineShort==='国航' ? ((day+routeIndex)%3===0) : ((day+routeIndex)%4===1);
}

function buildFlights(start,end,selectedKeys){
  const dates=daysBetween(start,end), routeSet=routes[currentDirection].filter(r=>selectedKeys.includes(routeIdentity(r))), output=[];
  routeSet.forEach((route,routeIndex)=>dates.forEach(date=>{
    if(!isScheduled(route,date,routeIndex)) return;
    const dateIso=isoDate(date), seed=hashNumber(`${dateIso}-${routeIdentity(route)}-${currentDirection}`);
    const base={PEK:4200,XIY:3900,URC:3500,SYX:4100}[routeIdentity(route)]||4000;
    const price=Math.round((base+(seed%900)-320)/10)*10;
    output.push({ id:`${dateIso}-${routeIdentity(route)}`, date:dateIso, route, price, duration:route.duration, baggage:'以出票规则为准', source: route.scheduleMode==='verified'?'已核班期 · 演示票价':'演示班期 · 演示票价' });
  }));
  return output;
}

function money(v){return `¥${Number(v).toLocaleString('zh-CN')}`;}
function formatDate(s){const d=new Date(s+'T12:00:00');return `${d.getMonth()+1}月${d.getDate()}日`;}
function weekday(s){return ['周日','周一','周二','周三','周四','周五','周六'][new Date(s+'T12:00:00').getDay()];}
function durationText(m){return `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;}

function renderWinner(list){
  if(!list.length){winnerCard.innerHTML='<div class="empty">这个时间段没有可显示的航班结果，请扩大日期范围或增加出发地。</div>';return;}
  const best=[...list].sort((a,b)=>a.price-b.price)[0], r=best.route;
  winnerCard.innerHTML=`<div class="winner-grid"><div><span class="winner-badge">🏆 当前最低价 · 演示票价</span><h3>${formatDate(best.date)} · ${r.city} → ${r.destCity}</h3><div class="winner-meta">${r.airline}${r.flightNumber?' · '+r.flightNumber:''} · 直飞 · 约 ${durationText(best.duration)} · ${weekday(best.date)}</div></div><div class="winner-price"><strong>${money(best.price)}</strong><small>v${APP_VERSION} · ${best.source}</small></div></div>`;
}

function renderCalendar(list){
  if(!list.length){calendarList.innerHTML='<div class="empty">暂无结果</div>';return;}
  const cheapest=Math.min(...list.map(f=>f.price));
  const byDate=Object.values(list.reduce((a,f)=>{if(!a[f.date]||f.price<a[f.date].price)a[f.date]=f;return a;},{})).sort((a,b)=>a.date.localeCompare(b.date));
  calendarList.innerHTML=byDate.map(f=>`<div class="calendar-row ${f.price===cheapest?'best':''}"><div class="calendar-date"><strong>${formatDate(f.date)}</strong><small>${weekday(f.date)}</small></div><div class="calendar-route">${f.route.city} → ${f.route.destCity}<br>${f.route.airlineShort}${f.route.flightNumber?' · '+f.route.flightNumber:''}</div><div class="calendar-price ${f.price===cheapest?'best':''}">${money(f.price)}</div></div>`).join('');
}

function sortedResults(){const d=[...currentResults]; if(sortSelect.value==='date')d.sort((a,b)=>a.date.localeCompare(b.date)||a.price-b.price); else if(sortSelect.value==='duration')d.sort((a,b)=>a.duration-b.duration||a.price-b.price); else d.sort((a,b)=>a.price-b.price||a.date.localeCompare(b.date)); return d;}
function renderFlights(){
  const list=sortedResults(); resultCount.textContent=`${list.length} 个方案`;
  if(!list.length){flightList.innerHTML='<div class="empty">暂无结果</div>';renderWinner(list);renderCalendar(list);return;}
  const cheapest=Math.min(...list.map(f=>f.price));
  flightList.innerHTML=list.map(f=>`<article class="flight-card"><div class="flight-main"><div class="airline"><div class="airline-logo">${f.route.airlineShort==='国航'?'🇨🇳':'🇧🇾'}</div><div><strong>${f.route.airline}${f.route.flightNumber?' · '+f.route.flightNumber:''}</strong><small>${formatDate(f.date)} · ${weekday(f.date)}</small></div></div><div class="route-block"><strong>${f.route.city} ${f.route.code} → ${f.route.destCity} ${f.route.dest}</strong><small>直飞 · 约 ${durationText(f.duration)}</small></div><div class="price-block"><strong>${money(f.price)}</strong><small>演示票价</small></div></div><div class="flight-tags">${f.price===cheapest?'<span class="tag best">🏆 区间最低</span>':''}<span class="tag">直飞</span>${f.route.scheduleMode==='verified'?'<span class="tag best">班期已核验：周一</span>':'<span class="tag">班期待核验</span>'}<span class="tag">${f.source}</span></div></article>`).join('');
  renderWinner(list); renderCalendar(list);
}

function runSearch(){
  const start=startDate.value,end=endDate.value,selected=[...originOptions.querySelectorAll('input:checked')].map(i=>i.value);
  if(!start||!end)return alert('请选择完整的出发时间范围。');
  if(start>end)return alert('最晚出发日期不能早于最早出发日期。');
  if(daysBetween(start,end).length>62)return alert('v1.0.1 单次最多比较 62 天，请缩短时间范围。');
  if(!selected.length)return alert('请至少选择一个直飞出发地。');
  currentResults=buildFlights(start,end,selected); $('resultTitle').textContent=`${formatDate(start)} — ${formatDate(end)} 的直飞比价`; results.classList.remove('hidden'); renderFlights(); results.scrollIntoView({behavior:'smooth',block:'start'});
}

$('searchButton').addEventListener('click',runSearch); sortSelect.addEventListener('change',renderFlights);
$('toggleAll').addEventListener('click',()=>{const boxes=[...originOptions.querySelectorAll('input')],check=boxes.some(b=>!b.checked);boxes.forEach(b=>b.checked=check);$('toggleAll').textContent=check?'取消全选':'全选';});
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');currentDirection=tab.dataset.direction;renderOriginOptions();results.classList.add('hidden');}));
startDate.addEventListener('change',()=>{endDate.min=startDate.value;if(endDate.value<startDate.value)endDate.value=startDate.value;});
