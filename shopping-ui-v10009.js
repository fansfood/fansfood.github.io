import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const OVERRIDE_KEY = 'shiguang-shopping-overrides';
const UNITS = ['g','kg','个','颗','根','只','盒','袋','包','瓶','罐','把','片','块','ml','L','份'];
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;
let syncing = null;
let applying = false;

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readOverrides(){try{return JSON.parse(localStorage.getItem(OVERRIDE_KEY)||'{}')||{}}catch{return{}}}
function writeOverrides(v){localStorage.setItem(OVERRIDE_KEY,JSON.stringify(v))}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._qtyTimer);el._qtyTimer=setTimeout(()=>el.classList.remove('show'),1500)}
function catEmoji(cat){return({'肉蛋':'🥩','蔬菜':'🥬','水果':'🍎','乳制品':'🥛','主食':'🍚','调味料':'🧂','其他':'🛒'})[cat]||'🛒'}
function parseQty(text){const raw=String(text||'').trim();const m=raw.match(/^([\d.,]+)\s*(.*)$/);return m?{amount:m[1].replace(',','.'),unit:m[2].trim()}:{amount:raw,unit:''}}
function unitOptions(current=''){const list=current&&!UNITS.includes(current)?[current,...UNITS]:UNITS;return[...new Set(list)].map(u=>`<option value="${esc(u)}"${u===current?' selected':''}>${esc(u)}</option>`).join('')}

async function syncCloud(){if(!supabase)return;clearTimeout(syncing);syncing=setTimeout(async()=>{const{data}=await supabase.auth.getSession();const user=data.session?.user;if(!user)return;await supabase.from('app_state').upsert({user_id:user.id,shopping_overrides:readOverrides(),updated_at:new Date().toISOString()},{onConflict:'user_id'})},250)}
function saveOverride(id,amount,unit,base){const all=readOverrides();const a=String(amount??'').trim(),u=String(unit??'').trim();if(a===String(base.amount??'')&&u===String(base.unit??''))delete all[id];else all[id]={amount:a,unit:u};writeOverrides(all);syncCloud();toast('采购数量已更新')}
function resetOverride(id,row){const all=readOverrides();delete all[id];writeOverrides(all);syncCloud();enhanceRow(row,true);toast('已恢复原始数量')}

function injectStyles(){if($('#shoppingCompactV10009'))return;const style=document.createElement('style');style.id='shoppingCompactV10009';style.textContent=`
#shoppingGroups .shopping-date-group .shopping-item{display:grid!important;grid-template-columns:24px minmax(0,1fr) auto auto!important;align-items:center!important;gap:9px!important;padding:11px 0!important}
#shoppingGroups .shopping-date-group .shopping-item .item-name{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;white-space:nowrap!important;margin:0!important;grid-column:auto!important}
#shoppingGroups .shopping-food-name-v9{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#shoppingGroups .shopping-category-chip{display:inline-flex!important;align-items:center!important;flex:none!important;width:auto!important;max-width:max-content!important;margin:0!important;padding:4px 7px!important;border-radius:999px!important;font-size:10px!important;line-height:1!important;white-space:nowrap!important;background:#f1f2ed!important;color:#62675f!important;grid-column:auto!important}
#shoppingGroups .qty.shopping-qty-v9{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;white-space:nowrap!important;grid-column:auto!important}
#shoppingGroups .shopping-qty-v9 input{width:56px!important;min-width:0!important;border:1px solid var(--line)!important;background:#fbfcf9!important;padding:7px 6px!important;border-radius:9px!important;text-align:right!important;color:var(--ink)!important;font:inherit!important;outline:none!important}
#shoppingGroups .shopping-qty-v9 select{width:60px!important;min-width:0!important;border:1px solid var(--line)!important;background:#fbfcf9!important;padding:7px 4px!important;border-radius:9px!important;color:var(--ink)!important;font:inherit!important;outline:none!important}
#shoppingGroups .shopping-qty-reset-v9{border:0!important;background:transparent!important;color:#a0a69c!important;padding:2px!important;font-size:13px!important;line-height:1!important}
@media(max-width:700px){
 #shoppingGroups .shopping-date-group{padding:15px!important}
 #shoppingGroups .shopping-date-group .shopping-item{grid-template-columns:22px minmax(0,1fr) auto auto!important;gap:6px!important;padding:9px 0!important}
 #shoppingGroups .shopping-date-group .shopping-item .item-name{display:flex!important;grid-column:auto!important;grid-row:auto!important;gap:5px!important}
 #shoppingGroups .shopping-category-chip{display:inline-flex!important;grid-column:auto!important;grid-row:auto!important;font-size:9px!important;padding:4px 6px!important}
 #shoppingGroups .qty.shopping-qty-v9{grid-column:auto!important;grid-row:auto!important}
 #shoppingGroups .shopping-qty-v9 input{width:45px!important;padding:6px 4px!important}
 #shoppingGroups .shopping-qty-v9 select{width:51px!important;padding:6px 2px!important}
 #shoppingGroups .shopping-qty-reset-v9{display:none!important}
 #shoppingGroups .shopping-date-group .shopping-item>.icon-btn{grid-column:auto!important;grid-row:auto!important;margin:0!important}
}
@media(max-width:430px){
 #shoppingGroups .shopping-date-group .shopping-item{grid-template-columns:20px minmax(0,1fr) auto!important}
 #shoppingGroups .shopping-date-group .shopping-item>.icon-btn{display:none!important}
 #shoppingGroups .shopping-category-chip{max-width:66px!important;overflow:hidden!important;text-overflow:ellipsis!important}
 #shoppingGroups .shopping-qty-v9 input{width:42px!important}
 #shoppingGroups .shopping-qty-v9 select{width:48px!important}
}
`;document.head.appendChild(style)}

