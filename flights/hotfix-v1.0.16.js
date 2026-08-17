(() => {
  'use strict';
  const VERSION='1.0.16';
  const AIR_CHINA_LOGO='https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png';
  const BELAVIA_LOGO='https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Belavia_logo.svg/960px-Belavia_logo.svg.png';
  const FALLBACK_BYN_CNY=2.248;

  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    const url=typeof input==='string'?input:(input?.url||'');
    if(!String(url).includes('/functions/v1/flight-live-search')) return response;
    try{
      const data=await response.clone().json();
      if(Array.isArray(data?.results)){
        data.results=data.results.map(r=>{
          if((!Array.isArray(r?.offers)||r.offers.length===0)&&r?.reference&&Number.isFinite(Number(r.reference.amount))){
            const ref={...r.reference};
            if(!Number.isFinite(Number(ref.amount_cny))){
              ref.amount_cny=String(ref.currency||'').toUpperCase()==='CNY'
                ? Number(ref.amount)
                : Math.round(Number(ref.amount)*FALLBACK_BYN_CNY);
            }
            ref.source=ref.source||'上次官网核验参考';
            ref.current_inventory=false;
            return {...r,ok:true,source_kind:'recent-reference',current_availability:null,offers:[ref],fallback_from_official:true,official_error:r?.error||r?.code||null};
          }
          return r;
        });
      }
      const headers=new Headers(response.headers);
      headers.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
    }catch{return response;}
  };

  function airlineForCard(card){const t=card.textContent||'';if(/\bCA\d{3,4}\b/.test(t))return'CA';if(/\bB2\d{3,4}\b/.test(t))return'B2';return null;}
  function logoUrl(c){return c==='CA'?AIR_CHINA_LOGO:BELAVIA_LOGO;}
  function airlineName(c){return c==='CA'?'中国国际航空':'白俄罗斯航空';}
  function ensureSummaryLogo(card,code){
    const left=card.querySelector('.summary-left');if(!left||left.dataset.logo16==='1')return;left.dataset.logo16='1';
    const nodes=[...left.childNodes];const wrap=document.createElement('div');wrap.className='summary-logo-wrap';
    const img=document.createElement('img');img.className='summary-airline-logo';img.src=logoUrl(code);img.alt=`${airlineName(code)} Logo`;img.referrerPolicy='no-referrer';
    const fb=document.createElement('span');fb.className=`summary-logo-fallback ${code==='CA'?'ca':'b2'}`;fb.textContent=code==='CA'?'AIR CHINA':'Belavia';
    img.addEventListener('error',()=>{img.style.display='none';fb.style.display='flex';},{once:true});wrap.append(img,fb);
    const tw=document.createElement('div');tw.className='summary-text-wrap';nodes.forEach(n=>tw.appendChild(n));left.classList.add('with-airline-logo');left.append(wrap,tw);
  }
  function fixDetailLogo(card,code){const img=card.querySelector('.airline-logo');if(!img)return;img.src=logoUrl(code);img.alt=`${airlineName(code)} Logo`;img.referrerPolicy='no-referrer';img.classList.remove('hidden');img.style.display='block';const fb=img.nextElementSibling;if(fb)fb.classList.add('hidden');}
  function relabel(card){
    const tag=card.querySelector('.price-tag.reference');if(tag){const t=card.textContent||'';if(t.includes('B2752')&&t.includes('8月31日')){tag.textContent='上次官网核验参考';tag.classList.add('last-known');}}
    const bad=[...card.querySelectorAll('.price-tag.unavailable')].find(el=>/官网暂无可售报价/.test(el.textContent||''));if(bad)bad.textContent='实时查询连接异常';
  }
  function fixCards(){document.querySelectorAll('#flightList .flight-card').forEach(card=>{const c=airlineForCard(card);if(!c)return;ensureSummaryLogo(card,c);fixDetailLogo(card,c);relabel(card);});}
  const list=document.getElementById('flightList');if(list){let q=false;const run=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fixCards();});};new MutationObserver(run).observe(list,{childList:true,subtree:true});run();}
  document.title=`白俄留学生机票比价 · v${VERSION}`;document.querySelectorAll('.version').forEach(el=>el.textContent=`v${VERSION}`);
})();