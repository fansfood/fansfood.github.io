(() => {
  const VERSION = '1.0.09';

  // Add the full CA813 through-flight: Beijing -> Xi'an -> Minsk.
  // Beijing searches now include both CA721 non-stop and CA813 via Xi'an.
  if (!ROUTES.PEK_CA813) {
    ROUTES.PEK_CA813 = {
      city: '北京',
      airport: '北京首都国际机场',
      code: 'PEK',
      searchGroup: 'PEK',
      airline: 'CA',
      via: {
        city: '西安', code: 'XIY', airport: '西安咸阳国际机场',
        outboundArrive: '12:20', outboundDepart: '14:20',
        inboundArrive: '09:55', inboundDepart: '11:55'
      },
      chinaToMinsk: {
        flightNumber: 'CA813', weekdays: [6], depart: '09:40', arrive: '18:25',
        arrivalOffset: 0, duration: 825, aircraft: 'Airbus A330',
        effectiveStart: '2026-04-04', effectiveEnd: '2026-10-24', terminal: '北京 T3',
        scheduleNote: '周六 · 经停西安'
      },
      minskToChina: {
        flightNumber: 'CA814', weekdays: [6], depart: '20:30', arrive: '14:15',
        arrivalOffset: 1, duration: 765, aircraft: 'Airbus A330',
        effectiveStart: '2026-04-04', effectiveEnd: '2026-10-24', terminal: '北京到达 T3',
        scheduleNote: '周六 · 经停西安'
      }
    };
  }

  const groupCode = route => route.searchGroup || route.code;

  // One Beijing checkbox controls both CA721 and CA813.
  renderOriginOptions = function() {
    const seen = new Set();
    const options = [];
    Object.values(ROUTES).forEach(route => {
      const group = groupCode(route);
      if (seen.has(group)) return;
      seen.add(group);
      const sameGroup = Object.values(ROUTES).filter(r => groupCode(r) === group);
      const flights = sameGroup.map(r => r[flowKey(currentDirection)].flightNumber).join(' / ');
      const label = group === 'PEK' && sameGroup.length > 1
        ? `${flights} · 含直飞与经西安`
        : `${flights} · ${AIRLINES[route.airline].short}`;
      options.push(`<label class="origin-chip"><input type="checkbox" value="${group}" checked><span><strong>${route.city}</strong><small>${label}</small></span></label>`);
    });
    originOptions.innerHTML = options.join('');
    $('toggleAll').textContent = '取消全选';
    $('cityFilterLabel').textContent = currentDirection === 'to-minsk' ? '比较哪些中国出发城市？' : '比较到达哪些中国城市？';
  };

  const oldCreateLeg = createLeg;
  createLeg = function(route, date, direction) {
    const leg = oldCreateLeg(route, date, direction);
    leg.id = `${direction}-${route.code}-${leg.flight.flightNumber}-${leg.date}`;
    leg.via = route.via || null;
    return leg;
  };

  buildLegs = function(direction, start, end, selectedCodes) {
    const flow = flowKey(direction), output = [];
    Object.values(ROUTES)
      .filter(r => selectedCodes.includes(groupCode(r)))
      .forEach(route => {
        daysBetween(start, end).forEach(date => {
          if (isOperating(route[flow], date)) output.push(createLeg(route, date, direction));
        });
      });
    return output;
  };

  // Never present generated demo fares as if they were real prices.
  function hasRealFare(quote) {
    if (!quote) return false;
    if (quote.availability === 'verified') return true;
    if (quote.live === true || quote.dataSource === 'live') return true;
    return !String(quote.source || '').includes('演示') && quote.availability !== 'unverified';
  }

  const priorPriceHtml = priceHtml;
  priceHtml = function(quote, compact = false) {
    if (!hasRealFare(quote)) {
      return `<span class="price-rmb-main">—</span>`;
    }
    return priorPriceHtml(quote, compact);
  };

  const oldSortedResults = sortedResults;
  sortedResults = function() {
    const list = oldSortedResults();
    return list.sort((a, b) => {
      const ar = hasRealFare(a.priceQuote), br = hasRealFare(b.priceQuote);
      if (ar !== br) return ar ? -1 : 1;
      return 0;
    });
  };

  function addViaInfo(card, item) {
    if (!item || tripType === 'roundtrip') return;
    if (item.flight?.flightNumber !== 'CA813' && item.flight?.flightNumber !== 'CA814') return;

    const head = card.querySelector('.itinerary-head');
    const meta = head?.firstElementChild?.querySelector('small');
    if (meta && !meta.textContent.includes('经西安')) meta.textContent += ' · 经西安';

    const legCard = card.querySelector(':scope > .leg-card');
    if (!legCard || legCard.querySelector('.via-stop-row')) return;
    const v = item.via;
    if (!v) return;
    const isOut = item.direction === 'to-minsk';
    const arrive = isOut ? v.outboundArrive : v.inboundArrive;
    const depart = isOut ? v.outboundDepart : v.inboundDepart;
    const row = document.createElement('div');
    row.className = 'via-stop-row';
    row.innerHTML = `<strong>经停 ${v.city} ${v.code}</strong><span>${arrive} 到达 · ${depart} 再起飞</span>`;
    const timeline = legCard.querySelector('.timeline');
    timeline?.insertAdjacentElement('afterend', row);
  }

  function cleanVisibleText(root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      if (!node.nodeValue) return;
      node.nodeValue = node.nodeValue
        .replaceAll('国航票面演示价', '国航票面价')
        .replaceAll('白航 BYN 演示价', '白航价格')
        .replaceAll('演示票价', '')
        .replaceAll('票态待实时核验', '')
        .replaceAll('非实时库存', '')
        .replaceAll('非实时', '');
    });
  }

  const priorRenderFlights = renderFlights;
  renderFlights = function() {
    priorRenderFlights();
    const list = sortedResults();
    [...document.querySelectorAll('#flightList .itinerary-card')].forEach((card, i) => addViaInfo(card, list[i]));
    cleanVisibleText(document.getElementById('flightList'));
  };

  renderOriginOptions();
  document.title = `白俄留学生机票比价 · v${VERSION}`;
  document.querySelectorAll('.version').forEach(el => { el.textContent = `v${VERSION}`; });
})();
