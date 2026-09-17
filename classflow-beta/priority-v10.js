(()=>{
  const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
  const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
  const TARGET_RATE=16000
  const CHUNK_SECONDS=3.0
  const MAX_INFLIGHT=2
  const $=id=>document.getElementById(id)

  const state={
    active:false,stream:null,ctx:null,source:null,processor:null,gain:null,
    chunks:[],sampleCount:0,queue:[],inFlight:0,captureSeq:0,nextEmit:1,results:new Map(),
    entries:[],sessionId:null,notes:'',startedAt:0
  }

  function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
  function clock(){return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())}
  function setStatus(text){const el=$('status');if(el)el.textContent=text}
  function setLive(on){
    const pill=$('livePill'),text=$('liveText'),btn=$('recordButton'),label=$('recordLabel')
    pill?.classList.toggle('active',on)
    if(text)text.textContent=on?'LIVE':'READY'
    btn?.classList.toggle('stop',on)
    const icon=btn?.querySelector('.record-icon');if(icon)icon.textContent=on?'■':'●'
    if(label)label.textContent=on?'暂停听课 / Pause':'开始听课 / Start'
  }
  function findToken(value,depth=0){
    if(depth>7||!value)return''
    if(typeof value==='object'){
      if(typeof value.access_token==='string'&&value.access_token)return value.access_token
      for(const k of Object.keys(value)){const t=findToken(value[k],depth+1);if(t)return t}
    }
    return''
  }
  function accessToken(){
    const preferred=['classflow-auth-v1']
    for(const key of preferred){try{const raw=localStorage.getItem(key);if(raw){const t=findToken(JSON.parse(raw));if(t)return t}}catch{}}
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)||''
      if(!/classflow|supabase|auth/i.test(key))continue
      try{const raw=localStorage.getItem(key);if(raw){const t=findToken(JSON.parse(raw));if(t)return t}}catch{}
    }
    return''
  }
  function authHeaders(extra={}){
    const token=accessToken()
    if(!token)throw new Error('登录会话失效，请退出后重新登录 / Session expired; please sign in again')
    return {Authorization:`Bearer ${token}`,apikey:SUPABASE_KEY,...extra}
  }

  function mergeFloat32(parts,total){
    const out=new Float32Array(total);let off=0
    for(const p of parts){out.set(p,off);off+=p.length}
    return out
  }
  function rms(samples){let sum=0;for(let i=0;i<samples.length;i++){const v=samples[i];sum+=v*v}return Math.sqrt(sum/Math.max(1,samples.length))}
  function resample(input,inRate,outRate=TARGET_RATE){
    if(inRate===outRate)return input
    const ratio=inRate/outRate,len=Math.max(1,Math.round(input.length/ratio)),out=new Float32Array(len)
    for(let i=0;i<len;i++){
      const pos=i*ratio,lo=Math.floor(pos),hi=Math.min(input.length-1,lo+1),f=pos-lo
      out[i]=(input[lo]||0)*(1-f)+(input[hi]||0)*f
    }
    return out
  }
  function wavBlob(samples,sampleRate=TARGET_RATE){
    const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer)
    const str=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i))}
    str(0,'RIFF');view.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ')
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true)
    view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true)
    let off=44
    for(let i=0;i<samples.length;i++,off+=2){const x=Math.max(-1,Math.min(1,samples[i]));view.setInt16(off,x<0?x*0x8000:x*0x7fff,true)}
    return new Blob([buffer],{type:'audio/wav'})
  }

  function render(){
    if($('recordCount'))$('recordCount').textContent=`${state.entries.length} 条记录 / records`
    const orig=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span></div><p>${esc(e.original)}</p></article>`).join('')
    const trans=state.entries.map(e=>`<article class="speech-card translated"><div class="meta"><span>${esc(e.time)}</span></div><p class="${e.translation?.startsWith('⚠')?'error':''}">${esc(e.translation||'翻译中… / Translating')}</p><div class="flag-row"><button data-v10-entry="${e.id}" data-flag="重点" class="${e.flags.includes('重点')?'selected':''}">★ 重点 / Key</button><button data-v10-entry="${e.id}" data-flag="考试" class="${e.flags.includes('考试')?'selected':''}">✓ 考试 / Exam</button><button data-v10-entry="${e.id}" data-flag="没听懂" class="${e.flags.includes('没听懂')?'selected':''}">? 没听懂 / Unsure</button><button data-v10-entry="${e.id}" data-flag="例子" class="${e.flags.includes('例子')?'selected':''}">◇ 例子 / Example</button></div></article>`).join('')
    const review=state.entries.map(e=>`<article class="review-entry"><div class="review-meta"><span>${esc(e.time)}</span>${e.flags.map(f=>`<b data-flag="${esc(f)}">${esc(f)}</b>`).join('')}</div><p class="${e.translation?.startsWith('⚠')?'error':''}">${esc(e.translation||'翻译中… / Translating')}</p></article>`).join('')
    if($('originalStream'))$('originalStream').innerHTML=orig||'<div class="empty-state"><p>点击“开始听课 / Start”，这里会显示云端转写原文。</p></div>'
    if($('translationStream'))$('translationStream').innerHTML=trans||'<div class="empty-state"><p>原文一到达就立即翻译。</p></div>'
    if($('reviewArea'))$('reviewArea').innerHTML=review||'<div class="empty-state"><p>这里会连续显示全部中文译文。</p></div>'
    if($('generateNotes'))$('generateNotes').disabled=!state.entries.length
    if($('exportMd'))$('exportMd').disabled=!state.entries.length
    if($('exportWord'))$('exportWord').disabled=!state.entries.length
    document.querySelectorAll('[data-v10-entry]').forEach(b=>b.onclick=()=>toggleFlag(b.dataset.v10Entry,b.dataset.flag))
    requestAnimationFrame(()=>['originalStream','translationStream','reviewArea'].forEach(id=>{const el=$(id);if(el)el.scrollTop=el.scrollHeight}))
  }

  async function start(){
    if(state.active)return
    try{
      if(!accessToken())throw new Error('请先登录 ClassFlow / Please sign in first')
      state.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})
      const Ctx=window.AudioContext||window.webkitAudioContext
      if(!Ctx)throw new Error('当前浏览器不支持 Web Audio / Web Audio unavailable')
      state.ctx=new Ctx();await state.ctx.resume()
      state.source=state.ctx.createMediaStreamSource(state.stream)
      state.processor=state.ctx.createScriptProcessor(4096,1,1)
      state.gain=state.ctx.createGain();state.gain.gain.value=0
      state.source.connect(state.processor);state.processor.connect(state.gain);state.gain.connect(state.ctx.destination)
      state.chunks=[];state.sampleCount=0;state.queue=[];state.results.clear();state.inFlight=0;state.captureSeq=0;state.nextEmit=1
      state.processor.onaudioprocess=ev=>{
        if(!state.active)return
        const input=ev.inputBuffer.getChannelData(0),copy=new Float32Array(input.length);copy.set(input)
        state.chunks.push(copy);state.sampleCount+=copy.length
        const target=Math.round(state.ctx.sampleRate*CHUNK_SECONDS)
        if(state.sampleCount>=target)flushAudioChunk()
      }
      state.active=true;state.startedAt=Date.now();setLive(true)
      setStatus('BETA 2.0 · v10 · 云端语音转写已启动，翻译优先 / Cloud speech active · translation first')
    }catch(err){stop(false);setStatus(`启动失败 / Start failed: ${err?.message||err}`)}
  }

  function flushAudioChunk(){
    if(!state.sampleCount)return
    const merged=mergeFloat32(state.chunks,state.sampleCount),inRate=state.ctx?.sampleRate||48000
    state.chunks=[];state.sampleCount=0
    if(rms(merged)<0.0025){setStatus('BETA 2.0 · v10 · 正在监听，等待清晰语音… / Listening for speech…');return}
    const pcm=resample(merged,inRate,TARGET_RATE),blob=wavBlob(pcm,TARGET_RATE),seq=++state.captureSeq
    state.queue.push({seq,blob});pump()
  }

  function pump(){
    while(state.active&&state.inFlight<MAX_INFLIGHT&&state.queue.length){
      const item=state.queue.shift();state.inFlight++
      setStatus(`BETA 2.0 · v10 · 正在转写 ${state.inFlight}/${MAX_INFLIGHT} · 排队 ${state.queue.length} / Transcribing…`)
      transcribe(item.blob).then(text=>state.results.set(item.seq,{text})).catch(err=>state.results.set(item.seq,{error:String(err?.message||err)})).finally(()=>{
        state.inFlight--;emitInOrder();pump()
      })
    }
  }

  async function transcribe(blob){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000)
    try{
      const lang=$('sourceLanguage')?.value||'en-US',title=encodeURIComponent($('classTitle')?.value||'ClassFlow classroom')
      const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-transcribe-chunk`,{
        method:'POST',signal:controller.signal,
        headers:authHeaders({'Content-Type':'audio/wav','x-audio-mime':'audio/wav','x-source-language':lang,'x-course-title':title}),
        body:blob
      })
      const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
      if(!res.ok)throw new Error(data?.error||`Transcription failed (${res.status})`)
      return String(data?.text||'').trim()
    }catch(err){if(err?.name==='AbortError')throw new Error('转写超时 / transcription timeout');throw err}
    finally{clearTimeout(timer)}
  }

  function emitInOrder(){
    while(state.results.has(state.nextEmit)){
      const seq=state.nextEmit++,result=state.results.get(seq);state.results.delete(seq)
      if(result?.error){setStatus(`⚠ 第 ${seq} 段转写失败 / Transcription failed: ${result.error}`);continue}
      const text=String(result?.text||'').trim();if(!text)continue
      addEntry(text)
    }
  }

  function addEntry(text){
    const entry={id:crypto.randomUUID(),seq:state.entries.length+1,time:clock(),original:text,translation:'翻译中… / Translating',flags:[]}
    state.entries.push(entry);render();setStatus('原文已收到，正在翻译 / Transcript received; translating…')
    translate(entry)
    saveEntryBackground(entry)
  }

  async function translate(entry){
    if(($('sourceLanguage')?.value||'en-US')==='zh-CN'){entry.translation=entry.original;render();saveEntryBackground(entry,true);return}
    try{
      const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-ai`,{
        method:'POST',headers:authHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({action:'translate',text:entry.original,sourceLanguage:$('sourceLanguage')?.value||'en-US',courseTitle:$('classTitle')?.value||'课堂'})
      })
      const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
      if(!res.ok)throw new Error(data?.error||`Translation failed (${res.status})`)
      entry.translation=String(data?.translation||'').trim()||'⚠ AI 未返回译文 / Empty translation'
      setStatus('正在听课、转写并翻译 / Listening, transcribing and translating')
    }catch(err){entry.translation=`⚠ ${err?.message||'翻译失败 / Translation failed'}`;setStatus(`翻译异常 / Translation error: ${err?.message||err}`)}
    render();saveEntryBackground(entry,true)
  }

  async function ensureSession(){
    if(state.sessionId)return state.sessionId
    try{
      const res=await fetch(`${SUPABASE_URL}/rest/v1/classflow_sessions?select=id`,{
        method:'POST',headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify({title:$('classTitle')?.value||'未命名课堂 / Untitled Class',source_language:$('sourceLanguage')?.value||'en-US',target_language:'zh-CN'})
      })
      const data=await res.json();if(!res.ok)throw new Error(data?.message||`session ${res.status}`)
      state.sessionId=Array.isArray(data)?data[0]?.id:data?.id;return state.sessionId
    }catch{return null}
  }
  async function saveEntryBackground(entry,update=false){
    try{
      const sid=await ensureSession();if(!sid)return
      if(update&&entry.cloudId){
        await fetch(`${SUPABASE_URL}/rest/v1/classflow_segments?id=eq.${encodeURIComponent(entry.cloudId)}`,{method:'PATCH',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({translation:entry.translation,flags:entry.flags})});return
      }
      if(entry.cloudId)return
      const res=await fetch(`${SUPABASE_URL}/rest/v1/classflow_segments?select=id`,{method:'POST',headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),body:JSON.stringify({session_id:sid,seq:entry.seq,source_text:entry.original,translation:entry.translation?.startsWith('翻译中')?'':entry.translation,flags:entry.flags})})
      if(res.ok){const data=await res.json();entry.cloudId=Array.isArray(data)?data[0]?.id:data?.id}
    }catch{}
  }

  function stop(update=true){
    if(state.sampleCount>0&&state.active)flushAudioChunk()
    state.active=false
    try{state.processor&&(state.processor.onaudioprocess=null,state.processor.disconnect())}catch{}
    try{state.source?.disconnect()}catch{};try{state.gain?.disconnect()}catch{}
    state.stream?.getTracks().forEach(t=>t.stop())
    try{state.ctx?.close()}catch{}
    state.stream=state.ctx=state.source=state.processor=state.gain=null
    state.chunks=[];state.sampleCount=0;setLive(false)
    if(update)setStatus('已暂停 / Paused')
  }

  function toggleFlag(id,flag){const e=state.entries.find(x=>x.id===id);if(!e)return;e.flags=e.flags.includes(flag)?e.flags.filter(x=>x!==flag):[...e.flags,flag];render();saveEntryBackground(e,true)}
  function markLatest(flag){const e=state.entries.at(-1);if(e)toggleFlag(e.id,flag)}

  async function generateNotes(ev){
    ev?.preventDefault();ev?.stopImmediatePropagation();if(!state.entries.length)return
    const b=$('generateNotes');if(b){b.disabled=true;b.textContent='正在整理… / Generating'}
    try{
      const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-ai`,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'notes',title:$('classTitle')?.value||'课堂',entries:state.entries})})
      const data=await res.json();if(!res.ok)throw new Error(data?.error||`Notes failed (${res.status})`)
      state.notes=String(data?.notes||'');const out=$('notesOutput');if(out){out.hidden=false;out.textContent=state.notes}
      setStatus('AI 课堂笔记已生成 / Notes generated')
    }catch(err){setStatus(`笔记生成失败 / Notes failed: ${err?.message||err}`)}
    finally{if(b){b.disabled=false;b.textContent='生成课堂笔记 / Generate Class Notes'}}
  }

  function download(content,type,ext){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${$('classTitle')?.value||'课堂记录'}_${new Date().toISOString().slice(0,10)}.${ext}`;a.click();URL.revokeObjectURL(url)}
  function exportMd(ev){ev?.preventDefault();ev?.stopImmediatePropagation();const rows=state.entries.map(e=>`### ${e.time}${e.flags.length?` · ${e.flags.join(' / ')}`:''}\n\n**原文 / Original**：${e.original}\n\n**翻译 / Translation**：${e.translation}\n`).join('\n');download(`# ${$('classTitle')?.value||'课堂'}\n\n${rows}${state.notes?`\n---\n\n# AI 课堂笔记\n\n${state.notes}`:''}`,'text/markdown;charset=utf-8','md')}
  function exportWord(ev){ev?.preventDefault();ev?.stopImmediatePropagation();const rows=state.entries.map(e=>`<h3>${esc(e.time)}</h3><p><b>原文 / Original：</b>${esc(e.original)}</p><p><b>翻译 / Translation：</b>${esc(e.translation)}</p>`).join('');download('\ufeff'+`<!doctype html><html><meta charset="utf-8"><body><h1>${esc($('classTitle')?.value||'课堂')}</h1>${rows}${state.notes?`<h1>AI 课堂笔记</h1><pre>${esc(state.notes)}</pre>`:''}</body></html>`,'application/msword','doc')}

  function reset(ev){ev?.preventDefault();ev?.stopImmediatePropagation();stop(false);state.entries=[];state.sessionId=null;state.notes='';const out=$('notesOutput');if(out){out.hidden=true;out.textContent=''};if($('classTitle'))$('classTitle').value='新课堂 / New Class';render();setStatus('已新建课堂，点击开始听课 / New class ready')}

  function bind(){
    const btn=$('recordButton');if(btn)btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();state.active?stop():start()},{capture:true})
    $('newSession')?.addEventListener('click',reset,{capture:true})
    $('generateNotes')?.addEventListener('click',generateNotes,{capture:true})
    $('exportMd')?.addEventListener('click',exportMd,{capture:true})
    $('exportWord')?.addEventListener('click',exportWord,{capture:true})
    document.querySelectorAll('#quickFlags [data-flag]').forEach(b=>b.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();markLatest(b.dataset.flag)},{capture:true}))
    window.addEventListener('beforeunload',()=>stop(false))
    render();setStatus('BETA 2.0 · v10 · 云端语音翻译核心已准备 / Cloud translation core ready')
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind()
})()
