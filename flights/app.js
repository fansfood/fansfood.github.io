const APP_VERSION = '1.0.0';

const routes = {
  'to-minsk': [
    { code: 'PEK', city: '北京', dest: 'MSQ', destCity: '明斯克', airline: '中国国际航空', airlineShort: '国航' },
    { code: 'XIY', city: '西安', dest: 'MSQ', destCity: '明斯克', airline: '中国国际航空', airlineShort: '国航' },
    { code: 'URC', city: '乌鲁木齐', dest: 'MSQ', destCity: '明斯克', airline: '白俄罗斯航空', airlineShort: '白航' },
    { code: 'SYX', city: '三亚', dest: 'MSQ', destCity: '明斯克', airline: '白俄罗斯航空', airlineShort: '白航' },
  ],
  'from-minsk': [
    { code: 'MSQ', city: '明斯克', dest: 'PEK', destCity: '北京', airline: '中国国际航空', airlineShort: '国航', key: 'PEK' },
    { code: 'MSQ', city: '明斯克', dest: 'XIY', destCity: '西安', airline: '中国国际航空', airlineShort: '国航', key: 'XIY' },
    { code: 'MSQ', city: '明斯克', dest: 'URC', destCity: '乌鲁木齐', airline: '白俄罗斯航空', airlineShort: '白航', key: 'URC' },
    { code: 'MSQ', city: '明斯克', dest: 'SYX', destCity: '三亚', airline: '白俄罗斯航空', airlineShort: '白航', key: 'SYX' },
  ]
};

let currentDirection = 'to-minsk';
let currentResults = [];

const $ = (id) => document.getElementById(id);
const startDate = $('startDate');
const endDate = $('endDate');
const originOptions = $('originOptions');
const results = $('results');
const flightList = $('flightList');
const calendarList = $('calendarList');
const winnerCard = $('winnerCard');
const resultCount = $('resultCount');
const sortSelect = $('sortSelect');

