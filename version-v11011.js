const VERSION='1.1.011';
function freezeTopBadge(){
  const legacy=document.querySelector('.brand small');
  if(legacy){
    const fixed=document.createElement('span');
    fixed.className='app-version-static';
    fixed.textContent=`v${VERSION}`;
    fixed.style.cssText='font-size:10px;color:#A86A37;font-weight:800;letter-spacing:.3px;white-space:nowrap';
    legacy.replaceWith(fixed);
  }
  const fixed=document.querySelector('.app-version-static');
  if(fixed&&fixed.textContent!==`v${VERSION}`)fixed.textContent=`v${VERSION}`;
}
function freezeSidebarVersion(){
  const legacy=document.getElementById('wdSideVersion');
  if(legacy){legacy.id='wdSideVersionV11011';legacy.textContent=`v${VERSION}`;}
  const fixed=document.getElementById('wdSideVersionV11011');
  if(fixed&&fixed.textContent!==`v${VERSION}`)fixed.textContent=`v${VERSION}`;
}
function apply(){freezeTopBadge();freezeSidebarVersion();}
function init(){
  apply();
  new MutationObserver(()=>apply()).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>setTimeout(apply,0));
  window.addEventListener('focus',()=>setTimeout(apply,0));
  setTimeout(apply,500);setTimeout(apply,1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
