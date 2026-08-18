import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg=window.SHIGUANG_CONFIG||{};
const supabase=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage}})
  : null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let busy=false;
let timer=null;

const paths={
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  login:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  plate:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M3 3v7M6 3v7M4.5 10v11M20 3c-2 2-2 6 0 8v10"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  bowl:'<path d="M4 10h16a8 8 0 0 1-16 0Z"/><path d="M8 19h8M7 6c1-2 3-2 4-4M13 7c1-2 3-2 4-4"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  apple:'<path d="M12 7c-3-3-8-1-8 5 0 5 4 9 8 9s8-4 8-9c0-6-5-8-8-5Z"/><path d="M12 7c0-3 2-5 5-5"/>'
};
function svg(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.user}</svg>`}
function initials(name='食友'){const t=String(name).replace(/\s*·\s*我$/,'').replace(/^@/,'').trim();return (t.slice(0,2)||'食友').toUpperCase()}
function tomorrowISO(){const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}

function ensureDynamicRoute(){
  const hash=location.hash||'#home';const id=hash.slice(1);const page=document.getElementById(id);if(!page)return;
  if(!page.classList.contains('active')){$$('.page').forEach(p=>p.classList.remove('active'));page.classList.add('active');window.scrollTo({top:0,behavior:'auto'});}
  $$('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===hash));
  $$('[data-wd-bottom]').forEach(a=>a.classList.toggle('active',a.dataset.wdBottom===hash));
}

function normalizeVisualIcons(){
  $$('.identity-avatar').forEach(el=>{if(el.dataset.wdIcon)return;el.dataset.wdIcon='1';el.classList.add('wd-line-identity');el.innerHTML=svg('user');});
  $$('.group-empty-icon').forEach(el=>{if(el.dataset.wdIcon)return;el.dataset.wdIcon='1';el.classList.add('wd-line-empty');el.innerHTML=svg('users');});
  $$('#tomorrowGroupContext .group-context-message>span').forEach(el=>{if(el.dataset.wdIcon)return;el.dataset.wdIcon='1';const txt=el.textContent;el.innerHTML=svg(txt.includes('登录')?'login':txt.includes('群')?'users':'user');});
  const iconNames=['sun','bowl','moon','apple'];
  $$('#buddies .buddy-meal-row label').forEach((label,i)=>{if(label.dataset.wdClean)return;label.dataset.wdClean='1';const text=label.textContent.replace(/^[^\p{L}\p{N}]+/u,'').trim();label.classList.add('wd-clean-meal-label');label.innerHTML=`${svg(iconNames[i%4])}<span>${text}</span>`;});
  $$('#buddies .buddy-meal-item>span:first-child').forEach((label,i)=>{if(label.dataset.wdClean)return;label.dataset.wdClean='1';const text=label.textContent.replace(/^[^\p{L}\p{N}]+/u,'').trim();label.classList.add('wd-clean-meal-label');label.innerHTML=`${svg(iconNames[i%4])}<span>${text}</span>`;});
}

async function enrichGroupCards(){
  if(!supabase)return;const cards=$$('.group-switch-card[data-group-id]');if(!cards.length)return;
  const pending=cards.filter(c=>!c.dataset.wdRich);if(!pending.length)return;
  const ids=pending.map(c=>c.dataset.groupId).filter(Boolean);if(!ids.length)return;
  const {data,error}=await supabase.from('group_members').select('group_id,member_name').in('group_id',ids).order('joined_at');if(error)return;
  const byGroup=new Map();(data||[]).forEach(m=>{if(!byGroup.has(m.group_id))byGroup.set(m.group_id,[]);byGroup.get(m.group_id).push(m);});
  pending.forEach(card=>{card.dataset.wdRich='1';const members=byGroup.get(card.dataset.groupId)||[];const extra=document.createElement('span');extra.className='wd-group-card-extra';extra.innerHTML=`<span class="wd-group-card-avatars">${members.slice(0,4).map(m=>`<span>${initials(m.member_name)}</span>`).join('')}</span><small>${members.length} 位成员</small>`;card.appendChild(extra);});
}

function addCurrentGroupWarmth(){
  const header=$('#activeGroupPanel .group-header-card');if(!header||$('.wd-live-pill',header))return;
  const target=header.firstElementChild;if(!target)return;const pill=document.createElement('span');pill.className='wd-live-pill';pill.textContent='今天的小饭桌';target.prepend(pill);
}

async function correctTomorrowHomeMeta(){
  if(!supabase||!$('#wdTomorrowMeta'))return;
  const {data:session}=await supabase.auth.getSession();const user=session.session?.user;if(!user)return;
  const {data:profile}=await supabase.from('user_accounts').select('food_role').eq('user_id',user.id).maybeSingle();
  const groupId=localStorage.getItem('fansfood-active-group');if(!groupId)return;
  const {count:dishCount}=await supabase.from('site_dishes').select('id',{count:'exact',head:true}).eq('group_id',groupId).eq('is_active',true);
  const meta=$('#wdTomorrowMeta');if(!meta)return;
  if(profile?.food_role==='foodie'){
    const {data:mine}=await supabase.from('tomorrow_votes').select('id').eq('group_id',groupId).eq('target_date',tomorrowISO()).eq('voter_user_id',user.id).maybeSingle();
    meta.textContent=`${dishCount||0} 道候选 · ${mine?'你已投票':'还没投票'}`;
  }else if(profile?.food_role==='chef'){
    const {data:votes}=await supabase.from('tomorrow_votes').select('id').eq('group_id',groupId).eq('target_date',tomorrowISO());
    meta.textContent=`${dishCount||0} 道候选 · ${(votes||[]).length} 份选择`;
  }
}

async function run(){
  if(busy)return;busy=true;try{ensureDynamicRoute();normalizeVisualIcons();addCurrentGroupWarmth();await enrichGroupCards();if(location.hash==='#home')await correctTomorrowHomeMeta();}finally{busy=false;}
}
function schedule(delay=80){clearTimeout(timer);timer=setTimeout(run,delay)}
function init(){
  schedule(500);schedule(1500);
  new MutationObserver(()=>{if(!busy)schedule(90)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>schedule(80));window.addEventListener('fansfood-account-changed',()=>schedule(120));window.addEventListener('fansfood-group-changed',()=>schedule(120));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