function isoDate(d) {
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

const today = new Date();
const inSevenDays = new Date(today); inSevenDays.setDate(today.getDate() + 7);
const inTwentyDays = new Date(today); inTwentyDays.setDate(today.getDate() + 20);
startDate.value = isoDate(inSevenDays);
endDate.value = isoDate(inTwentyDays);
startDate.min = isoDate(today);
endDate.min = isoDate(today);

function routeIdentity(route) { return route.key || route.code; }

function renderOriginOptions() {
  originOptions.innerHTML = routes[currentDirection].map((r) => `
    <label class="origin-chip">
      <input type="checkbox" value="${routeIdentity(r)}" checked />
      <span>
        <strong>${currentDirection === 'to-minsk' ? r.city : r.destCity}</strong>
        <small>${currentDirection === 'to-minsk' ? r.code : r.dest} · ${r.airlineShort}</small>
      </span>
    </label>
  `).join('');
}
renderOriginOptions();

function daysBetween(start, end) {
  const out = [];
  let cursor = new Date(start + 'T12:00:00');
  const stop = new Date(end + 'T12:00:00');
  while (cursor <= stop) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function hashNumber(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function buildDemoFlights(start, end, selectedKeys) {
  const dates = daysBetween(start, end);
  const routeSet = routes[currentDirection].filter((r) => selectedKeys.includes(routeIdentity(r)));
  const output = [];

  routeSet.forEach((route, routeIndex) => {
    dates.forEach((date) => {
      const dateIso = isoDate(date);
      const seed = hashNumber(`${dateIso}-${routeIdentity(route)}-${currentDirection}`);
      const weekday = date.getDay();

      // 演示班期：只用于验证时间段搜索与比价体验，不代表真实航班时刻。
      const flyPattern = route.airlineShort === '国航'
        ? ((weekday + routeIndex) % 3 === 0)
        : ((weekday + routeIndex) % 4 === 1);
      if (!flyPattern) return;

      const base = { PEK: 4200, XIY: 3900, URC: 3500, SYX: 4100 }[routeIdentity(route)] || 4000;
      const price = Math.round((base + (seed % 900) - 320) / 10) * 10;
      const durationMap = { PEK: 610, XIY: 565, URC: 410, SYX: 690 };
      const duration = durationMap[routeIdentity(route)] || 600;

      output.push({
        id: `${dateIso}-${routeIdentity(route)}`,
        date: dateIso,
        route,
        price,
        duration,
        baggage: route.airlineShort === '国航' ? '以出票规则为准' : '以出票规则为准',
        source: '演示数据',
      });
    });
  });
  return output;
}

function money(value) { return `¥${Number(value).toLocaleString('zh-CN')}`; }
function formatDate(dateIso) {
  const d = new Date(dateIso + 'T12:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function weekday(dateIso) {
  return ['周日','周一','周二','周三','周四','周五','周六'][new Date(dateIso + 'T12:00:00').getDay()];
}
function durationText(min) {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2,'0')}m`;
}

function renderWinner(sorted) {
  if (!sorted.length) {
    winnerCard.innerHTML = '<div class="empty">这个时间段没有演示航班结果，请扩大日期范围或增加出发地。</div>';
    return;
  }
  const best = [...sorted].sort((a,b) => a.price - b.price)[0];
  const cityA = best.route.city;
  const cityB = best.route.destCity;
  winnerCard.innerHTML = `
    <div class="winner-grid">
      <div>
        <span class="winner-badge">🏆 当前最低价 · 演示</span>
        <h3>${formatDate(best.date)} · ${cityA} → ${cityB}</h3>
        <div class="winner-meta">${best.route.airline} · 直飞 · 约 ${durationText(best.duration)} · ${weekday(best.date)}</div>
      </div>
      <div class="winner-price">
        <strong>${money(best.price)}</strong>
        <small>当前为 v${APP_VERSION} 演示票价</small>
      </div>
    </div>
  `;
}

function renderCalendar(list) {
  if (!list.length) {
    calendarList.innerHTML = '<div class="empty">暂无结果</div>';
    return;
  }
  const cheapest = Math.min(...list.map(f => f.price));
  const byDate = Object.values(list.reduce((acc, f) => {
    if (!acc[f.date] || f.price < acc[f.date].price) acc[f.date] = f;
    return acc;
  }, {})).sort((a,b) => a.date.localeCompare(b.date));

  calendarList.innerHTML = byDate.map(f => {
    const best = f.price === cheapest;
    return `
      <div class="calendar-row ${best ? 'best' : ''}">
        <div class="calendar-date"><strong>${formatDate(f.date)}</strong><small>${weekday(f.date)}</small></div>
        <div class="calendar-route">${f.route.city} → ${f.route.destCity}<br>${f.route.airlineShort}</div>
        <div class="calendar-price ${best ? 'best' : ''}">${money(f.price)}</div>
      </div>
    `;
  }).join('');
}

function sortedResults() {
  const data = [...currentResults];
  if (sortSelect.value === 'date') data.sort((a,b) => a.date.localeCompare(b.date) || a.price - b.price);
  else if (sortSelect.value === 'duration') data.sort((a,b) => a.duration - b.duration || a.price - b.price);
  else data.sort((a,b) => a.price - b.price || a.date.localeCompare(b.date));
  return data;
}

function renderFlights() {
  const list = sortedResults();
  resultCount.textContent = `${list.length} 个方案`;
  if (!list.length) {
    flightList.innerHTML = '<div class="empty">暂无结果</div>';
    renderWinner(list);
    renderCalendar(list);
    return;
  }
  const cheapest = Math.min(...list.map(f => f.price));
  flightList.innerHTML = list.map(f => `
    <article class="flight-card">
      <div class="flight-main">
        <div class="airline">
          <div class="airline-logo">${f.route.airlineShort === '国航' ? '🇨🇳' : '🇧🇾'}</div>
          <div><strong>${f.route.airline}</strong><small>${formatDate(f.date)} · ${weekday(f.date)}</small></div>
        </div>
        <div class="route-block">
          <strong>${f.route.city} ${f.route.code} → ${f.route.destCity} ${f.route.dest}</strong>
          <small>直飞 · 约 ${durationText(f.duration)}</small>
        </div>
        <div class="price-block"><strong>${money(f.price)}</strong><small>演示票价</small></div>
      </div>
      <div class="flight-tags">
        ${f.price === cheapest ? '<span class="tag best">🏆 区间最低</span>' : ''}
        <span class="tag">直飞</span>
        <span class="tag">行李：${f.baggage}</span>
        <span class="tag">${f.source}</span>
      </div>
    </article>
  `).join('');
  renderWinner(list);
  renderCalendar(list);
}

function runSearch() {
  const start = startDate.value;
  const end = endDate.value;
  const selected = [...originOptions.querySelectorAll('input:checked')].map(i => i.value);
  if (!start || !end) return alert('请选择完整的出发时间范围。');
  if (start > end) return alert('最晚出发日期不能早于最早出发日期。');
  const days = daysBetween(start, end).length;
  if (days > 62) return alert('v1.0.0 单次最多比较 62 天，请缩短时间范围。');
  if (!selected.length) return alert('请至少选择一个直飞出发地。');

  currentResults = buildDemoFlights(start, end, selected);
  $('resultTitle').textContent = `${formatDate(start)} — ${formatDate(end)} 的直飞比价`;
  results.classList.remove('hidden');
  renderFlights();
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('searchButton').addEventListener('click', runSearch);
sortSelect.addEventListener('change', renderFlights);
$('toggleAll').addEventListener('click', () => {
  const boxes = [...originOptions.querySelectorAll('input')];
  const shouldCheck = boxes.some(b => !b.checked);
  boxes.forEach(b => b.checked = shouldCheck);
  $('toggleAll').textContent = shouldCheck ? '取消全选' : '全选';
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentDirection = tab.dataset.direction;
    renderOriginOptions();
    results.classList.add('hidden');
  });
});

startDate.addEventListener('change', () => {
  endDate.min = startDate.value;
  if (endDate.value < startDate.value) endDate.value = startDate.value;
});
