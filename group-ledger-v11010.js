import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage} })
  : null;
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const esc = (v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moneySymbol = c => ({CNY:'¥',BYN:'Br ',RUB:'₽',USD:'$',EUR:'€'})[c] || `${c} `;
let busy = false;
let timer = null;
let currentGroupId = '';
let currentUser = null;
let members = [];
let expenses = [];
let shares = [];
let settlements = [];

function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._aaT);el._aaT=setTimeout(()=>el.classList.remove('show'),2100);}
function localISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function centsFromInput(v){const n=Number(String(v).replace(',','.'));return Number.isFinite(n)?Math.round(n*100):0;}
function fmt(cents,currency='CNY'){return `${moneySymbol(currency)}${(Math.abs(Number(cents)||0)/100).toFixed(2)}`;}
function nameOf(id){return members.find(m=>m.user_id===id)?.member_name || '群成员';}
function activeGroup(){return localStorage.getItem('fansfood-active-group') || '';}
function currencyPref(){return localStorage.getItem('fansfood-aa-currency') || 'CNY';}
function saveCurrency(c){localStorage.setItem('fansfood-aa-currency',c);}

function ensureTabAndPanel(){
  const panel=$('#activeGroupPanel');
  const tabs=panel?.querySelector('.wd-group-tabs');
  const grid=panel?.querySelector('.group-content-grid');
  if(!panel||!tabs||!grid)return false;
  if(!tabs.querySelector('[data-wd-tab="ledger"]')){
    const btn=document.createElement('button');btn.type='button';btn.dataset.wdTab='ledger';btn.textContent='AA账本';
    const shopping=tabs.querySelector('[data-wd-tab="shopping"]');shopping?.insertAdjacentElement('beforebegin',btn) || tabs.appendChild(btn);
    btn.addEventListener('click',()=>{
      panel.dataset.wdTab='ledger';
      $$('[data-wd-tab]',tabs).forEach(x=>x.classList.toggle('active',x===btn));
      loadAndRender(true);
    });
  }
  if(!$('#groupLedgerPanel',panel)){
    const ledger=document.createElement('section');ledger.id='groupLedgerPanel';ledger.innerHTML='<div class="aa-loading">正在读取小饭桌账本…</div>';
    const vote=panel.querySelector('.wd-group-vote-link');
    (vote || grid).insertAdjacentElement('afterend',ledger);
  }
  return true;
}

