import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'classflow-auth-v1'}})
const $=id=>document.getElementById(id)
const flagDefs=[{key:'重点',label:'重点 / Key',icon:'★'},{key:'考试',label:'考试 / Exam',icon:'✓'},{key:'没听懂',label:'没听懂 / Unsure',icon:'?'},{key:'例子',label:'例子 / Example',icon:'◇'}]
const state={
  user:null,sessionId:null,entries:[],history:[],isListening:false,interim:'',recognition:null,shouldRestart:false,
  pendingSegment:null,pendingTimer:null,saving:0,latencies:[],providerHealth:null,lastProvider:'',lastModel:'',
  micStream:null,peer:null,dataChannel:null,rtInterim:new Map(),realtimeStoppedAt:0,
  audioContext:null,audioSource:null,audioProcessor:null,cloudSamples:[],cloudStartedAt:0,cloudSeq:0,cloudNextResult:0,cloudResults:new Map(),
  recorder:null,recordingStream:null,recordingStartedAt:0,recordingTimer:null,recordingChunkIndex:0,uploadedChunks:0,recordings:[],
  localTranslator:null,localTranslatorPromise:null,localQueue:[],localBusy:false,titleTimer:null,deferredInstall:null
}

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function clock(){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
function dateTime(v){try{return new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return''}}
function fmtMs(ms){if(!Number.isFinite(ms))return'—';return ms<1000?`${Math.round(ms)} ms`:`${(ms/1000).toFixed(ms<10000?2:1)} s`}
function fmtDuration(ms){const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),r=s%60;return`${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`}
function empty(text){return`<div class="empty">${esc(text)}</div>`}
function setStatus(text){if($('status'))$('status').textContent=text}
function setSync(busy=false){state.saving=Math.max(0,state.saving+(busy?1:-1));if($('syncPill'))$('syncPill').textContent=state.saving?'☁ 同步中… / Syncing':'☁ 已同步 / Synced'}
function localKey(){return`classflow-beta3-draft-${state.user?.id||'guest'}`}
function persistLocal(){if(!state.user)return;localStorage.setItem(localKey(),JSON.stringify({sessionId:state.sessionId,title:$('classTitle')?.value||'',sourceLanguage:$('sourceLanguage')?.value||'en-US',translationProvider:$('translationProvider')?.value||'auto',pipelineMode:$('pipelineMode')?.value||'browser',segmentMode:$('segmentMode')?.value||'smart',entries:state.entries}))}
function clearLocal(){localStorage.removeItem(localKey())}
function renderFlags(flags=[]){return flags.map(f=>`<b data-flag="${esc(f)}">${esc(f)}</b>`).join('')}
function providerLabel(p){return p==='deepseek'?'DeepSeek':p==='openai'?'OpenAI':p==='local'?'Local':p==='auto'?'Auto':'—'}
function selectedProviderLabel(){const v=$('translationProvider')?.value||'auto';return v==='auto'?'Auto · DeepSeek→OpenAI':providerLabel(v)}

function updateMetrics(){
  const arr=state.latencies.slice(-20),last=arr.at(-1),avg=arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:NaN
  $('lastLatency').textContent=fmtMs(last);$('avgLatency').textContent=fmtMs(avg);$('latencyPill').textContent=`延迟 / Latency: ${fmtMs(last)}`
  $('lastModel').textContent=state.lastProvider?providerLabel(state.lastProvider):'—'
  $('providerPill').textContent=`翻译引擎 / Engine: ${state.lastProvider?providerLabel(state.lastProvider):selectedProviderLabel()}`
  if(state.recordingStartedAt&&state.recorder?.state==='recording')$('recordingDuration').textContent=fmtDuration(Date.now()-state.recordingStartedAt)
  $('recordingChunks').textContent=`${state.uploadedChunks} 段已上传`
}


const reviewNoiseWords=new Set(['嗯','哦','啊','呀','诶','唉','好','好的','行','对','对的','嗯嗯','哦哦','哈哈','呃','额','是的'])
function cleanReviewText(text){
  const raw=String(text||'').replace(/\s+/g,' ').replace(/^翻译中…?\s*\/\s*Translating\s*$/i,'').trim()
  if(!raw||raw.startsWith('⚠'))return''
  const compact=raw.replace(/\s+/g,'').replace(/[。！？!?…，,、；;：:]/g,'')
  if(!compact||reviewNoiseWords.has(compact)||(compact.length<=1&&!/[A-Za-z0-9]/.test(compact)))return''
  return raw
}
function buildReviewParagraphs(entries){
  const out=[];let buffer=''
  const join=(a,b)=>!a?b:!b?a:a+(/[A-Za-z0-9]$/.test(a)&&/^[A-Za-z0-9]/.test(b)?' ':'')+b
  const len=s=>String(s||'').replace(/\s+/g,'').length
  const texts=entries.filter(e=>!e.translationError).map(e=>cleanReviewText(e.translation)).filter(Boolean)
  for(const text of texts){
    buffer=join(buffer,text)
    if((len(buffer)>=85&&/[。！？!?]$/.test(text.trim()))||len(buffer)>=150){out.push(buffer.trim());buffer=''}
  }
  if(buffer.trim()){
    if(out.length&&len(buffer)<28)out[out.length-1]=join(out[out.length-1],buffer)
    else out.push(buffer.trim())
  }
  return out
}

