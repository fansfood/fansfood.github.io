const ALLOWED_ORIGINS = new Set([
  'https://fansfood.github.io',
  'https://fansfood.github.io/'
]);
const BELAVIA_GQL = 'https://webapi.belavia.by/graphql/query/nemo';
const BELAVIA_ORIGIN = 'https://en.belavia.by';
const RUN_SEARCH = `mutation RunSearch($params: AviaSearchParameters!) { RunGeneralSearch(parameters: $params) { id __typename } }`;
const SEARCH_RESULTS = `query SearchResults($id: ID!) { SearchResult(id: $id) { searchParameters { currency segments { date departure { iata name } arrival { iata name } } passengers { passengerType count } } flightDirections { legs { segments { segment { id flightNumber lowestPriceClassSeatsLeft departure { date time terminal airport { name iata } } arrival { date time terminal airport { name iata } } } } pricesForFareGroups { fareFamily { id title category airline { name iata icon logo { fullUrl } } options { type availability title description shortDescription value size isKeyOption } } prices { price { amount currency } flight { id fares { id passengerFares { priceClasses { classCode } } } } } } } } fares { id passengerFares { count passengerType totalTaxes { amount currency } baseFare { amount currency } totalFare { amount currency } } } } }`;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://fansfood.github.io',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  };
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function norm(v){ return String(v||'').toUpperCase().replace(/\s+/g,'').replace(/^B2/,''); }
function getCookie(setCookie){
  if(!setCookie) return '';
  return setCookie.split(/,(?=[^;,]+=)/g).map(x=>x.split(';')[0].trim()).filter(Boolean).join('; ');
}
async function gql(body, token='', cookie='nemo_lang=en; ccCurrency=BYN'){
  const headers = {
    'accept':'application/json, text/plain, */*',
    'content-type':'application/json',
    'origin':BELAVIA_ORIGIN,
    'referer':BELAVIA_ORIGIN + '/booking/',
    'accept-language':'en-US,en;q=0.9',
    'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
    'cookie':cookie
  };
  if(token){ headers['x-token']=token; headers['authorization']='Bearer '+token; }
  const res = await fetch(BELAVIA_GQL,{method:'POST',headers,body:JSON.stringify(body)});
  const text = await res.text();
  let data={}; try{ data=JSON.parse(text); }catch{ data={raw:text.slice(0,500)}; }
  return {
    ok:res.ok,
    status:res.status,
    data,
    token:res.headers.get('x-token') || token,
    cookie:[cookie,getCookie(res.headers.get('set-cookie')||'')].filter(Boolean).join('; ')
  };
}
function params(item){
  return {
    segments:[{departure:{iata:item.origin},arrival:{iata:item.destination},date:item.departure_date}],
    passengers:[{passengerType:'ADT',count:1},{passengerType:'CLD',count:0},{passengerType:'INF',count:0}],
    promotionCode:null,
    currency:'BYN',
    ffpMode:false
  };
}
async function runOne(item){
  const created = await gql({operationName:'RunSearch',query:RUN_SEARCH,variables:{params:params(item)}});
  const searchId = created.data?.data?.RunGeneralSearch?.id;
  if(!created.ok || !searchId){
    return {id:item.id,ok:false,code:'run_search_failed',status:created.status,errors:created.data?.errors||[]};
  }
  let token=created.token, cookie=created.cookie, sr=null;
  for(let i=0;i<12;i++){
    if(i) await sleep(500);
    const rr = await gql({operationName:'SearchResults',query:SEARCH_RESULTS,variables:{id:String(searchId)}},token,cookie);
    token=rr.token; cookie=rr.cookie;
    sr=rr.data?.data?.SearchResult||null;
    const legs=(sr?.flightDirections||[]).flatMap(d=>Array.isArray(d?.legs)?d.legs:[]);
    if(legs.length) break;
  }
  if(!sr) return {id:item.id,ok:false,code:'search_results_missing'};

  const wanted=norm(item.preferred_flight_number);
  const fareMap=new Map((sr.fares||[]).map(f=>[String(f.id),f]));
  const offers=[];
  for(const d of sr.flightDirections||[]){
    for(const leg of d.legs||[]){
      const segs=(leg.segments||[]).map(x=>x?.segment).filter(Boolean);
      if(!segs.length) continue;
      const first=segs[0], last=segs[segs.length-1];
      if(first?.departure?.airport?.iata!==item.origin || last?.arrival?.airport?.iata!==item.destination) continue;
      if(item.direct!==false && segs.length!==1) continue;
      if(wanted && !segs.some(s=>norm(s?.flightNumber)===wanted)) continue;
      const seats=Number.isFinite(Number(first?.lowestPriceClassSeatsLeft))?Number(first.lowestPriceClassSeatsLeft):null;
      for(const group of leg.pricesForFareGroups||[]){
        const fam=group?.fareFamily||{};
        for(const p of group?.prices||[]){
          const amount=Number(p?.price?.amount);
          if(!Number.isFinite(amount)) continue;
          const fareId=p?.flight?.fares?.[0]?.id;
          const fare=fareMap.get(String(fareId));
          const pf=fare?.passengerFares?.find(x=>x?.passengerType==='ADT')||fare?.passengerFares?.[0]||{};
          const cls=p?.flight?.fares?.[0]?.passengerFares?.[0]?.priceClasses?.[0]?.classCode||null;
          offers.push({
            amount,
            currency:p?.price?.currency||sr?.searchParameters?.currency||'BYN',
            bundle:fam?.title||null,
            service_class:fam?.title||fam?.category||null,
            booking_class:cls,
            available_seats:seats,
            airline_name:fam?.airline?.name||'Belavia - Belarusian Airlines',
            airline_iata:fam?.airline?.iata||'B2',
            airline_icon:fam?.airline?.icon||null,
            airline_logo:fam?.airline?.logo?.fullUrl||null,
            baggage_options:Array.isArray(fam?.options)?fam.options:[],
            tax_detail:{
              base_amount:Number.isFinite(Number(pf?.baseFare?.amount))?Number(pf.baseFare.amount):null,
              taxes_amount:Number.isFinite(Number(pf?.totalTaxes?.amount))?Number(pf.totalTaxes.amount):null,
              total_fare_amount:Number.isFinite(Number(pf?.totalFare?.amount))?Number(pf.totalFare.amount):amount,
              currency:pf?.totalFare?.currency||p?.price?.currency||'BYN'
            },
            current_inventory:true
          });
        }
      }
    }
  }
  return {
    id:item.id,
    ok:true,
    provider:'belavia-cloudflare',
    source_kind:'official-current',
    current_availability:offers.length>0,
    availability_summary:offers.length && offers.every(o=>String(o.service_class||'').toLowerCase().includes('business')) ? 'business_only' : (offers.length?'current_offer_available':'no_current_offer'),
    offers,
    search_id:String(searchId),
    checked_at:new Date().toISOString()
  };
}

export default {
  async fetch(request){
    const origin=request.headers.get('origin')||'';
    if(request.method==='OPTIONS') return new Response('',{status:204,headers:cors(origin)});
    if(request.method!=='POST') return new Response(JSON.stringify({error:'POST only'}),{status:405,headers:cors(origin)});
    if(origin && !ALLOWED_ORIGINS.has(origin)) return new Response(JSON.stringify({error:'origin not allowed'}),{status:403,headers:cors(origin)});
    let body; try{ body=await request.json(); }catch{ return new Response(JSON.stringify({error:'invalid json'}),{status:400,headers:cors(origin)}); }
    const searches=Array.isArray(body?.searches)?body.searches:[];
    if(!searches.length || searches.length>12) return new Response(JSON.stringify({error:'searches must contain 1-12 items'}),{status:400,headers:cors(origin)});
    const results=[];
    for(const item of searches){
      try{ results.push(await runOne(item)); }
      catch(e){ results.push({id:item?.id,ok:false,code:'worker_error',error:e instanceof Error?e.message:String(e)}); }
      await sleep(150);
    }
    return new Response(JSON.stringify({ok:true,version:'belavia-worker-1',queried_at:new Date().toISOString(),results}),{headers:cors(origin)});
  }
};
