const VERSION='1.1.010';
function apply(){
  const badge=document.querySelector('.brand small');
  if(badge&&badge.textContent!==`v${VERSION}`)badge.textContent=`v${VERSION}`;
  const side=document.getElementById('wdSideVersion');
  if(side&&side.textContent!==`v${VERSION}`)side.textContent=`v${VERSION}`;
}
function detachLegacyBadgeObserver(){
  const badge=document.querySelector('.brand small');
  if(badge){
    const clean=badge.cloneNode(true);
    clean.textContent=`v${VERSION}`;
    badge.replaceWith(clean);
  }
  apply();
}
function init(){
  // Warm Dining v1.1.009 内部曾监听旧版本角标；延迟替换节点可安全断开旧 observer。
  setTimeout(detachLegacyBadgeObserver,900);
  setTimeout(detachLegacyBadgeObserver,2400);
  setTimeout(detachLegacyBadgeObserver,4800);
  window.addEventListener('hashchange',()=>setTimeout(apply,40));
  window.addEventListener('focus',()=>setTimeout(apply,40));
  window.addEventListener('fansfood-account-changed',()=>setTimeout(apply,60));
  window.addEventListener('fansfood-group-changed',()=>setTimeout(apply,60));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
