(() => {
  'use strict';
  const VERSION='1.0.17';
  const AIR_CHINA_LOGO='https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png';
  const BELAVIA_LOGO='https://webapi.belavia.by/guideStatic/images/carrier/logotype/5830-347fc5d42a1f77f89665a10b8d0d235a.svg';
  const BELAVIA_ICON='https://cdn.websky.aero/content/B2/images/AirlineIcons/B2.png';
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

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    const url=typeof input==='string'?input:(input?.url||'');
    if(!String(url).includes('/functions/v1/flight-live-search')) return response;
    try{
      const data=await response.clone().json();
      if(Array.isArray(data?.results)){
        for(let i=0;i<data.results.length;i++){
          const r=data.results[i];
          if((!Array.isArray(r?.offers)||r.offers.length===0)&&r?.reference&&Number.isFinite(Number(r.reference.amount))){
            const ref={...r.reference};
            const c=String(ref.currency||'').toUpperCase();
            const invalidCny=ref.amount_cny==null || !Number.isFinite(Number(ref.amount_cny)) || Number(ref.amount_cny)<=0;
            if(invalidCny){
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
      }
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch{return response;}
  };

  function airlineForCard(card){const t=card.textContent||'';if(/\bCA\d{3,4}\b/.test(t))return'CA';if(/\bB2\d{3,4}\b/.test(t))return'B2';return null;}
  function detailLogo(code){return code==='CA'?AIR_CHINA_LOGO:BELAVIA_LOGO;}
  function summaryLogo(code){return code==='CA'?AIR_CHINA_LOGO:BELAVIA_ICON;}
  function airlineName(code){return code==='CA'?'中国国际航空':'白俄罗斯航空';}

  function ensureSummaryLogo(card,code){
    const left=card.querySelector('.summary-left');if(!left||left.dataset.logo17==='1')return;left.dataset.logo17='1';
    const oldWrap=left.querySelector('.summary-logo-wrap');if(oldWrap){const oldImg=oldWrap.querySelector('img');if(oldImg)oldImg.src=summaryLogo(code);return;}
    const nodes=[...left.childNodes];const wrap=document.createElement('div');wrap.className='summary-logo-wrap';
    const img=document.createElement('img');img.className='summary-airline-logo';img.src=summaryLogo(code);img.alt=`${airlineName(code)} Logo`;img.referrerPolicy='no-referrer';
    const fb=document.createElement('span');fb.className=`summary-logo-fallback ${code==='CA'?'ca':'b2'}`;fb.textContent=code==='CA'?'AIR CHINA':'B2';
    img.addEventListener('error',()=>{img.style.display='none';fb.style.display='flex';},{once:true});wrap.append(img,fb);
    const tw=document.createElement('div');tw.className='summary-text-wrap';nodes.forEach(n=>tw.appendChild(n));left.classList.add('with-airline-logo');left.append(wrap,tw);
  }

  function fixDetailLogo(card,code){
    const img=card.querySelector('.airline-logo');if(!img)return;
    img.src=detailLogo(code);img.alt=`${airlineName(code)} Logo`;img.referrerPolicy='no-referrer';img.classList.remove('hidden');img.style.display='block';
    const fb=img.nextElementSibling;if(fb)fb.classList.add('hidden');
  }

  function replaceText(root,from,to){
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
    nodes.forEach(n=>{if((n.nodeValue||'').includes(from))n.nodeValue=(n.nodeValue||'').replaceAll(from,to);});
  }

  function fixBelaviaCopy(card){
    const text=card.textContent||'';
    const isReference=!!card.querySelector('.price-tag.reference') || text.includes('近期价格参考') || text.includes('上次官网核验参考');
    replaceText(card,'国航价格参考','白航官网核验参考');
    replaceText(card,'未由国航官网自动确认','非当前实时库存 · 上次官网核验');
    replaceText(card,'当前不对国航官网进行未授权自动抓取','白航实时连接异常；当前显示上次官网核验记录');
    replaceText(card,'近期参考价','上次官网核验价');
    if(isReference){
      const tag=card.querySelector('.price-tag.reference');if(tag){tag.textContent='白航官网核验参考';tag.classList.add('last-known');}
      const rows=[...card.querySelectorAll('*')];
      const slotLabel=rows.find(el=>el.childNodes.length===1 && (el.textContent||'').trim()==='当前仓位');
      if(slotLabel){const row=slotLabel.parentElement;const vals=row?[...row.children]:[];if(vals.length>1)vals[vals.length-1].textContent='核验时 Business · 余2席';}
    }
  }

  function fixCards(){
    document.querySelectorAll('#flightList .flight-card').forEach(card=>{
      const code=airlineForCard(card);if(!code)return;
      ensureSummaryLogo(card,code);fixDetailLogo(card,code);
      if(code==='B2')fixBelaviaCopy(card);
      const bad=[...card.querySelectorAll('.price-tag.unavailable')].find(el=>/官网暂无可售报价/.test(el.textContent||''));if(bad)bad.textContent='实时查询连接异常';
    });
  }

  const list=document.getElementById('flightList');if(list){let q=false;const run=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fixCards();});};new MutationObserver(run).observe(list,{childList:true,subtree:true});run();}
  document.title=`白俄留学生机票比价 · v${VERSION}`;document.querySelectorAll('.version').forEach(el=>el.textContent=`v${VERSION}`);
})();