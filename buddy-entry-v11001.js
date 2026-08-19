const VERSION='1.1.001';
const $=(s,r=document)=>r.querySelector(s);

const buddyIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7a3 3 0 0 0 6 0V2M6 2v20M15 2v8c0 2 1.5 3 3 3h1V2M18 13v9"/></svg>';

function goBuddy(){
  if(location.hash==='#buddies') window.SHIGUANG_SHOW_ROUTE?.();
  else location.hash='#buddies';
}

function patchVersion(){
  const oldBadge=$('.brand small');
  if(oldBadge) oldBadge.textContent=`v${VERSION}`;
  const sideVersion=$('.et-brand span');
  if(sideVersion) sideVersion.textContent=`EATING TIME · v${VERSION}`;
}

function ensureHomeEntry(){
  const home=$('#etHomeDashboard .et-home');
  if(!home) return false;
  if($('#etBuddyQuickEntry',home)) return true;
  const section=document.createElement('section');
  section.id='etBuddyQuickEntry';
  section.className='card et-buddy-quick';
  section.innerHTML=`<div class="et-buddy-quick-icon">${buddyIcon}</div><div class="et-buddy-quick-copy"><span class="eyebrow">FOOD BUDDIES</span><h3>饭搭子</h3><p>和好朋友一起记录今天吃了什么、吃了多少，也顺手看看今天有没有运动。</p></div><button class="et-buddy-quick-cta" type="button">进入饭搭子 →</button>`;
  section.querySelector('button').addEventListener('click',goBuddy);
  section.addEventListener('click',event=>{
    if(event.target.closest('button')) return;
    goBuddy();
  });
  const primary=$('.et-home-primary',home);
  if(primary) primary.insertAdjacentElement('afterend',section);
  else home.prepend(section);
  return true;
}

function ensureSheetEntry(){
  const actions=$('#etActionSheet .et-sheet-actions');
  if(!actions) return false;
  if(actions.querySelector('[data-sheet-go="#buddies"]')) return true;
  const button=document.createElement('button');
  button.type='button';
  button.className='et-sheet-action';
  button.dataset.sheetGo='#buddies';
  button.innerHTML=`${buddyIcon}<div><b>打开饭搭子</b><span>看看朋友今天吃了什么、有没有运动</span></div>`;
  button.addEventListener('click',()=>{
    $('#etActionSheet')?.classList.remove('open');
    $('#etSheetBackdrop')?.classList.remove('open');
    goBuddy();
  });
  const first=actions.firstElementChild;
  first ? first.insertAdjacentElement('afterend',button) : actions.appendChild(button);
  return true;
}

function installHomeGuard(){
  const root=$('#etHomeDashboard');
  if(!root||root.dataset.buddyEntryGuard==='1') return;
  root.dataset.buddyEntryGuard='1';
  const observer=new MutationObserver(()=>ensureHomeEntry());
  observer.observe(root,{childList:true});
}

function sync(){
  patchVersion();
  ensureHomeEntry();
  ensureSheetEntry();
  installHomeGuard();
}

function init(){
  let tries=0;
  const tick=()=>{
    sync();
    tries+=1;
    if(tries<40&&(!$('#etBuddyQuickEntry')||!$('#etActionSheet .et-sheet-actions'))) setTimeout(tick,100);
  };
  tick();
  window.addEventListener('hashchange',()=>{patchVersion();if(location.hash==='#home')setTimeout(ensureHomeEntry,20)});
  window.addEventListener('shiguang-profile-ready',()=>setTimeout(sync,20));
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