function render(){
  $('recordCount').textContent=`${state.entries.length} 条记录 / records`
  $('recordButton').classList.toggle('stop',state.isListening)
  $('recordLabel').textContent=state.isListening?'暂停听课 / Pause':'开始听课 / Start'
  $('recordButton').querySelector('span').textContent=state.isListening?'■':'●'
  $('pipelinePill').textContent=`语音 / Speech: ${state.isListening?($('pipelineMode').value==='browser'?'Stable Browser':$('pipelineMode').value==='cloud'?'Cloud':'Realtime'):'—'}`
  $('segmentStatus').textContent=$('segmentMode').value==='smart'?'Smart merge':'Direct'
  const orig=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span>${renderFlags(e.flags)}</div><p>${esc(e.original)}</p></article>`).join('')
  const interim=state.interim?`<article class="speech-card interim"><div class="meta"><span>正在识别 / Listening</span></div><p>${esc(state.interim)}</p></article>`:''
  $('originalStream').innerHTML=orig+interim||empty('点击“开始听课 / Start”，这里会显示课堂原文。')
  const trans=state.entries.map(e=>`<article class="speech-card translated"><div class="meta"><span>${esc(e.time)}</span>${e.latencyMs?`<span>⚡ ${fmtMs(e.latencyMs)}</span>`:''}${e.provider?`<span class="provider-badge ${esc(e.provider)}">${esc(providerLabel(e.provider))}</span>`:''}</div><p class="${e.translationError?'error-text':''}">${esc(e.translation||'翻译中… / Translating')}</p><div class="flag-row">${flagDefs.map(f=>`<button data-entry="${esc(e.id)}" data-flag="${esc(f.key)}" class="${e.flags.includes(f.key)?'selected':''}">${f.icon} ${esc(f.label)}</button>`).join('')}</div></article>`).join('')
  $('translationStream').innerHTML=trans||empty('原文完成后立即翻译；云同步不会阻塞译文。')
  const reviewParagraphs=buildReviewParagraphs(state.entries)
  $('reviewArea').innerHTML=reviewParagraphs.length
    ?`<div class="clean-full-translation">${reviewParagraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`
    :empty('这里会以自然段连续显示整堂课的中文译文。')
  $('exportMd').disabled=$('exportWord').disabled=!state.entries.length
  document.querySelectorAll('.flag-row button').forEach(b=>b.onclick=()=>toggleFlag(b.dataset.entry,b.dataset.flag))
  persistLocal();updateMetrics()
  requestAnimationFrame(()=>['originalStream','translationStream','reviewArea'].forEach(id=>{const el=$(id);if(el)el.scrollTop=el.scrollHeight}))
}

async function checkProviders(){
  try{
    const {data,error}=await supabase.functions.invoke('classflow-ai',{body:{action:'health'}})
    if(error)throw error
    state.providerHealth=data||{}
    const parts=[]
    parts.push(data?.deepseekConfigured?'DeepSeek ✓':'DeepSeek —')
    parts.push(data?.openaiConfigured?'OpenAI ✓':'OpenAI —')
    $('providerHealth').textContent=parts.join(' · ')
    $('translationDot').className=`dot ${data?.deepseekConfigured||data?.openaiConfigured?'live':'error'}`
    $('translationStatus').textContent=data?.deepseekConfigured?'DeepSeek 已连接 / Connected':data?.openaiConfigured?'OpenAI 已连接 / Connected':'无 API / No API'
  }catch(err){$('providerHealth').textContent='API 状态检查失败';$('translationDot').className='dot error';$('translationStatus').textContent='检查失败 / Check failed'}
  render()
}

async function ensureCloudSession(){
  if(state.sessionId)return state.sessionId
  setSync(true)
  const {data,error}=await supabase.from('classflow_sessions').insert({title:$('classTitle').value||'未命名课堂 / Untitled Class',source_language:$('sourceLanguage').value,target_language:'zh-CN'}).select('id').single()
  setSync(false)
  if(error)throw error
  state.sessionId=data.id;state.recordingChunkIndex=0;persistLocal();loadHistory();return data.id
}
async function saveSessionMeta(){if(!state.sessionId)return;setSync(true);const {error}=await supabase.from('classflow_sessions').update({title:$('classTitle').value||'未命名课堂 / Untitled Class',source_language:$('sourceLanguage').value,updated_at:new Date().toISOString()}).eq('id',state.sessionId);setSync(false);if(error)setStatus(`课堂信息同步失败 / Metadata sync failed: ${error.message}`)}
async function saveSegment(entry){
  try{
    const sessionId=await ensureCloudSession();setSync(true)
    const {data,error}=await supabase.from('classflow_segments').insert({session_id:sessionId,seq:entry.seq,source_text:entry.original,translation:entry.translationDone?entry.translation:'',flags:entry.flags}).select('id').single()
    setSync(false);if(error)throw error;entry.cloudId=data.id
    if(entry.translationDone)updateSegment(entry,{translation:entry.translation})
  }catch(err){setSync(false);setStatus(`原文已保留，本次云同步失败 / Transcript kept; cloud sync failed: ${err.message||err}`)}
}
async function updateSegment(entry,patch){if(!entry.cloudId)return;setSync(true);const {error}=await supabase.from('classflow_segments').update(patch).eq('id',entry.cloudId);setSync(false);if(error)setStatus(`云同步失败 / Cloud sync failed: ${error.message}`)}
async function saveLatency(entry){if(!state.sessionId||!Number.isFinite(entry.latencyMs))return;supabase.from('classflow_latency_samples').insert({session_id:state.sessionId,segment_seq:entry.seq,pipeline:entry.source||$('pipelineMode').value,translation_ms:Math.round(entry.latencyMs),total_ms:Math.round(entry.latencyMs)}).then(()=>{}).catch(()=>{})}

async function callAI(body){
  const {data,error}=await supabase.functions.invoke('classflow-ai',{body})
  if(error){let msg=error.message||'AI request failed';try{const ctx=await error.context?.json?.();if(ctx?.error)msg=ctx.error}catch{};throw new Error(msg)}
  if(data?.error)throw new Error(data.error)
  return data
}

async function ensureLocalTranslator(){
  if(state.localTranslator)return state.localTranslator
  if(state.localTranslatorPromise)return state.localTranslatorPromise
  state.localTranslatorPromise=(async()=>{
    $('translationStatus').textContent='本地模型加载中 / Loading local model';$('translationDot').className='dot busy'
    const {pipeline}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm')
    state.localTranslator=await pipeline('translation','Xenova/opus-mt-en-zh',{dtype:'q4'})
    $('translationStatus').textContent='本地模型已就绪 / Local ready';$('translationDot').className='dot live'
    return state.localTranslator
  })().catch(err=>{state.localTranslatorPromise=null;throw err})
  return state.localTranslatorPromise
}
async function translateLocal(text){
  if($('sourceLanguage').value==='zh-CN')return text
  if($('sourceLanguage').value!=='en-US')throw new Error('本地翻译当前仅支持 English → 中文 / Local translation currently supports English → Chinese')
  const t=await ensureLocalTranslator(),out=await t(text,{max_new_tokens:256})
  return String(out?.[0]?.translation_text||'').trim()
}

async function translateEntry(entry){
  const start=performance.now();entry.translationError=false
  try{
    let provider=$('translationProvider').value
    if($('sourceLanguage').value==='zh-CN'){
      entry.translation=entry.original;entry.provider='local';entry.model='passthrough'
    }else if(provider==='local'){
      entry.translation=await translateLocal(entry.original);entry.provider='local';entry.model='opus-mt-en-zh'
    }else{
      const d=await callAI({action:'translate',provider,text:entry.original,sourceLanguage:$('sourceLanguage').value,courseTitle:$('classTitle').value})
      entry.translation=d.translation||'';entry.provider=d.provider||provider;entry.model=d.model||''
    }
    if(!entry.translation)throw new Error('Empty translation')
    entry.translationDone=true
    entry.latencyMs=Math.max(0,performance.now()-start);state.latencies.push(entry.latencyMs)
    state.lastProvider=entry.provider;state.lastModel=entry.model||providerLabel(entry.provider)
    $('translationDot').className='dot live';$('translationStatus').textContent=`${providerLabel(entry.provider)} 翻译正常 / Translation active`
  }catch(err){
    entry.translation=`⚠ ${err?.message||'翻译失败 / Translation failed'}`;entry.translationError=true;entry.translationDone=true;entry.latencyMs=Math.max(0,performance.now()-start);state.latencies.push(entry.latencyMs)
    $('translationDot').className='dot error';$('translationStatus').textContent='翻译失败 / Translation failed'
  }
  render();if(entry.cloudId)updateSegment(entry,{translation:entry.translation});saveLatency(entry)
}

function terminal(text){return/[.!?。！？;；:]$/.test(String(text).trim())}
function queueTranscript(text,meta={}){
  const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return
  if($('segmentMode').value==='direct'){commitTranscript(clean,meta);return}
  const words=clean.split(/\s+/).length
  if(terminal(clean)||words>=20||clean.length>=120){flushPendingSegment();commitTranscript(clean,meta);return}
  if(state.pendingSegment){state.pendingSegment.text=`${state.pendingSegment.text} ${clean}`.replace(/\s+/g,' ').trim();state.pendingSegment.meta={...state.pendingSegment.meta,...meta}}else state.pendingSegment={text:clean,meta:{...meta}}
  state.interim=state.pendingSegment.text;render();clearTimeout(state.pendingTimer);state.pendingTimer=setTimeout(flushPendingSegment,650)
}
function flushPendingSegment(){clearTimeout(state.pendingTimer);state.pendingTimer=null;const p=state.pendingSegment;state.pendingSegment=null;if(p){state.interim='';commitTranscript(p.text,p.meta)}}
function commitTranscript(text,meta={}){
  const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return
  const last=state.entries.at(-1);if(last&&last.original===clean&&Date.now()-(last.createdAt||0)<8000)return
  const entry={id:crypto.randomUUID(),cloudId:null,seq:state.entries.length+1,time:clock(),createdAt:Date.now(),original:clean,translation:'翻译中… / Translating',translationDone:false,translationError:false,flags:[],source:meta.source||$('pipelineMode').value}
  state.entries.push(entry);state.interim='';render();saveSegment(entry);translateEntry(entry)
}

function startBrowserRecognition(){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
  if(!Recognition)throw new Error('当前浏览器不支持网页语音识别 / SpeechRecognition unavailable')
  const r=new Recognition();r.lang=$('sourceLanguage').value;r.continuous=true;r.interimResults=true;r.maxAlternatives=1
  state.recognition=r;state.shouldRestart=true
  r.onstart=()=>{$('speechDot').className='dot live';$('speechStatus').textContent='稳定识别中 / Stable speech active';setStatus('正在听课并翻译 / Listening and translating')}
  r.onresult=ev=>{let inter='';for(let i=ev.resultIndex;i<ev.results.length;i++){const res=ev.results[i],text=(res[0]?.transcript||'').trim();if(!text)continue;if(res.isFinal)queueTranscript(text,{source:'browser'});else inter+=(inter?' ':'')+text}state.interim=inter.trim();render()}
  r.onerror=ev=>{if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){state.shouldRestart=false;state.isListening=false;$('speechDot').className='dot error';$('speechStatus').textContent='权限被拒绝 / Permission denied';setStatus('请允许麦克风权限 / Allow microphone access');render();return}if(ev.error!=='no-speech'&&ev.error!=='aborted'){setStatus(`浏览器识别异常 / Speech error: ${ev.error}`);$('speechDot').className='dot error'}}
  r.onend=()=>{state.interim='';if(state.shouldRestart&&state.isListening&&$('pipelineMode').value==='browser')setTimeout(()=>{try{r.start()}catch{}},300);else render()}
  r.start()
}

async function ensureMicStream(){if(state.micStream?.active)return state.micStream;state.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}).catch(()=>navigator.mediaDevices.getUserMedia({audio:true}));return state.micStream}
function stopMicStream(){try{state.micStream?.getTracks()?.forEach(t=>t.stop())}catch{}state.micStream=null}

function floatToWav(samples,inputRate,targetRate=16000){
  const ratio=inputRate/targetRate,len=Math.max(1,Math.floor(samples.length/ratio)),out=new Float32Array(len)
  for(let i=0;i<len;i++){const start=Math.floor(i*ratio),end=Math.min(samples.length,Math.floor((i+1)*ratio));let sum=0,n=0;for(let j=start;j<end;j++){sum+=samples[j];n++}out[i]=n?sum/n:0}
  const buffer=new ArrayBuffer(44+out.length*2),view=new DataView(buffer);const write=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i))}
  write(0,'RIFF');view.setUint32(4,36+out.length*2,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,targetRate,true);view.setUint32(28,targetRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,out.length*2,true)
  let off=44;for(let i=0;i<out.length;i++){const s=Math.max(-1,Math.min(1,out[i]));view.setInt16(off,s<0?s*0x8000:s*0x7fff,true);off+=2}
  return new Blob([buffer],{type:'audio/wav'})
}
async function invokeTranscribe(blob){
  const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Authentication required')
  const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-transcribe-chunk`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_KEY,'Content-Type':'audio/wav','x-audio-mime':'audio/wav','x-source-language':$('sourceLanguage').value,'x-course-title':encodeURIComponent($('classTitle').value||'ClassFlow lecture')},body:blob})
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data?.error||`Cloud transcription failed (${res.status})`);return String(data?.text||'').trim()
}
async function flushCloudAudio(){
  if(!state.audioContext||!state.cloudSamples.length)return
  const mergedLen=state.cloudSamples.reduce((n,a)=>n+a.length,0);if(mergedLen<1000){state.cloudSamples=[];return}
  const merged=new Float32Array(mergedLen);let offset=0;for(const a of state.cloudSamples){merged.set(a,offset);offset+=a.length}state.cloudSamples=[]
  const seq=state.cloudSeq++,blob=floatToWav(merged,state.audioContext.sampleRate)
  invokeTranscribe(blob).then(text=>{state.cloudResults.set(seq,{text,error:null});drainCloudResults()}).catch(err=>{state.cloudResults.set(seq,{text:'',error:err});drainCloudResults()})
}
function drainCloudResults(){while(state.cloudResults.has(state.cloudNextResult)){const r=state.cloudResults.get(state.cloudNextResult);state.cloudResults.delete(state.cloudNextResult);state.cloudNextResult++;if(r.error){setStatus(`云端转写失败 / Cloud transcription failed: ${r.error.message||r.error}`);$('speechDot').className='dot error'}else if(r.text){queueTranscript(r.text,{source:'cloud'})}}}
async function startCloudSpeech(){
  const stream=await ensureMicStream();state.audioContext=new (window.AudioContext||window.webkitAudioContext)();state.audioSource=state.audioContext.createMediaStreamSource(stream);state.audioProcessor=state.audioContext.createScriptProcessor(4096,1,1);state.cloudSamples=[];state.cloudStartedAt=performance.now();state.cloudSeq=0;state.cloudNextResult=0;state.cloudResults.clear()
  state.audioProcessor.onaudioprocess=e=>{if(!state.isListening||$('pipelineMode').value!=='cloud')return;state.cloudSamples.push(new Float32Array(e.inputBuffer.getChannelData(0)));if(performance.now()-state.cloudStartedAt>=3200){state.cloudStartedAt=performance.now();flushCloudAudio()}}
  state.audioSource.connect(state.audioProcessor);state.audioProcessor.connect(state.audioContext.destination);$('speechDot').className='dot live';$('speechStatus').textContent='OpenAI 云转写 / Cloud transcription';setStatus('云端语音转写中 / Cloud speech transcription active')
}
function stopCloudSpeech(){flushCloudAudio();try{state.audioProcessor?.disconnect()}catch{}try{state.audioSource?.disconnect()}catch{}try{state.audioContext?.close()}catch{}state.audioProcessor=null;state.audioSource=null;state.audioContext=null;state.cloudSamples=[]}

