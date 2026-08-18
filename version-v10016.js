const APP_VERSION='1.0.016';
function apply(){const badge=document.querySelector('.brand small');if(badge&&badge.textContent!==`v${APP_VERSION}`)badge.textContent=`v${APP_VERSION}`;}
function init(){apply();const badge=document.querySelector('.brand small');if(badge)new MutationObserver(apply).observe(badge,{childList:true,characterData:true,subtree:true});window.addEventListener('hashchange',apply);window.addEventListener('focus',apply);setTimeout(apply,600);setTimeout(apply,1600);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
