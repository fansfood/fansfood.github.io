const VERSION='1.1.010';
let guarded=null;
function apply(){
  const badge=document.querySelector('.brand small');
  if(badge&&badge.textContent!==`v${VERSION}`)badge.textContent=`v${VERSION}`;
  const side=document.getElementById('wdSideVersion');
  if(side&&side.textContent!==`v${VERSION}`)side.textContent=`v${VERSION}`;
}
function guard(){
  const badge=document.querySelector('.brand small');
  if(badge&&badge!==guarded){
    guarded=badge;
    new MutationObserver(()=>queueMicrotask(apply)).observe(badge,{childList:true,characterData:true,subtree:true});
  }
  apply();
}
function init(){
  guard();
  new MutationObserver(()=>guard()).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>setTimeout(apply,0));
  window.addEventListener('focus',()=>setTimeout(apply,0));
  setTimeout(guard,500);setTimeout(guard,1500);setTimeout(guard,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