async function getRealtimeToken(){const {data,error}=await supabase.functions.invoke('classflow-realtime-token',{body:{sourceLanguage:$('sourceLanguage').value,courseTitle:$('classTitle').value,silenceDurationMs:$('segmentMode').value==='smart'?450:800}});if(error)throw error;const token=data?.value||data?.client_secret?.value||data?.client_secret||data?.secret?.value;if(!token)throw new Error(data?.error||'Realtime token missing');return token}
async function startRealtimeSpeech(){
  const stream=await ensureMicStream(),token=await getRealtimeToken(),pc=new RTCPeerConnection();state.peer=pc;const track=stream.getAudioTracks()[0];if(!track)throw new Error('No microphone track');pc.addTrack(track,stream)
  const dc=pc.createDataChannel('oai-events');state.dataChannel=dc;dc.onopen=()=>{$('speechDot').className='dot live';$('speechStatus').textContent='Realtime 已连接 / Connected';setStatus('Realtime 转写中 / Realtime transcription active')}
  dc.onmessage=({data})=>{let ev;try{ev=JSON.parse(data)}catch{return}if(ev.type==='conversation.item.input_audio_transcription.delta'){const id=ev.item_id||'current',prev=state.rtInterim.get(id)||'';state.rtInterim.set(id,prev+(ev.delta||''));state.interim=Array.from(state.rtInterim.values()).join(' ').trim();render()}else if(ev.type==='conversation.item.input_audio_transcription.completed'){const id=ev.item_id||'current';state.rtInterim.delete(id);state.interim=Array.from(state.rtInterim.values()).join(' ').trim();queueTranscript(ev.transcript,{source:'realtime'})}else if(ev.type==='error'){setStatus(`Realtime 错误 / Realtime error: ${ev.error?.message||'unknown'}`);$('speechDot').className='dot error'}}
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);const res=await fetch('https://api.openai.com/v1/realtime/calls',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/sdp'},body:offer.sdp});if(!res.ok)throw new Error(`Realtime SDP failed (${res.status}): ${await res.text()}`);await pc.setRemoteDescription({type:'answer',sdp:await res.text()})
}
function stopRealtimeSpeech(){try{state.dataChannel?.close()}catch{}try{state.peer?.close()}catch{}state.dataChannel=null;state.peer=null;state.rtInterim.clear()}

