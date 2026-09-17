import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'classflow-auth-v1'}})
const $=id=>document.getElementById(id)
const flags=[{key:'重点',label:'重点 / Key',icon:'★'},{key:'考试',label:'考试 / Exam',icon:'✓'},{key:'没听懂',label:'没听懂 / Unsure',icon:'?'},{key:'例子',label:'例子 / Example',icon:'◇'}]
const state={
  user:null,recognition:null,active:false,shouldRestart:false,entries:[],interim:'',
  translator:null,translatorPromise:null,translatorKind:'',translationQueue:[],translationBusy:false
}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[m]||m))
const clock=()=>new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())
const key=()=>`classflow-local-v13-${state.user?.id||'guest'}`

function setStatus(t){if($('status'))$('status').textContent=t}
function setModelStatus(t){if($('modelStatus'))$('modelStatus').textContent=t}
function setLive(on){
  $('livePill')?.classList.toggle('active',on)
  if($('liveText'))$('liveText').textContent=on?'LIVE':'READY'
  $('recordButton')?.classList.toggle('stop',on)
  const icon=$('recordButton')?.querySelector('.record-icon');if(icon)icon.textContent=on?'■':'●'
  if($('recordLabel'))$('recordLabel').textContent=on?'暂停听课 / Pause':'开始听课 / Start'
}
function persist(){
  if(!state.user)return
  localStorage.setItem(key(),JSON.stringify({title:$('classTitle')?.value||'Mechatronics',lang:$('sourceLanguage')?.value||'en-US',entries:state.entries}))
}
function loadDraft(){try{return JSON.parse(localStorage.getItem(key())||'null')}catch{return null}}
function translationClass(e){return e.translationError?'error':''}
function render(){
  if($('recordCount'))$('recordCount').textContent=`${state.entries.length} 条记录 / records`
  const orig=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span>${(e.flags||[]).map(f=>`<b data-flag="${esc(f)}">${esc(f)}</b>`).join('')}</div><p>${esc(e.original)}</p></article>`).join('')
  const interim=state.interim?`<article class="speech-card interim"><div class="meta"><span>正在识别 / Listening</span></div><p>${esc(state.interim)}</p></article>`:''
  if($('originalStream'))$('originalStream').innerHTML=orig+interim||'<div class="empty-state"><p>点击“开始听课 / Start”，这里会显示识别出的课堂原文。</p></div>'

  const trans=state.entries.map(e=>`<article class="speech-card translated"><div class="meta"><span>${esc(e.time)}</span></div><p class="${translationClass(e)}">${esc(e.translation||'等待本地翻译… / Waiting for local translation')}</p><div class="flag-row">${flags.map(f=>`<button data-entry="${esc(e.id)}" data-flag="${esc(f.key)}" class="${(e.flags||[]).includes(f.key)?'selected':''}">${f.icon} ${esc(f.label)}</button>`).join('')}</div></article>`).join('')
  if($('translationStream'))$('translationStream').innerHTML=trans||'<div class="empty-state"><p><strong>本地翻译 / On-device Translation</strong><br>开始听课后，识别出的英文会在设备端翻译为中文。</p></div>'

  const review=state.entries.map(e=>`<article class="review-entry"><div class="review-meta"><span>${esc(e.time)}</span>${(e.flags||[]).map(f=>`<b data-flag="${esc(f)}">${esc(f)}</b>`).join('')}</div><p class="${translationClass(e)}">${esc(e.translation||'等待本地翻译…')}</p></article>`).join('')
  if($('reviewArea'))$('reviewArea').innerHTML=review||'<div class="empty-state"><p>这里会连续显示本地中文译文。</p></div>'

  if($('exportMd'))$('exportMd').disabled=!state.entries.length
  if($('exportWord'))$('exportWord').disabled=!state.entries.length
  document.querySelectorAll('.flag-row button').forEach(btn=>btn.onclick=()=>toggleFlag(btn.dataset.entry,btn.dataset.flag))
  persist()
  requestAnimationFrame(()=>['originalStream','translationStream','reviewArea'].forEach(id=>{const el=$(id);if(el)el.scrollTop=el.scrollHeight}))
}

function progressLabel(info){
  if(!info)return''
  if(typeof info.progress==='number')return `${Math.max(0,Math.min(100,Math.round(info.progress)))}%`
  if(typeof info.loaded==='number'&&typeof info.total==='number'&&info.total>0)return `${Math.round(info.loaded/info.total*100)}%`
  return''
}
async function ensureTranslator(){
  const lang=$('sourceLanguage')?.value||'en-US'
  if(lang==='zh-CN')return null
  if(lang!=='en-US')throw new Error('v13 本地模型暂先支持 English → 简体中文 / v13 local model currently supports English → Chinese')
  if(state.translator)return state.translator
  if(state.translatorPromise)return state.translatorPromise

  state.translatorPromise=(async()=>{
    setModelStatus('本地翻译模型：正在准备… / Preparing local translator…')
    const mod=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm')
    const {pipeline}=mod
    let last=''
    const translator=await pipeline('translation','Xenova/opus-mt-en-zh',{
      dtype:'q4',
      progress_callback:(info)=>{
        const pct=progressLabel(info)
        const file=String(info?.file||'').split('/').pop()
        const next=`本地翻译模型：${pct?`下载 ${pct}`:'加载中'}${file?` · ${file}`:''} / Local model ${pct?`download ${pct}`:'loading'}`
        if(next!==last){last=next;setModelStatus(next)}
      }
    })
    state.translator=translator;state.translatorKind='transformers'
    setModelStatus('本地翻译模型：已就绪 / Local translator ready')
    return translator
  })().catch(err=>{
    state.translatorPromise=null
    setModelStatus(`本地翻译模型失败 / Local translator failed: ${err?.message||err}`)
    throw err
  })
  return state.translatorPromise
}

function splitForTranslation(text,max=280){
  const cleaned=String(text||'').trim();if(!cleaned)return[]
  const pieces=cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const out=[];let buf=''
  for(const p of pieces){
    if(!buf){buf=p;continue}
    if((buf+' '+p).length<=max)buf+=' '+p
    else{out.push(buf);buf=p}
  }
  if(buf)out.push(buf)
  return out.length?out:[cleaned]
}
async function translateText(text){
  const lang=$('sourceLanguage')?.value||'en-US'
  if(lang==='zh-CN')return text
  const translator=await ensureTranslator()
  const parts=splitForTranslation(text),translated=[]
  for(const part of parts){
    const result=await translator(part,{max_new_tokens:256})
    translated.push(String(result?.[0]?.translation_text||'').trim())
  }
  return translated.filter(Boolean).join('')
}
function queueTranslation(entry){
  if(($('sourceLanguage')?.value||'en-US')==='zh-CN'){
    entry.translation=entry.original;entry.translationError=false;render();return
  }
  state.translationQueue.push(entry)
  drainTranslations()
}
async function drainTranslations(){
  if(state.translationBusy)return
  state.translationBusy=true
  try{
    while(state.translationQueue.length){
      const entry=state.translationQueue.shift()
      if(!entry)continue
      entry.translation='本地翻译中… / Translating locally';entry.translationError=false;render()
      try{
        entry.translation=await translateText(entry.original)
        entry.translationError=false
      }catch(err){
        entry.translation=`⚠ ${err?.message||'本地翻译失败 / Local translation failed'}`
        entry.translationError=true
      }
      render()
    }
  }finally{state.translationBusy=false}
}
function addFinal(text){
  const entry={id:crypto.randomUUID(),time:clock(),original:text.trim(),translation:'等待本地翻译… / Waiting for local translation',translationError:false,flags:[]}
  state.entries.push(entry);state.interim='';render();queueTranslation(entry)
}

function makeRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!Recognition){setStatus('当前浏览器不支持网页语音识别 / SpeechRecognition unavailable');return null}
  const r=new Recognition()
  r.lang=$('sourceLanguage')?.value||'en-US';r.continuous=true;r.interimResults=true;r.maxAlternatives=1
  r.onstart=()=>setStatus('BETA 2.0 · v13 · 正在识别并本地翻译 / Listening + local translation')
  r.onresult=ev=>{
    let inter=''
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const res=ev.results[i],text=(res[0]?.transcript||'').trim();if(!text)continue
      if(res.isFinal)addFinal(text);else inter+=(inter?' ':'')+text
    }
    state.interim=inter.trim();render()
  }
  r.onerror=ev=>{
    if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){
      state.shouldRestart=false;state.active=false;setLive(false);setStatus('麦克风或语音识别权限被拒绝，请允许麦克风 / Permission denied');return
    }
    if(ev.error==='network')setStatus('浏览器语音服务网络异常 / Browser speech network error')
    else if(ev.error!=='no-speech'&&ev.error!=='aborted')setStatus(`语音识别异常 / Speech recognition error: ${ev.error}`)
  }
  r.onend=()=>{state.interim='';if(state.shouldRestart&&state.active)setTimeout(()=>{try{r.start()}catch{}},350);else render()}
  return r
}
function start(){
  if(state.active)return
  const r=makeRecognition();if(!r)return
  state.recognition=r;state.active=true;state.shouldRestart=true;setLive(true)
  if(($('sourceLanguage')?.value||'en-US')==='en-US')ensureTranslator().then(()=>drainTranslations()).catch(()=>{})
  else if(($('sourceLanguage')?.value||'en-US')==='zh-CN')setModelStatus('中文原文：无需翻译 / Chinese source · no translation needed')
  else setModelStatus('俄语本地翻译暂未加入 v13 / Russian local translation not in v13 yet')
  try{r.start()}catch(err){state.active=false;state.shouldRestart=false;setLive(false);setStatus(`无法启动语音识别 / Could not start: ${err?.message||err}`)}
}
function stop(){state.shouldRestart=false;state.active=false;state.interim='';try{state.recognition?.stop()}catch{};state.recognition=null;setLive(false);setStatus('已暂停 / Paused');render()}

function toggleFlag(id,flag){const e=state.entries.find(x=>x.id===id);if(!e)return;e.flags=e.flags.includes(flag)?e.flags.filter(x=>x!==flag):[...e.flags,flag];render()}
function markLatest(flag){const e=state.entries.at(-1);if(e)toggleFlag(e.id,flag)}
function blobDownload(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${$('classTitle')?.value||'课堂记录'}_${new Date().toISOString().slice(0,10)}.${ext}`;a.click();URL.revokeObjectURL(url)}
function exportMd(){blobDownload(`# ${$('classTitle')?.value||'课堂记录'}\n\n`+state.entries.map(e=>`### ${e.time}${e.flags?.length?` · ${e.flags.join(' / ')}`:''}\n\n**原文 / Original**：${e.original}\n\n**翻译 / Translation**：${e.translation||''}`).join('\n\n'),'text/markdown;charset=utf-8','md')}
function exportWord(){const body=state.entries.map(e=>`<h3>${esc(e.time)}${e.flags?.length?' · '+esc(e.flags.join(' / ')):''}</h3><p><b>原文 / Original：</b>${esc(e.original)}</p><p><b>翻译 / Translation：</b>${esc(e.translation||'')}</p>`).join('');blobDownload('\ufeff'+`<!doctype html><meta charset="utf-8"><body><h1>${esc($('classTitle')?.value||'课堂记录')}</h1>${body}</body>`,'application/msword','doc')}
function showAuthMessage(msg,bad=false){if(!$('authMessage'))return;$('authMessage').textContent=msg;$('authMessage').classList.toggle('bad',bad)}
async function enter(session){
  state.user=session?.user||null
  if(!state.user){$('authGate').hidden=false;$('appShell').hidden=true;return}
  $('authGate').hidden=true;$('appShell').hidden=false;if($('accountEmail'))$('accountEmail').textContent=state.user.email||'已登录'
  const draft=loadDraft();if(draft?.title&&$('classTitle'))$('classTitle').value=draft.title;if(draft?.lang&&$('sourceLanguage'))$('sourceLanguage').value=draft.lang;if(Array.isArray(draft?.entries))state.entries=draft.entries.map(e=>({...e,id:e.id||crypto.randomUUID(),flags:e.flags||[]}))
  render();setStatus('BETA 2.0 · v13 · 本地识别 + 本地英中翻译 / Local speech + local EN→ZH')
  setModelStatus('本地翻译模型：点击开始后加载 / Local model loads when Start is tapped')
}

