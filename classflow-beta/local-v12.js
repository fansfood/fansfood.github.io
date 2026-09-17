import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'classflow-auth-v1'}})
const $=id=>document.getElementById(id)
const state={user:null,recognition:null,active:false,shouldRestart:false,entries:[],interim:''}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const clock=()=>new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())
const key=()=>`classflow-local-v12-${state.user?.id||'guest'}`

function setStatus(t){if($('status'))$('status').textContent=t}
function setLive(on){
  $('livePill')?.classList.toggle('active',on)
  if($('liveText'))$('liveText').textContent=on?'LIVE':'READY'
  $('recordButton')?.classList.toggle('stop',on)
  const icon=$('recordButton')?.querySelector('.record-icon');if(icon)icon.textContent=on?'■':'●'
  if($('recordLabel'))$('recordLabel').textContent=on?'暂停听课 / Pause':'开始听课 / Start'
}
function persist(){if(!state.user)return;localStorage.setItem(key(),JSON.stringify({title:$('classTitle')?.value||'Mechatronics',lang:$('sourceLanguage')?.value||'en-US',entries:state.entries}))}
function loadDraft(){try{return JSON.parse(localStorage.getItem(key())||'null')}catch{return null}}
function render(){
  if($('recordCount'))$('recordCount').textContent=`${state.entries.length} 条记录 / records`
  const cards=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span></div><p>${esc(e.original)}</p></article>`).join('')
  const interim=state.interim?`<article class="speech-card interim"><div class="meta"><span>正在识别 / Listening</span></div><p>${esc(state.interim)}</p></article>`:''
  if($('originalStream'))$('originalStream').innerHTML=cards+interim||'<div class="empty-state"><p>点击“开始听课 / Start”，这里会显示识别出的课堂原文。</p></div>'
  const off='<div class="empty-state"><p><strong>本地优先模式 / Local First</strong><br>v12 暂不调用 OpenAI，先保证课堂原文稳定识别。</p></div>'
  if($('translationStream'))$('translationStream').innerHTML=off
  if($('reviewArea'))$('reviewArea').innerHTML=off
  if($('exportMd'))$('exportMd').disabled=!state.entries.length
  if($('exportWord'))$('exportWord').disabled=!state.entries.length
  persist()
  requestAnimationFrame(()=>{const el=$('originalStream');if(el)el.scrollTop=el.scrollHeight})
}
function makeRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!Recognition){setStatus('当前浏览器不支持网页语音识别 / SpeechRecognition unavailable');return null}
  const r=new Recognition()
  r.lang=$('sourceLanguage')?.value||'en-US';r.continuous=true;r.interimResults=true;r.maxAlternatives=1
  r.onstart=()=>setStatus('BETA 2.0 · v12 · 本地识别中，不调用 OpenAI / Local speech active · no OpenAI')
  r.onresult=ev=>{
    let inter=''
    for(let i=ev.resultIndex;i<ev.results.length;i++){
      const res=ev.results[i],text=(res[0]?.transcript||'').trim();if(!text)continue
      if(res.isFinal){state.entries.push({time:clock(),original:text});state.interim=''}else inter+=(inter?' ':'')+text
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
  try{r.start()}catch(err){state.active=false;state.shouldRestart=false;setLive(false);setStatus(`无法启动语音识别 / Could not start: ${err?.message||err}`)}
}
function stop(){state.shouldRestart=false;state.active=false;state.interim='';try{state.recognition?.stop()}catch{};state.recognition=null;setLive(false);setStatus('已暂停 / Paused');render()}
function blobDownload(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${$('classTitle')?.value||'课堂记录'}_${new Date().toISOString().slice(0,10)}.${ext}`;a.click();URL.revokeObjectURL(url)}
function exportMd(){blobDownload(`# ${$('classTitle')?.value||'课堂记录'}\n\n`+state.entries.map(e=>`### ${e.time}\n\n${e.original}`).join('\n\n'),'text/markdown;charset=utf-8','md')}
function exportWord(){const body=state.entries.map(e=>`<h3>${esc(e.time)}</h3><p>${esc(e.original)}</p>`).join('');blobDownload('\ufeff'+`<!doctype html><meta charset="utf-8"><body><h1>${esc($('classTitle')?.value||'课堂记录')}</h1>${body}</body>`,'application/msword','doc')}
function showAuthMessage(msg,bad=false){if(!$('authMessage'))return;$('authMessage').textContent=msg;$('authMessage').classList.toggle('bad',bad)}
async function enter(session){
  state.user=session?.user||null
  if(!state.user){$('authGate').hidden=false;$('appShell').hidden=true;return}
  $('authGate').hidden=true;$('appShell').hidden=false;if($('accountEmail'))$('accountEmail').textContent=state.user.email||'已登录'
  const draft=loadDraft();if(draft?.title&&$('classTitle'))$('classTitle').value=draft.title;if(draft?.lang&&$('sourceLanguage'))$('sourceLanguage').value=draft.lang;if(Array.isArray(draft?.entries))state.entries=draft.entries
  render();setStatus('BETA 2.0 · v12 · 本地优先，不调用 OpenAI / Local first · no OpenAI')
}

$('authForm').onsubmit=async e=>{e.preventDefault();showAuthMessage('正在登录… / Signing in');const {error}=await supabase.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});if(error){const raw=error.message||'';showAuthMessage(/invalid login credentials/i.test(raw)?'邮箱或密码不正确；没有账号请先注册。 / Incorrect email or password; sign up first if needed.':raw,true)}else showAuthMessage('登录成功 / Signed in')}
$('signupButton').onclick=async()=>{const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email)return showAuthMessage('请填写邮箱 / Enter email',true);if(password.length<6)return showAuthMessage('密码至少 6 位 / Password must be 6+ characters',true);showAuthMessage('正在注册… / Signing up');const {data,error}=await supabase.auth.signUp({email,password});if(error)return showAuthMessage(error.message,true);if(data.session)showAuthMessage('注册成功并已登录 / Signed up and signed in');else showAuthMessage('注册成功；若项目要求邮箱验证，请完成验证后登录。 / Signed up; verify email if required.')}
$('logoutButton').onclick=async()=>{stop();await supabase.auth.signOut();state.entries=[];await enter(null)}
$('recordButton').onclick=()=>state.active?stop():start()
$('newSession').onclick=()=>{stop();state.entries=[];state.interim='';if($('classTitle'))$('classTitle').value='新课堂 / New Class';render();setStatus('已新建本地课堂 / New local class')}
$('sourceLanguage').onchange=()=>{if(state.active)stop();persist();setStatus('语言已切换，请重新开始 / Language changed; tap Start again')}
$('classTitle').oninput=persist
$('exportMd').onclick=exportMd;$('exportWord').onclick=exportWord
$('historyButton').onclick=()=>setStatus('v12 本地优先模式暂不读取云端历史 / Cloud history is off in local-first v12')
$('accountButton').onclick=()=>{$('accountPopover').hidden=!$('accountPopover').hidden}
$('generateNotes').disabled=true
window.addEventListener('beforeunload',()=>{state.shouldRestart=false;try{state.recognition?.stop()}catch{}})
supabase.auth.onAuthStateChange((_event,session)=>enter(session))
const {data:{session}}=await supabase.auth.getSession();await enter(session)
