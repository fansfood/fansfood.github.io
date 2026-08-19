const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const MODE_KEY='shiguang-personal-planner-mode';
const MOBILE_SLOT_KEY='shiguang-personal-planner-slot';
const SLOTS=['早餐','午餐','晚餐'];
const SLOT_ICON={早餐:'☀',午餐:'◐',晚餐:'◑'};
const BUILTINS={
  r1:{id:'r1',name:'番茄牛肉意面',image:'assets/images/tomato-beef-pasta.svg',category:'主食',time:25,difficulty:'简单'},
  r2:{id:'r2',name:'香煎鸡胸配西兰花',image:'assets/images/chicken-broccoli.svg',category:'高蛋白',time:20,difficulty:'简单'},
  r3:{id:'r3',name:'鸡蛋蔬菜早餐卷',image:'assets/images/breakfast-wrap.svg',category:'早餐',time:15,difficulty:'简单'},
  r4:{id:'r4',name:'奶油蘑菇浓汤',image:'assets/images/mushroom-soup.svg',category:'汤',time:30,difficulty:'中等'},
  r5:{id:'r5',name:'三文鱼牛油果饭',image:'assets/images/salmon-avocado.svg',category:'高蛋白',time:25,difficulty:'中等'},
  r6:{id:'r6',name:'酸奶水果燕麦杯',image:'assets/images/yogurt-oats.svg',category:'早餐',time:8,difficulty:'简单'}
};
let recipeMap=new Map(Object.entries(BUILTINS));
let renderTimer=null;
let loadingRecipes=false;

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function readState(){try{return JSON.parse(localStorage.getItem('shiguang-v2-state')||'{}')||{}}catch{return{}}}
function mode(){return localStorage.getItem(MODE_KEY)==='meal'?'meal':'day'}
function mobileSlot(){const s=localStorage.getItem(MOBILE_SLOT_KEY);return SLOTS.includes(s)?s:'早餐'}
function rollingDays(){
  const names=['周日','周一','周二','周三','周四','周五','周六'];
  return Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);return{key:names[d.getDay()],relative:i===0?'今天':i===1?'明天':i===2?'后天':names[d.getDay()],md:`${d.getMonth()+1}/${d.getDate()}`,weekday:names[d.getDay()]};});
}
function recipe(id){return id?recipeMap.get(id)||{id,name:'我的食谱',image:'assets/images/recipe-placeholder.svg',category:'自定义',time:null,difficulty:''}:null}
async function loadCustomRecipes(){
  if(loadingRecipes)return;loadingRecipes=true;
  try{
    const supabase=window.Shiguang?.supabase;if(!supabase)return;
    const {data:session}=await supabase.auth.getSession();if(!session.session?.user)return;
    const {data,error}=await supabase.from('recipes').select('id,name,category,cook_time,difficulty,image_path').order('created_at',{ascending:false});if(error)return;
    const rows=await Promise.all((data||[]).map(async r=>{
      let image='assets/images/recipe-placeholder.svg';
      if(r.image_path){const {data:signed}=await supabase.storage.from('recipe-images').createSignedUrl(r.image_path,3600);if(signed?.signedUrl)image=signed.signedUrl;}
      return [r.id,{id:r.id,name:r.name,image,category:r.category||'我的食谱',time:r.cook_time,difficulty:r.difficulty||''}];
    }));
    recipeMap=new Map([...Object.entries(BUILTINS),...rows]);
  }finally{loadingRecipes=false;renderMealView();}
}
function ensurePlanner(){
  const page=$('#menu');const tabs=$('#weekTabs',page);const grid=$('#mealPlanGrid',page);if(!page||!tabs||!grid)return false;
  page.dataset.personalPlanner='1';
  let toolbar=$('#sgPlannerToolbar',page);
  if(!toolbar){
    toolbar=document.createElement('div');toolbar.id='sgPlannerToolbar';toolbar.className='sg-planner-toolbar';
    toolbar.innerHTML=`<div><span class="sg-planner-label">查看方式</span><div class="sg-view-switch" data-mode="day"><span class="sg-switch-thumb"></span><button type="button" data-planner-mode="day">按天</button><button type="button" data-planner-mode="meal">按餐</button></div></div><div class="sg-planner-hint"><b>未来 7 天</b><span>把“吃什么”先计划下来，采购会更轻松。</span></div>`;
    tabs.insertAdjacentElement('beforebegin',toolbar);
  }
  if(!$('#sgMealView',page)){
    const meal=document.createElement('div');meal.id='sgMealView';meal.className='sg-meal-view';tabs.insertAdjacentElement('beforebegin',meal);
  }
  if(!$('#sgMobileMealTabs',page)){
    const mobile=document.createElement('div');mobile.id='sgMobileMealTabs';mobile.className='sg-mobile-meal-tabs';mobile.innerHTML=SLOTS.map(s=>`<button type="button" data-planner-slot="${s}">${SLOT_ICON[s]} ${s}</button>`).join('');$('#sgMealView',page).prepend(mobile);
  }
  toolbar.onclick=e=>{const btn=e.target.closest('[data-planner-mode]');if(!btn)return;setMode(btn.dataset.plannerMode);};
  $('#sgMobileMealTabs',page).onclick=e=>{const btn=e.target.closest('[data-planner-slot]');if(!btn)return;localStorage.setItem(MOBILE_SLOT_KEY,btn.dataset.plannerSlot);applyMode();renderMealView();};
  $('#sgMealView',page).onclick=e=>{
    const edit=e.target.closest('[data-planner-edit]');if(edit){openLegacyPicker(edit.dataset.day,edit.dataset.slot);return;}
    const remove=e.target.closest('[data-planner-remove]');if(remove){removeLegacyMeal(remove.dataset.day,remove.dataset.slot);}
  };
  return true;
}
function setMode(next){
  if(!['day','meal'].includes(next))return;localStorage.setItem(MODE_KEY,next);
  const page=$('#menu');page?.classList.remove('sg-view-change');void page?.offsetWidth;page?.classList.add('sg-view-change');
  applyMode();if(next==='meal'){loadCustomRecipes();renderMealView();}
}
function applyMode(){
  const page=$('#menu');if(!page)return;const current=mode();page.dataset.plannerMode=current;
  const sw=$('.sg-view-switch',page);if(sw)sw.dataset.mode=current;
  $$('[data-planner-mode]',page).forEach(b=>{b.classList.toggle('active',b.dataset.plannerMode===current);b.setAttribute('aria-pressed',b.dataset.plannerMode===current?'true':'false');});
  const slot=mobileSlot();$$('[data-planner-slot]',page).forEach(b=>b.classList.toggle('active',b.dataset.plannerSlot===slot));
}
function rowHtml(day,slot,state){
  const id=state.plan?.[day.key]?.[slot]||null;const r=recipe(id);
  if(!r)return `<article class="sg-plan-row empty"><div class="sg-plan-date"><b>${day.relative}</b><span>${day.md}</span></div><div class="sg-plan-empty-copy"><span>还没安排</span><small>${slot}留给当天决定也可以</small></div><button type="button" class="sg-plan-add" data-planner-edit="1" data-day="${day.key}" data-slot="${slot}">＋ 添加</button></article>`;
  return `<article class="sg-plan-row"><div class="sg-plan-date"><b>${day.relative}</b><span>${day.md}</span></div><img class="sg-plan-image" src="${esc(r.image)}" alt="${esc(r.name)}"><div class="sg-plan-copy"><b>${esc(r.name)}</b><span>${esc(r.category||'食谱')}${r.time?` · ${r.time} min`:''}${r.difficulty?` · ${esc(r.difficulty)}`:''}</span></div><div class="sg-plan-actions"><button type="button" data-planner-edit="1" data-day="${day.key}" data-slot="${slot}">更换</button><button type="button" class="danger" data-planner-remove="1" data-day="${day.key}" data-slot="${slot}">移除</button></div></article>`;
}
function sectionHtml(slot,state,days){
  const planned=days.filter(d=>state.plan?.[d.key]?.[slot]).length;
  return `<section class="sg-meal-column" data-slot-section="${slot}"><div class="sg-meal-column-head"><span>${SLOT_ICON[slot]}</span><div><h3>${slot}</h3><p>${planned}/7 天已安排</p></div></div><div class="sg-plan-rows">${days.map(d=>rowHtml(d,slot,state)).join('')}</div></section>`;
}
function renderMealView(){
  const root=$('#sgMealView');if(!root||mode()!=='meal')return;const state=readState();const days=rollingDays();const mobile=$('#sgMobileMealTabs');
  const content=SLOTS.map(s=>sectionHtml(s,state,days)).join('');
  [...root.children].filter(x=>x!==mobile).forEach(x=>x.remove());root.insertAdjacentHTML('beforeend',`<div class="sg-meal-columns" data-mobile-slot="${mobileSlot()}">${content}</div>`);
  applyMode();
}
function findDayButton(day){return $$('#weekTabs button').find(b=>b.dataset.day===day)}
function openLegacyPicker(day,slot){
  const dayBtn=findDayButton(day);if(!dayBtn)return;dayBtn.click();
  setTimeout(()=>{const choose=$$('#mealPlanGrid .choose').find(b=>b.dataset.slot===slot);choose?.click();},20);
}
function removeLegacyMeal(day,slot){
  const dayBtn=findDayButton(day);if(!dayBtn)return;dayBtn.click();
  setTimeout(()=>{const remove=$$('#mealPlanGrid .remove').find(b=>b.dataset.slot===slot);remove?.click();},20);
}
function polishDayView(){
  const page=$('#menu');if(!page)return;const nav=$('#nav a[href="#menu"] span');if(nav)nav.textContent='我的七天';
  const title=$('.page-title h1',page);if(title)title.textContent='我的七天计划';
  const eye=$('.page-title .eyebrow',page);if(eye)eye.textContent='MY 7-DAY PLAN';
  const p=$('.page-title p',page);if(p)p.textContent='计划未来七天吃什么。按天安排生活，或按早餐、午餐、晚餐集中整理。';
}
function run(){if(!ensurePlanner())return;polishDayView();applyMode();if(mode()==='meal')renderMealView();}
function schedule(delay=80){clearTimeout(renderTimer);renderTimer=setTimeout(run,delay)}
function init(){
  schedule(700);schedule(1600);loadCustomRecipes();
  const grid=$('#mealPlanGrid');if(grid)new MutationObserver(()=>{if(mode()==='meal')schedule(80)}).observe(grid,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>{if(location.hash==='#menu')schedule(100)});
  window.addEventListener('fansfood-account-changed',()=>{loadCustomRecipes();schedule(120)});
  window.addEventListener('shiguang-runtime-ready',()=>{loadCustomRecipes();schedule(120)});
  window.addEventListener('shiguang-profile-ready',()=>loadCustomRecipes());
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
