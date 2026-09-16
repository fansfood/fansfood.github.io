import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL = 'https://wcjcbbnvaejwynnrhfld.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3'
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

const $ = (id) => document.getElementById(id)
const flags = [{key:'重点',label:'重点 / Key',icon:'★'},{key:'考试',label:'考试 / Exam',icon:'✓'},{key:'没听懂',label:'没听懂 / Unsure',icon:'?'},{key:'例子',label:'例子 / Example',icon:'◇'}]
const state = {
  user: null, sessionId: null, entries: [], notes: '', isListening: false,
  interim: '', recognition: null, shouldRestart: false, aiReady: null,
  saving: 0, history: [], titleTimer: null,
}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function time(){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
function dateTime(v){try{return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return ''}}
function empty(text){return `<div class="empty-state"><div class="empty-wave"><i></i><i></i><i></i><i></i><i></i></div><p>${esc(text)}</p></div>`}
function setStatus(text){$('status').textContent=text}
function setSync(busy=false){state.saving=Math.max(0,state.saving+(busy?1:-1));$('syncPill').textContent=state.saving?'☁ 同步中… / Syncing':'☁ 已同步 / Synced'}
function localKey(){return `classflow-draft-${state.user?.id||'guest'}`}
function persistLocal(){if(!state.user)return;localStorage.setItem(localKey(),JSON.stringify({sessionId:state.sessionId,title:$('classTitle').value,sourceLanguage:$('sourceLanguage').value,entries:state.entries,notes:state.notes}))}
function clearLocal(){localStorage.removeItem(localKey())}

function render(){
  $('recordCount').textContent=`${state.entries.length} 条记录 / records`
  $('livePill').classList.toggle('active',state.isListening)
  $('liveText').textContent=state.isListening?'LIVE':'READY'
  $('recordButton').classList.toggle('stop',state.isListening)
  $('recordLabel').textContent=state.isListening?'暂停听课 / Pause':'开始听课 / Start'
  $('recordButton').querySelector('.record-icon').textContent=state.isListening?'■':'●'

  const orig=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span>${e.flags.map(f=>`<b>${esc(f)}</b>`).join('')}</div><p>${esc(e.original)}</p></article>`).join('')
  $('originalStream').innerHTML=orig+(state.interim?`<article class="speech-card interim"><div class="meta"><span>正在识别 / Listening</span></div><p>${esc(state.interim)}</p></article>`:'') || empty('点击下方“开始听课 / Start”，老师的讲话会显示在这里。 / Tap Start and the teacher’s speech will appear here.')
  const trans=state.entries.map(e=>`<article class="speech-card translated"><div class="meta"><span>${esc(e.time)}</span></div><p class="${e.translation?.startsWith('⚠')?'error':''}">${esc(e.translation||'翻译中… / Translating')}</p><div class="flag-row">${flags.map(f=>`<button data-entry="${esc(e.id)}" data-flag="${esc(f.key)}" class="${e.flags.includes(f.key)?'selected':''}">${f.icon} ${esc(f.label||f.key)}</button>`).join('')}</div></article>`).join('')
  $('translationStream').innerHTML=trans||empty('识别完成后会自动翻译，并和原文按时间对应。 / Translation appears automatically after recognition and stays aligned by time.')
  $('notesArea').innerHTML=state.notes?`<pre>${esc(state.notes)}</pre>`:empty('下课后点击“生成 AI 课堂笔记 / Generate AI Notes”。 / Generate AI notes after class.')
  $('generateNotes').disabled=!state.entries.length || state.aiReady===false
  $('exportMd').disabled=$('exportWord').disabled=!state.entries.length
  $('aiNotice').hidden=state.aiReady!==false
  document.querySelectorAll('.flag-row button').forEach(btn=>btn.onclick=()=>toggleFlag(btn.dataset.entry,btn.dataset.flag))
  persistLocal()
  requestAnimationFrame(()=>['originalStream','translationStream'].forEach(id=>{const el=$(id);el.scrollTop=el.scrollHeight}))
}

async function ensureCloudSession(){
  if(state.sessionId)return state.sessionId
  setSync(true)
  const {data,error}=await supabase.from('classflow_sessions').insert({title:$('classTitle').value||'未命名课堂 / Untitled Class',source_language:$('sourceLanguage').value,target_language:'zh-CN'}).select('id').single()
  setSync(false)
  if(error){setStatus(`云端创建失败 / Cloud create failed: ${error.message}`);throw error}
  state.sessionId=data.id; persistLocal(); loadHistory(); return state.sessionId
}

async function saveSegment(entry){
  try{
    const sessionId=await ensureCloudSession(); setSync(true)
    const {data,error}=await supabase.from('classflow_segments').insert({session_id:sessionId,seq:entry.seq,source_text:entry.original,translation:entry.translation==='翻译中… / Translating'?'':entry.translation,flags:entry.flags}).select('id').single()
    setSync(false); if(error)throw error; entry.cloudId=data.id; persistLocal()
  }catch(err){setSync(false);setStatus(`字幕已保存在本机，云同步失败 / Saved locally; cloud sync failed: ${err.message||err}`)}
}

async function updateSegment(entry,patch){
  if(!entry.cloudId)return
  setSync(true); const {error}=await supabase.from('classflow_segments').update(patch).eq('id',entry.cloudId); setSync(false)
  if(error)setStatus(`云同步失败 / Cloud sync failed: ${error.message}`)
}

async function callAI(body){
  const {data,error}=await supabase.functions.invoke('classflow-ai',{body})
  if(error){
    let msg=error.message||'AI 请求失败 / AI request failed'
    try{const ctx=await error.context?.json?.(); if(ctx?.error)msg=ctx.error}catch{}
    throw new Error(msg)
  }
  return data
}

async function checkAI(){
  try{const data=await callAI({action:'health'});state.aiReady=Boolean(data?.openaiConfigured)}
  catch{state.aiReady=false}
  render()
}

async function translateEntry(entry){
  if($('sourceLanguage').value==='zh-CN'){entry.translation=entry.original;await updateSegment(entry,{translation:entry.translation});render();return}
  if(state.aiReady===false){entry.translation='⚠ AI 翻译后端尚未配置 / AI translation backend not configured';render();return}
  try{
    const d=await callAI({action:'translate',text:entry.original,sourceLanguage:$('sourceLanguage').value,courseTitle:$('classTitle').value})
    entry.translation=d.translation||''; await updateSegment(entry,{translation:entry.translation})
  }catch(err){entry.translation=`⚠ ${err.message||'翻译失败 / Translation failed'}`}
  render()
}

async function addFinal(text){
  const entry={id:crypto.randomUUID(),cloudId:null,seq:state.entries.length+1,time:time(),original:text.trim(),translation:'翻译中… / Translating',flags:[]}
  state.entries.push(entry);state.interim='';render();await saveSegment(entry);translateEntry(entry)
}

function createRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!Recognition){setStatus('此浏览器暂不支持网页实时语音识别。 / This browser does not support live web speech recognition. Please use the latest Chrome, Edge, or Safari.');return null}
  const r=new Recognition();r.lang=$('sourceLanguage').value;r.continuous=true;r.interimResults=true
  r.onresult=(ev)=>{let inter='';for(let i=ev.resultIndex;i<ev.results.length;i++){const result=ev.results[i],text=result[0].transcript.trim();if(!text)continue;if(result.isFinal)addFinal(text);else inter+=text+' '}state.interim=inter.trim();render()}
  r.onerror=(ev)=>{if(ev.error==='not-allowed'){state.shouldRestart=false;state.isListening=false;setStatus('麦克风权限被拒绝，请在浏览器网站权限中允许麦克风。 / Microphone access was denied; allow it in site permissions.');render()}else if(ev.error!=='no-speech'){setStatus(`语音识别异常 / Speech recognition error: ${ev.error}`)}}
  r.onend=()=>{state.interim='';if(state.shouldRestart){setTimeout(()=>{try{r.start()}catch{}},250)}else render()}
  return r
}

async function start(){
  if(state.isListening)return
  try{await ensureCloudSession()}catch{return}
  const r=createRecognition();if(!r)return
  state.recognition=r;state.shouldRestart=true
  try{r.start();state.isListening=true;setStatus('正在听课、翻译并自动保存 / Listening, translating, and auto-saving');render()}catch{setStatus('无法启动麦克风，请刷新页面后重试。 / Could not start the microphone; refresh and try again.')}
}
function stop(){state.shouldRestart=false;state.recognition?.stop();state.isListening=false;state.interim='';setStatus('已暂停，课堂记录已保存 / Paused · class record saved');render()}

async function toggleFlag(id,flag){
  const e=state.entries.find(x=>x.id===id);if(!e)return
  e.flags=e.flags.includes(flag)?e.flags.filter(x=>x!==flag):[...e.flags,flag];render();await updateSegment(e,{flags:e.flags})
}
function markLatest(flag){const e=state.entries.at(-1);if(e)toggleFlag(e.id,flag)}

async function generateNotes(){
  if(!state.entries.length||state.aiReady===false)return
  const b=$('generateNotes');b.disabled=true;b.textContent='正在整理… / Generating';setStatus('正在生成课堂笔记 / Generating class notes')
  try{
    const d=await callAI({action:'notes',title:$('classTitle').value,entries:state.entries})
    state.notes=d.notes||'';render();await ensureCloudSession();setSync(true)
    const {error}=await supabase.from('classflow_sessions').update({notes:state.notes,updated_at:new Date().toISOString()}).eq('id',state.sessionId);setSync(false)
    if(error)throw error;setStatus('AI 课堂笔记已生成并保存 / AI class notes generated and saved')
  }catch(err){setSync(false);setStatus(err.message||'生成笔记失败 / Note generation failed')}
  finally{b.textContent='生成 AI 课堂笔记 / Generate AI Notes';render()}
}

function blobDownload(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${$('classTitle').value||'课堂记录'}_${new Date().toISOString().slice(0,10)}.${ext}`;a.click();URL.revokeObjectURL(url)}
function exportMd(){const body=state.entries.map(e=>`### ${e.time}${e.flags.length?` · ${e.flags.join(' / ')}`:''}\n\n**原文 / Original**：${e.original}\n\n**翻译 / Translation**：${e.translation}\n`).join('\n');blobDownload(`# ${$('classTitle').value}\n\n${body}${state.notes?`\n---\n\n# AI 课堂笔记 / AI Class Notes\n\n${state.notes}`:''}`,'text/markdown;charset=utf-8','md')}
function exportWord(){const rows=state.entries.map(e=>`<div class="entry"><h3>${esc(e.time)}${e.flags.length?' · '+esc(e.flags.join(' / ')):''}</h3><p><b>原文 / Original：</b>${esc(e.original)}</p><p><b>翻译 / Translation：</b>${esc(e.translation)}</p></div>`).join('');const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.7;padding:28px}h1{font-size:24px}.entry{margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid #ddd}h3{font-size:14px;color:#666}p{font-size:12pt}.notes{white-space:pre-wrap}</style></head><body><h1>${esc($('classTitle').value)}</h1>${rows}${state.notes?`<h1>AI 课堂笔记 / AI Class Notes</h1><div class="notes">${esc(state.notes)}</div>`:''}</body></html>`;blobDownload('\ufeff'+html,'application/msword','doc')}

async function newSession(){
  stop();state.sessionId=null;state.entries=[];state.notes='';state.interim='';clearLocal();$('classTitle').value='新课堂 / New Class';setStatus('已新建课堂，点击“开始听课 / Start” / New class created; tap Start');render();await loadHistory()
}

async function loadHistory(){
  if(!state.user)return
  const {data,error}=await supabase.from('classflow_sessions').select('id,title,source_language,started_at,notes').order('started_at',{ascending:false}).limit(30)
  if(error)return
  state.history=data||[]
  $('historyList').innerHTML=state.history.length?state.history.map(s=>`<button class="history-item" data-id="${s.id}"><strong>${esc(s.title)}</strong><span>${dateTime(s.started_at)} · ${esc(s.source_language)}</span></button>`).join(''):empty('还没有云端课堂记录。 / No cloud class records yet.')
  document.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>loadSession(b.dataset.id))
}

async function loadSession(id){
  stop();setStatus('正在读取云端课堂… / Loading class from cloud')
  const {data:s,error:e1}=await supabase.from('classflow_sessions').select('*').eq('id',id).single()
  const {data:segs,error:e2}=await supabase.from('classflow_segments').select('*').eq('session_id',id).order('seq')
  if(e1||e2){setStatus(`读取失败 / Load failed: ${(e1||e2).message}`);return}
  state.sessionId=s.id;state.notes=s.notes||'';$('classTitle').value=s.title;$('sourceLanguage').value=s.source_language
  state.entries=(segs||[]).map(x=>({id:crypto.randomUUID(),cloudId:x.id,seq:x.seq,time:new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(x.occurred_at)),original:x.source_text,translation:x.translation||'',flags:x.flags||[]}))
  closeHistory();setStatus('已载入云端课堂记录 / Cloud class loaded');render()
}

function openHistory(){$('historyDrawer').classList.add('open');$('historyDrawer').setAttribute('aria-hidden','false');$('drawerMask').hidden=false;loadHistory()}
function closeHistory(){$('historyDrawer').classList.remove('open');$('historyDrawer').setAttribute('aria-hidden','true');$('drawerMask').hidden=true}

async function saveSessionMeta(){
  if(!state.sessionId)return
  const payload={title:$('classTitle').value||'未命名课堂 / Untitled Class',source_language:$('sourceLanguage').value,updated_at:new Date().toISOString()}
  setSync(true);const {error}=await supabase.from('classflow_sessions').update(payload).eq('id',state.sessionId);setSync(false);if(error)setStatus(`云同步失败 / Cloud sync failed: ${error.message}`)
}

async function signIn(email,password){const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error}
async function signUp(email,password){const {data,error}=await supabase.auth.signUp({email,password});if(error)throw error;return data}
function showAuthMessage(msg,bad=false){$('authMessage').textContent=msg;$('authMessage').classList.toggle('bad',bad)}

async function enterApp(session){
  state.user=session?.user||null
  if(!state.user){$('authGate').hidden=false;$('appShell').hidden=true;return}
  $('authGate').hidden=true;$('appShell').hidden=false;$('accountEmail').textContent=state.user.email||'已登录'
  const draft=JSON.parse(localStorage.getItem(localKey())||'null')
  if(draft?.title)$('classTitle').value=draft.title
  if(draft?.sourceLanguage)$('sourceLanguage').value=draft.sourceLanguage
  if(Array.isArray(draft?.entries))state.entries=draft.entries
  if(draft?.notes)state.notes=draft.notes
  if(draft?.sessionId)state.sessionId=draft.sessionId
  setStatus('云端已连接 / Cloud connected');render();await Promise.all([loadHistory(),checkAI()])
}

$('authForm').onsubmit=async(e)=>{e.preventDefault();showAuthMessage('正在登录… / Signing in');try{await signIn($('authEmail').value.trim(),$('authPassword').value);showAuthMessage('登录成功 / Signed in')}catch(err){showAuthMessage(err.message||'登录失败 / Sign-in failed',true)}}
$('signupButton').onclick=async()=>{showAuthMessage('正在注册… / Signing up');try{const d=await signUp($('authEmail').value.trim(),$('authPassword').value);showAuthMessage(d.session?'注册并登录成功 / Signed up and signed in':'注册成功，请检查邮箱完成确认后再登录 / Sign-up complete; check your email before signing in')}catch(err){showAuthMessage(err.message||'注册失败 / Sign-up failed',true)}}
$('logoutButton').onclick=async()=>{stop();await supabase.auth.signOut();state.user=null;state.sessionId=null;state.entries=[];state.notes='';$('accountPopover').hidden=true;await enterApp(null)}
$('recordButton').onclick=()=>state.isListening?stop():start()
$('generateNotes').onclick=generateNotes
$('exportMd').onclick=exportMd
$('exportWord').onclick=exportWord
$('quickFlags').querySelectorAll('button').forEach(b=>b.onclick=()=>markLatest(b.dataset.flag))
$('sourceLanguage').onchange=()=>{if(state.isListening)stop();persistLocal();saveSessionMeta()}
$('classTitle').oninput=()=>{persistLocal();clearTimeout(state.titleTimer);state.titleTimer=setTimeout(saveSessionMeta,700)}
$('newSession').onclick=newSession
$('historyButton').onclick=openHistory;$('closeHistory').onclick=closeHistory;$('drawerMask').onclick=closeHistory
$('accountButton').onclick=()=>{$('accountPopover').hidden=!$('accountPopover').hidden}
window.addEventListener('beforeunload',()=>{state.shouldRestart=false;state.recognition?.stop()})

document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.isListening)setStatus('页面在后台，部分手机会暂停麦克风；回到页面后会自动尝试继续。 / Some phones pause the microphone in the background; ClassFlow will try to resume when you return.')})
supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==state.user?.id)enterApp(session)})
const {data:{session}}=await supabase.auth.getSession();await enterApp(session)
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})