$('authForm').onsubmit=async e=>{e.preventDefault();showAuthMessage('正在登录… / Signing in');const {error}=await supabase.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});if(error){const raw=error.message||'';showAuthMessage(/invalid login credentials/i.test(raw)?'邮箱或密码不正确；没有账号请先注册。 / Incorrect email or password; sign up first if needed.':raw,true)}else showAuthMessage('登录成功 / Signed in')}
$('signupButton').onclick=async()=>{const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email)return showAuthMessage('请填写邮箱 / Enter email',true);if(password.length<6)return showAuthMessage('密码至少 6 位 / Password must be 6+ characters',true);showAuthMessage('正在注册… / Signing up');const {data,error}=await supabase.auth.signUp({email,password});if(error)return showAuthMessage(error.message,true);if(data.session)showAuthMessage('注册成功并已登录 / Signed up and signed in');else showAuthMessage('注册成功；若项目要求邮箱验证，请完成验证后登录。 / Signed up; verify email if required.')}
$('logoutButton').onclick=async()=>{stop();await supabase.auth.signOut();state.entries=[];await enter(null)}
$('recordButton').onclick=()=>state.active?stop():start()
$('newSession').onclick=()=>{stop();state.entries=[];state.interim='';state.translationQueue=[];if($('classTitle'))$('classTitle').value='新课堂 / New Class';render();setStatus('已新建本地课堂 / New local class')}
$('sourceLanguage').onchange=()=>{if(state.active)stop();state.translator=null;state.translatorPromise=null;state.translatorKind='';state.translationQueue=[];persist();setModelStatus('本地翻译模型：点击开始后加载 / Local model loads when Start is tapped');setStatus('语言已切换，请重新开始 / Language changed; tap Start again')}
$('classTitle').oninput=persist
$('exportMd').onclick=exportMd;$('exportWord').onclick=exportWord
$('quickFlags').querySelectorAll('button').forEach(b=>b.onclick=()=>markLatest(b.dataset.flag))
$('historyButton').onclick=()=>setStatus('v13 本地课堂暂不读取云端历史 / Cloud history is off in v13 local mode')
$('accountButton').onclick=()=>{$('accountPopover').hidden=!$('accountPopover').hidden}
$('generateNotes').disabled=true
window.addEventListener('beforeunload',()=>{state.shouldRestart=false;try{state.recognition?.stop()}catch{}})
supabase.auth.onAuthStateChange((_event,session)=>enter(session))
const {data:{session}}=await supabase.auth.getSession();await enter(session)
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})
