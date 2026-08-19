const ROUTES=new Set(['home','groups','buddies','tomorrow','menu','recipes','shopping','pantry']);
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function targetId(){
  const raw=(location.hash||'#home').slice(1);
  return ROUTES.has(raw)?raw:'home';
}
function showRoute(){
  const id=targetId();
  const page=document.getElementById(id)||document.getElementById('home');
  if(!page)return;
  $$('.page').forEach(p=>p.classList.toggle('active',p===page));
  $$('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${id}`));
  $$('[data-wd-bottom]').forEach(a=>a.classList.toggle('active',a.dataset.wdBottom===`#${id}`));
  document.getElementById('nav')?.classList.remove('open');
}
function navigate(hash){
  if(location.hash===hash){showRoute();return;}
  location.hash=hash;
}
function handleClick(e){
  const link=e.target.closest('#nav a[href^="#"], .wd-mobile-bottom a[href^="#"], [data-sg-route]');
  if(!link)return;
  const hash=link.getAttribute('href')||link.dataset.sgRoute;
  if(!hash||!ROUTES.has(hash.replace('#','')))return;
  e.preventDefault();
  navigate(hash);
}
function init(){
  document.addEventListener('click',handleClick);
  window.addEventListener('hashchange',()=>{showRoute();setTimeout(showRoute,0);});
  showRoute();
  window.SG_ROUTE={show:showRoute,navigate};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
