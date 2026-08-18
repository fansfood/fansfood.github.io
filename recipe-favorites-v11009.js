const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const ACTIVE_KEY='wd-recipe-favorites-active';
let applying=false;
let timer=null;

function favoriteIds(){
  try{return new Set((JSON.parse(localStorage.getItem('shiguang-v2-state')||'{}')?.favorites)||[])}catch{return new Set()}
}
function cardId(card){return $('[data-open]',card)?.dataset.open||$('[data-fav]',card)?.dataset.fav||''}
function applyFavorites(){
  if(applying||sessionStorage.getItem(ACTIVE_KEY)!=='1')return;applying=true;
  try{
    const ids=favoriteIds();
    $$('#recipeGrid .recipe-card').forEach(card=>{card.hidden=!ids.has(cardId(card));});
    const button=$('[data-wd-favorite-filter]');if(button){$$('#recipeFilters button').forEach(b=>b.classList.toggle('active',b===button));}
    const grid=$('#recipeGrid');if(grid&&!$('#wdFavoriteEmpty',grid)&&!$$('.recipe-card',grid).some(c=>!c.hidden)){
      const empty=document.createElement('div');empty.id='wdFavoriteEmpty';empty.className='card empty';empty.textContent='还没有收藏菜谱。看到喜欢的菜，点一下收藏就会出现在这里。';grid.appendChild(empty);
    }
  }finally{applying=false;}
}
function ensureFilter(){
  const filters=$('#recipeFilters');if(!filters)return;
  let button=$('[data-wd-favorite-filter]',filters);
  if(!button){
    button=document.createElement('button');button.type='button';button.dataset.wdFavoriteFilter='1';button.textContent='我的收藏';filters.appendChild(button);
    button.onclick=()=>{sessionStorage.setItem(ACTIVE_KEY,'1');applyFavorites();};
  }
  if(sessionStorage.getItem(ACTIVE_KEY)==='1')applyFavorites();
}
function schedule(delay=50){clearTimeout(timer);timer=setTimeout(()=>{ensureFilter();applyFavorites();},delay)}
function init(){
  document.addEventListener('click',e=>{
    const favoriteEntry=e.target.closest('[data-wd-favorites]');
    if(favoriteEntry){sessionStorage.setItem(ACTIVE_KEY,'1');setTimeout(()=>{$('[data-wd-favorite-filter]')?.click();},180);return;}
    const filter=e.target.closest('#recipeFilters button');
    if(filter&&!filter.matches('[data-wd-favorite-filter]')){sessionStorage.removeItem(ACTIVE_KEY);$('#wdFavoriteEmpty')?.remove();}
  },true);
  $('#wdGlobalSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')sessionStorage.removeItem(ACTIVE_KEY);});
  const grid=$('#recipeGrid');if(grid)new MutationObserver(()=>{if(!applying)schedule(30)}).observe(grid,{childList:true,subtree:true});
  const filters=$('#recipeFilters');if(filters)new MutationObserver(()=>{if(!applying)schedule(30)}).observe(filters,{childList:true});
  window.addEventListener('hashchange',()=>{if(location.hash==='#recipes')schedule(80);});
  schedule(700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