function getCategory(row){if(row.dataset.category)return row.dataset.category;const chip=$('.shopping-category-chip',row);if(chip){const t=chip.textContent.trim().replace(/^\S+\s*/,'');if(t)return t}return'其他'}

function enhanceRow(row,force=false){if(row.dataset.v9Enhanced==='1'&&!force)return;const checkbox=$('[data-check]',row);if(!checkbox)return;const id=checkbox.dataset.check;if(!id)return;const nameCell=$('.item-name',row);const qty=$('.qty',row);if(!nameCell||!qty)return;
 row.dataset.v9Enhanced='1';
 const category=getCategory(row);row.dataset.category=category;
 const oldChip=$('.shopping-category-chip',row);if(oldChip)oldChip.remove();
 let nameSpan=$('.shopping-food-name-v9',nameCell);if(!nameSpan){const text=nameCell.textContent.trim();nameCell.textContent='';nameSpan=document.createElement('span');nameSpan.className='shopping-food-name-v9';nameSpan.textContent=text;nameCell.appendChild(nameSpan)}
 const chip=document.createElement('span');chip.className='shopping-category-chip';chip.textContent=`${catEmoji(category)} ${category}`;nameCell.appendChild(chip);
 if(!row.dataset.baseQtyV9||force&& !row.dataset.baseQtyV9){row.dataset.baseQtyV9=qty.classList.contains('shopping-qty-v9')?(row.dataset.baseQtyV9||''):qty.textContent.trim()}
 if(!row.dataset.baseQtyV9)return;
 const base=parseQty(row.dataset.baseQtyV9);const override=readOverrides()[id]||{};const amount=override.amount??base.amount;const unit=override.unit??base.unit;
 qty.classList.add('shopping-qty-v9');qty.innerHTML=`<input class="qty-amount-v9" inputmode="decimal" value="${esc(amount)}" aria-label="采购数量"><select class="qty-unit-v9" aria-label="采购单位">${unitOptions(unit)}</select><button class="shopping-qty-reset-v9" type="button" title="恢复原始数量">↺</button>`;
 const amountEl=$('.qty-amount-v9',qty),unitEl=$('.qty-unit-v9',qty);amountEl.onchange=()=>saveOverride(id,amountEl.value,unitEl.value,base);unitEl.onchange=()=>saveOverride(id,amountEl.value,unitEl.value,base);$('.shopping-qty-reset-v9',qty).onclick=e=>{e.preventDefault();resetOverride(id,row)};
}

function enhanceAll(force=false){if(applying)return;applying=true;try{$$('#shoppingGroups .shopping-item').forEach(row=>enhanceRow(row,force))}finally{applying=false}}

async function pullCloud(){if(!supabase)return;const{data:session}=await supabase.auth.getSession();const user=session.session?.user;if(!user)return;const{data,error}=await supabase.from('app_state').select('shopping_overrides').eq('user_id',user.id).maybeSingle();if(error)return;if(data?.shopping_overrides){writeOverrides({...readOverrides(),...data.shopping_overrides});setTimeout(()=>enhanceAll(true),0)}}

function init(){injectStyles();const badge=$('.brand small');if(badge)badge.textContent='v1.0.009';const root=$('#shoppingGroups');if(root){enhanceAll();new MutationObserver(()=>{if(!applying)setTimeout(enhanceAll,0)}).observe(root,{childList:true,subtree:true})}window.addEventListener('hashchange',()=>{if(location.hash==='#shopping')setTimeout(enhanceAll,0)});if(supabase){supabase.auth.onAuthStateChange(()=>setTimeout(pullCloud,250));setTimeout(pullCloud,700)}}
init();