function chooseMime(){const c=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];return c.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||''}
function extFor(mime){if(mime.includes('mp4'))return'm4a';if(mime.includes('ogg'))return'ogg';return'webm'}
function openAudioDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('classflow-beta3-audio',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('chunks'))db.createObjectStore('chunks',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbPut(record){const db=await openAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('chunks','readwrite');tx.objectStore('chunks').put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbDelete(id){const db=await openAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('chunks','readwrite');tx.objectStore('chunks').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbAll(){const db=await openAudioDb();return new Promise((resolve,reject)=>{const tx=db.transaction('chunks','readonly'),req=tx.objectStore('chunks').getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)})}
async function uploadRecording(record){
  const sessionId=record.sessionId||await ensureCloudSession(),path=`${state.user.id}/${sessionId}/${String(record.chunkIndex).padStart(5,'0')}.${extFor(record.mimeType||'audio/webm')}`
  const {error:upErr}=await supabase.storage.from('classflow-recordings').upload(path,record.blob,{contentType:record.mimeType||'audio/webm',upsert:true});if(upErr)throw upErr
  const {error:rowErr}=await supabase.from('classflow_recordings').upsert({session_id:sessionId,storage_path:path,chunk_index:record.chunkIndex,started_at:record.startedAt,duration_ms:record.durationMs,mime_type:record.mimeType,bytes:record.blob.size},{onConflict:'session_id,chunk_index'});if(rowErr)throw rowErr
  await dbDelete(record.id).catch(()=>{});state.uploadedChunks++;loadRecordings();updateMetrics()
}
async function persistRecordingBlob(blob,mimeType,startedAt,durationMs){if(!blob||blob.size<800)return;const sessionId=await ensureCloudSession().catch(()=>null),record={id:`${state.user.id}-${sessionId||'pending'}-${Date.now()}-${state.recordingChunkIndex}`,sessionId,chunkIndex:state.recordingChunkIndex++,blob,mimeType,startedAt,durationMs};await dbPut(record);uploadRecording(record).catch(()=>{$('recordingStatus').textContent='本地待上传 / Pending upload'})}
async function startRecordingBestEffort(){
  if(!$('recordingToggle').checked||state.recorder?.state==='recording')return
  try{
    const stream=state.micStream?.active?state.micStream:await navigator.mediaDevices.getUserMedia({audio:true});state.recordingStream=stream;const mime=chooseMime();state.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);state.recordingStartedAt=Date.now();let chunkStart=Date.now();$('recordingDot').className='dot recording';$('recordingStatus').textContent='录音中 / Recording'
    state.recorder.ondataavailable=e=>{const now=Date.now();if(e.data?.size)persistRecordingBlob(e.data,state.recorder.mimeType||mime, new Date(chunkStart).toISOString(),now-chunkStart);chunkStart=now}
    state.recorder.onstop=()=>{$('recordingDot').className='dot';$('recordingStatus').textContent=$('recordingToggle').checked?'已停止 / Stopped':'关闭 / Off';if(state.recordingStream&&state.recordingStream!==state.micStream){try{state.recordingStream.getTracks().forEach(t=>t.stop())}catch{}}state.recordingStream=null;state.recordingStartedAt=0;clearInterval(state.recordingTimer);updateMetrics()}
    state.recorder.start(30000);state.recordingTimer=setInterval(updateMetrics,1000)
  }catch(err){$('recordingDot').className='dot error';$('recordingStatus').textContent='录音不可用 / Recording unavailable';setStatus(`录音未启动，但翻译继续 / Recording failed; translation continues: ${err.message||err}`)}
}
function stopRecording(){try{if(state.recorder?.state==='recording')state.recorder.stop()}catch{}state.recorder=null;clearInterval(state.recordingTimer)}
async function retryPendingUploads(){const rows=await dbAll().catch(()=>[]);for(const r of rows){if(!state.isListening&&r.sessionId&&state.sessionId&&r.sessionId!==state.sessionId)continue;await uploadRecording(r).catch(()=>{})}}
async function loadRecordings(){
  if(!state.sessionId){$('recordingList').innerHTML=empty('当前课堂还没有云端录音。');return}
  const {data,error}=await supabase.from('classflow_recordings').select('*').eq('session_id',state.sessionId).order('chunk_index');if(error){$('recordingList').innerHTML=empty('录音读取失败');return}
  state.recordings=data||[];state.uploadedChunks=state.recordings.length;$('recordingList').innerHTML=state.recordings.length?state.recordings.map(r=>`<div class="recording-item"><b>#${Number(r.chunk_index)+1}</b><span>${fmtDuration(r.duration_ms||0)}</span><button data-path="${esc(r.storage_path)}">▶ 播放 / Play</button></div>`).join(''):empty('暂无录音片段 / No recording chunks')
  document.querySelectorAll('.recording-item button').forEach(b=>b.onclick=()=>playRecording(b.dataset.path));updateMetrics()
}
async function playRecording(path){const {data,error}=await supabase.storage.from('classflow-recordings').createSignedUrl(path,600);if(error||!data?.signedUrl){setStatus('无法打开录音 / Could not open recording');return}$('audioPlayer').hidden=false;$('audioPlayer').src=data.signedUrl;$('audioPlayer').play().catch(()=>{})}

async function start(){
  if(state.isListening)return
  state.isListening=true;state.shouldRestart=true;state.interim='';$('speechDot').className='dot busy';$('speechStatus').textContent='启动中 / Starting';render();ensureCloudSession().catch(()=>{})
  try{
    const mode=$('pipelineMode').value
    if(mode==='browser')startBrowserRecognition();else if(mode==='cloud')await startCloudSpeech();else await startRealtimeSpeech()
    if($('recordingToggle').checked)setTimeout(()=>{if(state.isListening)startRecordingBestEffort()},700)
  }catch(err){state.isListening=false;state.shouldRestart=false;$('speechDot').className='dot error';$('speechStatus').textContent='启动失败 / Failed';setStatus(`语音管线启动失败 / Speech pipeline failed: ${err.message||err}`);stopCloudSpeech();stopRealtimeSpeech();stopMicStream();render()}
}
function stop(){
  state.shouldRestart=false;state.isListening=false;flushPendingSegment();try{state.recognition?.stop()}catch{}state.recognition=null;stopCloudSpeech();stopRealtimeSpeech();stopRecording();stopMicStream();state.interim='';$('speechDot').className='dot';$('speechStatus').textContent='已暂停 / Paused';setStatus('已暂停，课堂记录已保留 / Paused · class record kept');render()
}

function toggleFlag(id,flag){const e=state.entries.find(x=>x.id===id);if(!e)return;e.flags=e.flags.includes(flag)?e.flags.filter(x=>x!==flag):[...e.flags,flag];render();updateSegment(e,{flags:e.flags})}
function markLatest(flag){const e=state.entries.at(-1);if(e)toggleFlag(e.id,flag)}
function blobDownload(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${$('classTitle').value||'课堂记录'}_${new Date().toISOString().slice(0,10)}.${ext}`;a.click();URL.revokeObjectURL(url)}
function exportMd(){const body=state.entries.map(e=>`### ${e.time}${e.flags.length?` · ${e.flags.join(' / ')}`:''}\n\n**原文 / Original**：${e.original}\n\n**翻译 / Translation**：${e.translation}\n`).join('\n');blobDownload(`# ${$('classTitle').value}\n\n${body}`,'text/markdown;charset=utf-8','md')}
function exportWord(){const rows=state.entries.map(e=>`<div class="entry"><h3>${esc(e.time)}${e.flags.length?' · '+esc(e.flags.join(' / ')):''}</h3><p><b>原文 / Original：</b>${esc(e.original)}</p><p><b>翻译 / Translation：</b>${esc(e.translation)}</p></div>`).join('');const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Microsoft YaHei',sans-serif;line-height:1.7;padding:28px}h1{font-size:24px}.entry{margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid #ddd}h3{font-size:14px;color:#666}p{font-size:12pt}</style></head><body><h1>${esc($('classTitle').value)}</h1>${rows}</body></html>`;blobDownload('\ufeff'+html,'application/msword','doc')}

async function newSession(){stop();state.sessionId=null;state.entries=[];state.interim='';state.recordings=[];state.uploadedChunks=0;clearLocal();$('classTitle').value='新课堂 / New Class';setStatus('已新建课堂，点击“开始听课 / Start” / New class created');render();$('recordingList').innerHTML=empty('暂无录音片段');loadHistory()}
async function loadHistory(){
  if(!state.user)return
  const {data,error}=await supabase.from('classflow_sessions').select('id,title,source_language,started_at,updated_at').order('started_at',{ascending:false}).limit(40);if(error)return
  state.history=data||[];$('historyList').innerHTML=state.history.length?state.history.map(s=>`<button class="history-item" data-id="${s.id}"><strong>${esc(s.title)}</strong><span>${dateTime(s.started_at)} · ${esc(s.source_language||'')}</span></button>`).join(''):empty('还没有云端课堂记录 / No cloud classes yet')
  document.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>loadSession(b.dataset.id))
}
async function loadSession(id){
  stop();setStatus('正在读取课堂… / Loading class')
  const [{data:s,error:e1},{data:segs,error:e2}]=await Promise.all([supabase.from('classflow_sessions').select('*').eq('id',id).single(),supabase.from('classflow_segments').select('*').eq('session_id',id).order('seq')]);if(e1||e2){setStatus(`读取失败 / Load failed: ${(e1||e2).message}`);return}
  state.sessionId=s.id;$('classTitle').value=s.title;$('sourceLanguage').value=s.source_language||'en-US';state.entries=(segs||[]).map(x=>({id:crypto.randomUUID(),cloudId:x.id,seq:x.seq,time:dateTime(x.occurred_at),createdAt:Date.now(),original:x.source_text,translation:x.translation||'',translationDone:true,translationError:String(x.translation||'').startsWith('⚠'),provider:'',model:'',flags:x.flags||[],source:'history'}));closeHistory();setStatus('已载入课堂记录 / Class loaded');render();loadRecordings()
}
function openHistory(){$('historyDrawer').classList.add('open');$('historyDrawer').setAttribute('aria-hidden','false');$('drawerMask').hidden=false;loadHistory()}
function closeHistory(){$('historyDrawer').classList.remove('open');$('historyDrawer').setAttribute('aria-hidden','true');$('drawerMask').hidden=true}

function showAuthMessage(msg,bad=false){$('authMessage').textContent=msg;$('authMessage').style.color=bad?'#b54b43':'#287a4b'}
async function enterApp(session){
  state.user=session?.user||null
  if(!state.user){$('authGate').hidden=false;const h=document.getElementById('homeShell');if(h)h.hidden=true;$('appShell').hidden=true;return}
  $('authGate').hidden=true;const h=document.getElementById('homeShell');if(h)h.hidden=false;$('appShell').hidden=true;$('accountEmail').textContent=state.user.email||'已登录'
  const draft=JSON.parse(localStorage.getItem(localKey())||'null');if(draft?.title)$('classTitle').value=draft.title;if(draft?.sourceLanguage)$('sourceLanguage').value=draft.sourceLanguage;if(draft?.translationProvider)$('translationProvider').value=draft.translationProvider;if(draft?.pipelineMode)$('pipelineMode').value=draft.pipelineMode;if(draft?.segmentMode)$('segmentMode').value=draft.segmentMode;if(Array.isArray(draft?.entries))state.entries=draft.entries;if(draft?.sessionId)state.sessionId=draft.sessionId
  setStatus('ClassFlow Beta 1.005 · 翻译优先 / Translation first');render();loadHistory();checkProviders();if(state.sessionId)loadRecordings();retryPendingUploads()
}

$('authForm').onsubmit=async e=>{e.preventDefault();showAuthMessage('正在登录… / Signing in');const {error}=await supabase.auth.signInWithPassword({email:$('authEmail').value.trim(),password:$('authPassword').value});if(error){const raw=error.message||'';showAuthMessage(/invalid login credentials/i.test(raw)?'邮箱或密码不正确；没有账号请先注册。 / Incorrect email or password; sign up first if needed.':raw,true)}else showAuthMessage('登录成功 / Signed in')}
$('signupButton').onclick=async()=>{const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email)return showAuthMessage('请填写邮箱 / Enter email',true);if(password.length<6)return showAuthMessage('密码至少 6 位 / Password must be 6+ characters',true);showAuthMessage('正在注册… / Signing up');const {data,error}=await supabase.auth.signUp({email,password});if(error)return showAuthMessage(error.message,true);showAuthMessage(data.session?'注册成功并已登录 / Signed up and signed in':'注册成功，请直接登录 / Signed up; sign in now')}
$('logoutButton').onclick=async()=>{stop();await supabase.auth.signOut();state.user=null;state.sessionId=null;state.entries=[];$('accountPopover').hidden=true;await enterApp(null)}
$('recordButton').onclick=()=>state.isListening?stop():start()
$('quickFlags').querySelectorAll('button').forEach(b=>b.onclick=()=>markLatest(b.dataset.flag))
$('translationProvider').onchange=()=>{persistLocal();state.lastProvider='';checkProviders();render()}
$('pipelineMode').onchange=()=>{if(state.isListening)stop();persistLocal();setStatus('语音管线已切换，请重新开始 / Speech pipeline changed; tap Start again');render()}
$('segmentMode').onchange=()=>{persistLocal();render()}
$('sourceLanguage').onchange=()=>{if(state.isListening)stop();persistLocal();saveSessionMeta();setStatus('老师语言已切换，请重新开始 / Teacher language changed; tap Start again')}
$('classTitle').oninput=()=>{persistLocal();clearTimeout(state.titleTimer);state.titleTimer=setTimeout(saveSessionMeta,700)}
$('newSession').onclick=newSession
$('historyButton').onclick=openHistory;$('closeHistory').onclick=closeHistory;$('drawerMask').onclick=closeHistory
$('accountButton').onclick=()=>{$('accountPopover').hidden=!$('accountPopover').hidden}
$('retryUploads').onclick=retryPendingUploads
$('recordingToggle').onchange=()=>{if(!$('recordingToggle').checked){stopRecording();$('recordingStatus').textContent='关闭 / Off'}else if(state.isListening)startRecordingBestEffort();persistLocal()}
$('exportMd').onclick=exportMd;$('exportWord').onclick=exportWord

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;$('installButton').hidden=false})
$('installButton').onclick=async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$('installButton').hidden=true}
window.addEventListener('beforeunload',()=>{state.shouldRestart=false;try{state.recognition?.stop()}catch{};stopCloudSpeech();stopRealtimeSpeech();stopRecording();stopMicStream()})
supabase.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id!==state.user?.id)enterApp(session)})
const {data:{session}}=await supabase.auth.getSession();await enterApp(session)
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js?v=1.005').catch(()=>{})

window.ClassFlowBetaCore={openHistory,newSession,closeHistory};