async function fetchLedger(){
  currentGroupId=activeGroup();
  if(!supabase||!currentGroupId)return false;
  const {data:s}=await supabase.auth.getSession();currentUser=s.session?.user||null;if(!currentUser)return false;
  const [m,e,sh,st]=await Promise.all([
    supabase.from('group_members').select('group_id,user_id,member_name,member_role,joined_at').eq('group_id',currentGroupId).order('joined_at'),
    supabase.from('group_expenses').select('id,group_id,paid_by,total_cents,currency,note,expense_date,created_by,created_at').eq('group_id',currentGroupId).order('expense_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('group_expense_shares').select('id,expense_id,group_id,participant_user_id,share_cents,created_at').eq('group_id',currentGroupId),
    supabase.from('group_settlements').select('id,group_id,from_user,to_user,amount_cents,currency,note,settlement_date,created_by,created_at').eq('group_id',currentGroupId).order('settlement_date',{ascending:false}).order('created_at',{ascending:false})
  ]);
  if(m.error){toast('群成员读取失败');return false;}
  if(e.error){toast('AA账本读取失败');return false;}
  members=m.data||[];expenses=e.data||[];shares=sh.data||[];settlements=st.error?[]:(st.data||[]);
  return true;
}

function balancesByCurrency(){
  const out=new Map();
  const ensure=c=>{if(!out.has(c))out.set(c,new Map(members.map(m=>[m.user_id,0])));return out.get(c);};
  expenses.forEach(e=>{
    const c=e.currency||'CNY', map=ensure(c);map.set(e.paid_by,(map.get(e.paid_by)||0)+e.total_cents);
    shares.filter(s=>s.expense_id===e.id).forEach(s=>map.set(s.participant_user_id,(map.get(s.participant_user_id)||0)-s.share_cents));
  });
  settlements.forEach(s=>{
    const c=s.currency||'CNY',map=ensure(c);
    map.set(s.from_user,(map.get(s.from_user)||0)+s.amount_cents);
    map.set(s.to_user,(map.get(s.to_user)||0)-s.amount_cents);
  });
  return out;
}
function transfersFor(map){
  const creditors=[],debtors=[];
  map.forEach((v,id)=>{const n=Math.round(v);if(n>0)creditors.push({id,amount:n});else if(n<0)debtors.push({id,amount:-n});});
  creditors.sort((a,b)=>b.amount-a.amount);debtors.sort((a,b)=>b.amount-a.amount);
  const result=[];let i=0,j=0;
  while(i<debtors.length&&j<creditors.length){const amount=Math.min(debtors[i].amount,creditors[j].amount);if(amount>0)result.push({from:debtors[i].id,to:creditors[j].id,amount});debtors[i].amount-=amount;creditors[j].amount-=amount;if(debtors[i].amount===0)i++;if(creditors[j].amount===0)j++;}
  return result;
}
function outstandingCount(){let n=0;balancesByCurrency().forEach(map=>{n+=transfersFor(map).length;});return n;}

function balanceHtml(){
  const all=balancesByCurrency();
  if(!all.size)return '<div class="aa-all-clear"><b>还没有需要分摊的账</b><span>记下第一笔采购或聚餐支出后，这里会自动算出谁该付给谁。</span></div>';
  return [...all.entries()].map(([currency,map])=>{
    const transfers=transfersFor(map);
    const memberChips=members.map(m=>{const v=Math.round(map.get(m.user_id)||0);const cls=v>0?'receive':v<0?'pay':'even';const label=v>0?`应收 ${fmt(v,currency)}`:v<0?`应付 ${fmt(v,currency)}`:'已平';return `<div class="aa-balance-chip ${cls}"><span>${esc(m.member_name)}</span><b>${label}</b></div>`;}).join('');
    const transferRows=transfers.length?transfers.map(t=>`<div class="aa-transfer-row"><div class="aa-transfer-main"><b>${esc(nameOf(t.from))}</b><span class="aa-transfer-arrow">→</span><b>${esc(nameOf(t.to))}</b></div><span class="aa-transfer-amount">${fmt(t.amount,currency)}</span><button class="aa-settle-btn" type="button" data-aa-settle="${t.from}|${t.to}|${t.amount}|${currency}">标记已转账</button></div>`).join(''):'<div class="aa-all-clear"><b>这个币种已经结清</b><span>目前没有人欠其他成员钱。</span></div>';
    return `<div class="aa-currency-block"><div class="aa-currency-title"><b>${currency} 结算</b><span>${transfers.length?`${transfers.length} 笔即可结清`:'已结清'}</span></div><div class="aa-member-balances">${memberChips}</div><div class="aa-transfer-list">${transferRows}</div>${transfers.length>1?`<button class="btn ghost" type="button" data-aa-settle-all="${currency}">全部标记为已结清</button>`:''}</div>`;
  }).join('');
}

function expenseFormHtml(){
  const currency=currencyPref();
  const payerOptions=members.map(m=>`<option value="${m.user_id}" ${m.user_id===currentUser?.id?'selected':''}>${esc(m.member_name)}</option>`).join('');
  const participantChecks=members.map(m=>`<label class="aa-person-check"><input type="checkbox" name="participants" value="${m.user_id}" checked><span>${esc(m.member_name)}</span></label>`).join('');
  return `<section class="card aa-card aa-form-card" id="aaExpenseFormCard"><div class="aa-card-head"><div><span class="eyebrow">NEW EXPENSE</span><h3>记一笔支出</h3></div><span>默认全员均分</span></div><form class="aa-form" id="aaExpenseForm">
    <div class="aa-field"><span>花了多少钱</span><div class="aa-money-input"><input id="aaAmount" inputmode="decimal" placeholder="例如 200.00" required><select id="aaCurrency"><option ${currency==='CNY'?'selected':''}>CNY</option><option ${currency==='BYN'?'selected':''}>BYN</option><option ${currency==='RUB'?'selected':''}>RUB</option><option ${currency==='USD'?'selected':''}>USD</option><option ${currency==='EUR'?'selected':''}>EUR</option></select></div></div>
    <div class="aa-form-row"><label class="aa-field"><span>谁先付的钱</span><select id="aaPayer">${payerOptions}</select></label><label class="aa-field"><span>日期</span><input id="aaDate" type="date" value="${localISO()}"></label></div>
    <div><div class="aa-participant-label">这笔钱由谁一起承担？</div><div class="aa-participants" id="aaParticipants">${participantChecks}</div></div>
    <label class="aa-field"><span>备注（可选）</span><textarea id="aaNote" maxlength="280" placeholder="例如：今晚火锅采购 / 周末一起做饭"></textarea></label>
    <div class="aa-split-preview" id="aaSplitPreview">输入金额后会显示每人大约承担多少。</div>
    <div class="aa-form-actions"><button class="btn primary" type="submit">保存到 AA 账本</button></div>
  </form></section>`;
}

function historyHtml(){
  const rows=[];
  expenses.forEach(e=>rows.push({type:'expense',date:e.expense_date,created:e.created_at,data:e}));
  settlements.forEach(s=>rows.push({type:'settlement',date:s.settlement_date,created:s.created_at,data:s}));
  rows.sort((a,b)=>`${b.date}|${b.created}`.localeCompare(`${a.date}|${a.created}`));
  if(!rows.length)return '<div class="aa-empty">还没有账单记录。第一次采购后，从上方“记一笔支出”开始。</div>';
  return rows.map(row=>{
    if(row.type==='expense'){
      const e=row.data;const part=shares.filter(s=>s.expense_id===e.id);const names=part.map(s=>nameOf(s.participant_user_id)).join('、');const canDelete=e.created_by===currentUser?.id;
      return `<div class="aa-history-row"><div class="aa-history-icon">¥</div><div class="aa-history-main"><b>${esc(e.note||'群组支出')}</b><span>${esc(nameOf(e.paid_by))} 先付 · ${e.expense_date} · ${names?`${esc(names)} 分摊`:'无分摊成员'}</span></div><div class="aa-history-side"><b>${fmt(e.total_cents,e.currency||'CNY')}</b>${canDelete?`<button class="aa-delete" type="button" data-aa-delete-expense="${e.id}">删除</button>`:''}</div></div>`;
    }
    const s=row.data;const canDelete=s.created_by===currentUser?.id;
    return `<div class="aa-history-row settlement"><div class="aa-history-icon">✓</div><div class="aa-history-main"><b>已转账</b><span>${esc(nameOf(s.from_user))} → ${esc(nameOf(s.to_user))} · ${s.settlement_date}${s.note?` · ${esc(s.note)}`:''}</span></div><div class="aa-history-side"><b>${fmt(s.amount_cents,s.currency||'CNY')}</b>${canDelete?`<button class="aa-delete" type="button" data-aa-delete-settlement="${s.id}">撤销</button>`:''}</div></div>`;
  }).join('');
}

function renderLedger(){
  const root=$('#groupLedgerPanel');if(!root)return;
  const currencies=new Set(expenses.map(e=>e.currency||'CNY'));
  root.innerHTML=`<div class="aa-shell">
    <section class="card aa-hero"><div class="aa-hero-head"><div><span class="eyebrow">GROUP LEDGER</span><h3>AA 账本</h3><p>谁先垫钱都没关系。把每笔支出记下来，食光会自动合并成最少的转账。</p></div><div class="aa-hero-actions"><button class="btn primary aa-mobile-add" id="aaMobileAdd" type="button">＋ 记一笔</button></div></div><div class="aa-summary-grid"><div class="aa-summary-card"><span>已记录支出</span><b>${expenses.length} 笔</b></div><div class="aa-summary-card"><span>当前待转账</span><b>${outstandingCount()} 笔</b></div><div class="aa-summary-card"><span>涉及币种</span><b>${currencies.size||1} 种</b></div></div></section>
    <div class="aa-grid"><section class="card aa-card"><div class="aa-card-head"><div><span class="eyebrow">BALANCE</span><h3>现在怎么结算</h3></div><span>自动净额抵消</span></div>${balanceHtml()}</section>${expenseFormHtml()}</div>
    <section class="card aa-card"><div class="aa-card-head"><div><span class="eyebrow">HISTORY</span><h3>账本记录</h3></div><span>${expenses.length+settlements.length} 条</span></div><div class="aa-history">${historyHtml()}</div></section>
  </div>`;
  installLedgerHandlers();
}

function updateSplitPreview(){
  const amount=centsFromInput($('#aaAmount')?.value||'');const checked=$$('#aaParticipants input:checked');const el=$('#aaSplitPreview');if(!el)return;
  if(!amount){el.textContent='输入金额后会显示每人大约承担多少。';return;}if(!checked.length){el.textContent='至少选择 1 位参与分摊的成员。';return;}
  const base=Math.floor(amount/checked.length),rem=amount%checked.length;el.textContent=`共 ${checked.length} 人分摊，每人大约 ${fmt(base,currencyPref())}${rem?`，其中 ${rem} 人多承担 0.01`:''}。`;
}
function installLedgerHandlers(){
  $('#aaMobileAdd')?.addEventListener('click',()=>{$('#aaExpenseFormCard')?.classList.add('open');$('#aaAmount')?.focus();});
  $('#aaCurrency')?.addEventListener('change',e=>{saveCurrency(e.target.value);updateSplitPreview();});
  $('#aaAmount')?.addEventListener('input',updateSplitPreview);
  $('#aaParticipants')?.addEventListener('change',updateSplitPreview);
  $('#aaExpenseForm')?.addEventListener('submit',createExpense);
  $$('[data-aa-settle]').forEach(btn=>btn.onclick=()=>{const [from,to,amount,currency]=btn.dataset.aaSettle.split('|');recordSettlement(from,to,Number(amount),currency);});
  $$('[data-aa-settle-all]').forEach(btn=>btn.onclick=()=>settleAll(btn.dataset.aaSettleAll));
  $$('[data-aa-delete-expense]').forEach(btn=>btn.onclick=()=>deleteExpense(btn.dataset.aaDeleteExpense));
  $$('[data-aa-delete-settlement]').forEach(btn=>btn.onclick=()=>deleteSettlement(btn.dataset.aaDeleteSettlement));
}

async function createExpense(e){
  e.preventDefault();const submit=e.submitter;const cents=centsFromInput($('#aaAmount').value);const participants=$$('#aaParticipants input:checked').map(x=>x.value);const currency=$('#aaCurrency').value;
  if(cents<=0){toast('请输入正确的金额');return;}if(!participants.length){toast('至少选择 1 位分摊成员');return;}
  submit.disabled=true;submit.textContent='正在保存…';
  const {error}=await supabase.rpc('create_group_expense_equal',{p_group_id:currentGroupId,p_paid_by:$('#aaPayer').value,p_total_cents:cents,p_currency:currency,p_note:$('#aaNote').value.trim(),p_expense_date:$('#aaDate').value||localISO(),p_participant_ids:participants});
  submit.disabled=false;submit.textContent='保存到 AA 账本';
  if(error){console.warn(error);toast(error.message?.includes('not_group_member')?'你已经不在这个群组里':`保存失败：${error.message||'请稍后重试'}`);return;}
  saveCurrency(currency);toast('这笔支出已经记入 AA 账本');await loadAndRender(true);
}
async function recordSettlement(from,to,amount,currency){
  if(!confirm(`确认 ${nameOf(from)} 已向 ${nameOf(to)} 转账 ${fmt(amount,currency)}？`))return;
  const {error}=await supabase.rpc('record_group_settlement',{p_group_id:currentGroupId,p_from_user:from,p_to_user:to,p_amount_cents:amount,p_currency:currency,p_note:'按 AA 账本结算',p_settlement_date:localISO()});
  if(error){toast(`记录转账失败：${error.message||'请稍后重试'}`);return;}toast('已标记为转账完成');await loadAndRender(true);
}
async function settleAll(currency){
  const map=balancesByCurrency().get(currency);const list=map?transfersFor(map):[];if(!list.length)return;
  const text=list.map(t=>`${nameOf(t.from)} → ${nameOf(t.to)} ${fmt(t.amount,currency)}`).join('\n');
  if(!confirm(`确认以下转账都已经实际完成？\n\n${text}\n\n确认后会写入结算记录。`))return;
  for(const t of list){const {error}=await supabase.rpc('record_group_settlement',{p_group_id:currentGroupId,p_from_user:t.from,p_to_user:t.to,p_amount_cents:t.amount,p_currency:currency,p_note:'AA 账本批量结清',p_settlement_date:localISO()});if(error){toast('部分结算记录保存失败，请重新检查');await loadAndRender(true);return;}}
  toast('这组账已经全部结清');await loadAndRender(true);
}
async function deleteExpense(id){if(!confirm('删除这笔支出吗？相关分摊会一起撤销。'))return;const {error}=await supabase.from('group_expenses').delete().eq('id',id);if(error){toast('删除失败：只有记账人可以删除这笔支出');return;}toast('已删除这笔支出');await loadAndRender(true);}
async function deleteSettlement(id){if(!confirm('撤销这条“已转账”记录吗？撤销后欠款会重新出现。'))return;const {error}=await supabase.from('group_settlements').delete().eq('id',id);if(error){toast('撤销失败');return;}toast('已撤销转账记录');await loadAndRender(true);}

async function loadAndRender(force=false){
  if(busy&&!force)return;if(!ensureTabAndPanel())return;
  const gid=activeGroup();if(!gid)return;busy=true;const root=$('#groupLedgerPanel');if(root&&root.children.length===0)root.innerHTML='<div class="aa-loading">正在读取小饭桌账本…</div>';
  try{if(await fetchLedger())renderLedger();}finally{busy=false;}
}
function schedule(delay=100){clearTimeout(timer);timer=setTimeout(()=>{ensureTabAndPanel();if($('#activeGroupPanel')?.dataset.wdTab==='ledger')loadAndRender();},delay);}
function init(){
  schedule(700);schedule(1600);
  new MutationObserver(()=>schedule(120)).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('fansfood-group-changed',()=>setTimeout(()=>{currentGroupId='';schedule(180);},0));
  window.addEventListener('hashchange',()=>{if(location.hash==='#groups')schedule(180);});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
