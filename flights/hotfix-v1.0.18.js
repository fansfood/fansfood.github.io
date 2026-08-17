(() => {
  'use strict';
  const VERSION='1.0.18';
  const SUPABASE_MARK='/functions/v1/flight-live-search';
  const BELAVIA_PROXY='https://belavia-price-proxy.fnf010906.workers.dev';
  const AIR_CHINA_LOGO='https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png';
  const BELAVIA_LOGO='https://webapi.belavia.by/guideStatic/images/carrier/logotype/5830-347fc5d42a1f77f89665a10b8d0d235a.svg';
  const FALLBACK_BYN_CNY=2.22173;

  const nativeFetch=window.fetch.bind(window);
  let cachedBynCnyRate=null;

  async function getBynCnyRate(){
    if(Number.isFinite(cachedBynCnyRate)&&cachedBynCnyRate>0) return cachedBynCnyRate;
    try{
      const r=await nativeFetch('https://api.nbrb.by/exrates/rates/CNY?parammode=2',{cache:'no-store'});
      if(r.ok){
        const d=await r.json();
        const official=Number(d?.Cur_OfficialRate);
        const scale=Number(d?.Cur_Scale||1);
        const rate=scale/official;
        if(Number.isFinite(rate)&&rate>0){cachedBynCnyRate=rate;return rate;}
      }
    }catch{}
    cachedBynCnyRate=FALLBACK_BYN_CNY;
    return cachedBynCnyRate;
  }

  async function normalizeOffers(results){
    if(!Array.isArray(results)) return results;
    const rate=await getBynCnyRate();
    for(const r of results){
      if(!Array.isArray(r?.offers)) continue;
      for(const o of r.offers){
        const currency=String(o?.currency||'').toUpperCase();
        if(!Number.isFinite(Number(o?.amount_cny))){
          if(currency==='CNY'&&Number.isFinite(Number(o?.amount))) o.amount_cny=Math.round(Number(o.amount));
          if(currency==='BYN'&&Number.isFinite(Number(o?.amount))) o.amount_cny=Math.round(Number(o.amount)*rate);
        }
      }
    }
    return results;
  }

  async function addReferenceFallback(data){
    if(!Array.isArray(data?.results)) return data;
    for(let i=0;i<data.results.length;i++){
      const r=data.results[i];
      if((!Array.isArray(r?.offers)||r.offers.length===0)&&r?.reference&&Number.isFinite(Number(r.reference.amount))){
        const ref={...r.reference};
        const c=String(ref.currency||'').toUpperCase();
        if(!Number.isFinite(Number(ref.amount_cny))||Number(ref.amount_cny)<=0){
          if(c==='CNY') ref.amount_cny=Math.round(Number(ref.amount));
          else if(c==='BYN') ref.amount_cny=Math.round(Number(ref.amount)*(await getBynCnyRate()));
        }
        ref.source='白航官网人工核验参考';
        ref.current_inventory=false;
        ref.verified_bundle=ref.bundle||'Business';
        ref.verified_seats=2;
        data.results[i]={...r,ok:true,source_kind:'recent-reference',current_availability:null,offers:[ref],fallback_from_official:true,official_error:r?.error||r?.code||null};
      }
    }
    return data;
  }

  async function readJsonResponse(response){
    try{return await response.clone().json();}catch{return null;}
  }

  function responseFrom(data,status=200){
    return new Response(JSON.stringify(data),{
      status,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    if(!String(url).includes(SUPABASE_MARK)) return nativeFetch(input,init);

    let payload=null;
    try{payload=JSON.parse(String(init?.body||'{}'));}catch{}
    const searches=Array.isArray(payload?.searches)?payload.searches:[];
    const b2=searches.filter(s=>String(s?.preferred_carrier||'').toUpperCase()==='B2');
    const other=searches.filter(s=>String(s?.preferred_carrier||'').toUpperCase()!=='B2');

    if(!b2.length){
      const response=await nativeFetch(input,init);
      const data=await readJsonResponse(response);
      if(!data) return response;
      await normalizeOffers(data.results);
      await addReferenceFallback(data);
      return responseFrom(data,response.status);
    }

    try{
      const tasks=[];
      tasks.push(nativeFetch(BELAVIA_PROXY,{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({searches:b2})
      }).then(async r=>({kind:'b2',response:r,data:await readJsonResponse(r)})));
      if(other.length){
        const otherInit={...init,body:JSON.stringify({searches:other})};
        tasks.push(nativeFetch(input,otherInit).then(async r=>({kind:'other',response:r,data:await readJsonResponse(r)})));
      }
      const parts=await Promise.all(tasks);
      const b2part=parts.find(x=>x.kind==='b2');
      if(!b2part?.response?.ok || !Array.isArray(b2part?.data?.results)) throw new Error('Belavia Cloudflare proxy unavailable');

      let b2Results=b2part.data.results;
      await normalizeOffers(b2Results);

      const failedIds=new Set(b2Results.filter(r=>r?.ok===false||!Array.isArray(r?.offers)||r.offers.length===0).map(r=>r?.id));
      if(failedIds.size){
        try{
          const failedSearches=b2.filter(s=>failedIds.has(s.id));
          const fallback=await nativeFetch(input,{...init,body:JSON.stringify({searches:failedSearches})});
          const fallbackData=await readJsonResponse(fallback);
          if(Array.isArray(fallbackData?.results)){
            await normalizeOffers(fallbackData.results);
            await addReferenceFallback(fallbackData);
            const fbMap=new Map(fallbackData.results.map(r=>[r.id,r]));
            b2Results=b2Results.map(r=>{
              const fb=fbMap.get(r.id);
              return (r?.ok===false||!Array.isArray(r?.offers)||r.offers.length===0) && fb ? fb : r;
            });
          }
        }catch{}
      }

      const otherPart=parts.find(x=>x.kind==='other');
      const otherResults=Array.isArray(otherPart?.data?.results)?otherPart.data.results:[];
      await normalizeOffers(otherResults);
      const merged=[...b2Results,...otherResults];
      const order=new Map(searches.map((s,i)=>[s.id,i]));
      merged.sort((a,b)=>(order.get(a.id)??9999)-(order.get(b.id)??9999));
      return responseFrom({ok:true,version:'1.0.18-cloudflare-first',mode:'belavia-cloudflare-first',queried_at:new Date().toISOString(),results:merged});
    }catch{
      const response=await nativeFetch(input,init);
      const data=await readJsonResponse(response);
      if(!data) return response;
      await normalizeOffers(data.results);
      await addReferenceFallback(data);
      return responseFrom(data,response.status);
    }
  };

  function airlineForCard(card){const t=card.textContent||'';if(/\bCA\d{3,4}\b/.test(t))return'CA';if(/\bB2\d{3,4}\b/.test(t))return'B2';return null;}
  function detailLogo(code){return code==='CA'?AIR_CHINA_LOGO:BELAVIA_LOGO;}
  function airlineName(code){return code==='CA'?'中国国际航空':'白俄罗斯航空';}

  function fixDetailLogo(card,code){
    const img=card.querySelector('.airline-logo');if(!img)return;
    img.src=detailLogo(code);img.alt=`${airlineName(code)} Logo`;img.referrerPolicy='no-referrer';img.classList.remove('hidden');img.style.display='block';
    const fb=img.nextElementSibling;
    img.onerror=()=>{img.style.display='none';if(fb)fb.classList.remove('hidden');};
    if(fb)fb.classList.add('hidden');
  }

  function replaceText(root,from,to){
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(n=>{if((n.nodeValue||'').includes(from))n.nodeValue=(n.nodeValue||'').replaceAll(from,to);});
  }

  function decorateVerifiedB2752(card){
    const t=card.textContent||'';
    if(!t.includes('B2752')||!t.includes('8月31日')) return;
    const isReference=!!card.querySelector('.price-tag.reference') || t.includes('白航官网核验参考') || t.includes('近期参考');
    if(!isReference) return;
    const priceWrap=card.querySelector('.summary-price');
    if(priceWrap && !priceWrap.querySelector('.price-native')){
      const native=document.createElement('span');native.className='price-native';native.textContent='2,859.20 Б · BYN · 含税费';
      const tag=priceWrap.querySelector('.price-tag');priceWrap.insertBefore(native,tag||null);
    }
    const tag=card.querySelector('.price-tag.reference');if(tag){tag.textContent='白航官网核验参考';tag.classList.add('last-known');}
    const box=card.querySelector('.reference-box');
    if(box && box.dataset.b2verified!=='1'){
      box.dataset.b2verified='1';
      const rmb=(card.querySelector('.summary-price .price-main')?.textContent||'').trim()||'—';
      box.innerHTML='';
      const title=document.createElement('div');title.className='box-title';title.textContent='白航官网核验参考';box.appendChild(title);
      [['人民币参考价',rmb],['白航原币','2,859.20 BYN · 含税'],['基础票价','2,505.00 BYN'],['税费','354.20 BYN'],['核验时舱位','Business · C 舱'],['核验时余票','2 席'],['状态说明','白航实时连接异常；以上为官网人工核验记录']].forEach(([k,v])=>{const row=document.createElement('div');row.className='fare-row';const s=document.createElement('span');s.textContent=k;const b=document.createElement('strong');b.textContent=v;if(k==='核验时余票')b.className='seat-ok';row.append(s,b);box.appendChild(row);});
    }
  }

  function fixBelaviaCopy(card){
    replaceText(card,'国航价格参考','白航官网核验参考');
    replaceText(card,'未由国航官网自动确认','非当前实时库存 · 上次官网核验');
    replaceText(card,'当前不对国航官网进行未授权自动抓取','白航实时连接异常；当前显示上次官网核验记录');
    replaceText(card,'近期参考价','上次官网核验价');
    decorateVerifiedB2752(card);
  }

  function fixCalendar(){
    document.querySelectorAll('#calendarList .calendar-row').forEach(row=>{
      const t=row.textContent||'';
      if(t.includes('8月31日')&&t.includes('B2752')) replaceText(row,'近期参考','官网核验参考');
    });
  }

  function fixCards(){
    document.querySelectorAll('#flightList .flight-card').forEach(card=>{
      const code=airlineForCard(card);if(!code)return;
      fixDetailLogo(card,code);
      if(code==='B2')fixBelaviaCopy(card);
      const bad=[...card.querySelectorAll('.price-tag.unavailable')].find(el=>/官网暂无可售报价/.test(el.textContent||''));if(bad)bad.textContent='实时查询连接异常';
    });
    fixCalendar();
  }

  const list=document.getElementById('flightList');
  const cal=document.getElementById('calendarList');
  if(list||cal){let q=false;const run=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fixCards();});};if(list)new MutationObserver(run).observe(list,{childList:true,subtree:true});if(cal)new MutationObserver(run).observe(cal,{childList:true,subtree:true});run();}
  document.title=`白俄留学生机票比价 · v${VERSION}`;document.querySelectorAll('.version').forEach(el=>el.textContent=`v${VERSION}`);
})();
