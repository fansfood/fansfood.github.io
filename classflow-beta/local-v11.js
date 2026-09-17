(()=>{
  const $=id=>document.getElementById(id)
  const state={recognition:null,active:false,shouldRestart:false,entries:[],interim:''}
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
  const clock=()=>new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())
  const setStatus=t=>{if($('status'))$('status').textContent=t}
  function setLive(on){
    $('livePill')?.classList.toggle('active',on)
    if($('liveText'))$('liveText').textContent=on?'LIVE':'READY'
    const btn=$('recordButton');btn?.classList.toggle('stop',on)
    const icon=btn?.querySelector('.record-icon');if(icon)icon.textContent=on?'■':'●'
    if($('recordLabel'))$('recordLabel').textContent=on?'暂停听课 / Pause':'开始听课 / Start'
  }
  function render(){
    if($('recordCount'))$('recordCount').textContent=`${state.entries.length} 条记录 / records`
    const cards=state.entries.map(e=>`<article class="speech-card"><div class="meta"><span>${esc(e.time)}</span></div><p>${esc(e.original)}</p></article>`).join('')
    const interim=state.interim?`<article class="speech-card interim"><div class="meta"><span>正在识别 / Listening</span></div><p>${esc(state.interim)}</p></article>`:''
    if($('originalStream'))$('originalStream').innerHTML=cards+interim||'<div class="empty-state"><p>点击“开始听课 / Start”，这里会显示浏览器本地识别原文。</p></div>'
    const localMsg='<div class="empty-state"><p><strong>本地优先模式 / Local First</strong><br>当前先验证语音识别稳定性，暂不调用 AI 翻译。</p></div>'
    if($('translationStream'))$('translationStream').innerHTML=localMsg
    if($('reviewArea'))$('reviewArea').innerHTML=localMsg
    if($('generateNotes')){$('generateNotes').disabled=true;$('generateNotes').textContent='本地模式暂不生成 AI 笔记 / AI Notes Off'}
    if($('exportMd'))$('exportMd').disabled=!state.entries.length
    if($('exportWord'))$('exportWord').disabled=!state.entries.length
    requestAnimationFrame(()=>{const el=$('originalStream');if(el)el.scrollTop=el.scrollHeight})
  }
  function makeRecognition(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition
    if(!Recognition){setStatus('当前浏览器不支持网页语音识别 / SpeechRecognition unavailable');return null}
    const r=new Recognition()
    r.lang=$('sourceLanguage')?.value||'en-US'
    r.continuous=true
    r.interimResults=true
    r.maxAlternatives=1
    r.onstart=()=>{setStatus('BETA 2.0 · v11 · 本地识别中 / Local-first speech recognition active')}
    r.onresult=ev=>{
      let inter=''
      for(let i=ev.resultIndex;i<ev.results.length;i++){
        const res=ev.results[i],text=(res[0]?.transcript||'').trim()
        if(!text)continue
        if(res.isFinal){state.entries.push({id:crypto.randomUUID(),time:clock(),original:text});state.interim=''}
        else inter+=(inter?' ':'')+text
      }
      state.interim=inter.trim();render()
    }
    r.onerror=ev=>{
      if(ev.error==='not-allowed'||ev.error==='service-not-allowed'){
        state.shouldRestart=false;state.active=false;setLive(false)
        setStatus('麦克风或语音识别权限被拒绝，请在浏览器网站权限中允许麦克风 / Permission denied')
        return
      }
      if(ev.error==='network')setStatus('浏览器语音服务网络异常 / Browser speech network error')
      else if(ev.error!=='no-speech'&&ev.error!=='aborted')setStatus(`语音识别异常 / Speech recognition error: ${ev.error}`)
    }
    r.onend=()=>{
      state.interim=''
      if(state.shouldRestart&&state.active){setTimeout(()=>{try{r.start()}catch{}},350)}
      else render()
    }
    return r
  }
  function start(){
    if(state.active)return
    const r=makeRecognition();if(!r)return
    state.recognition=r;state.shouldRestart=true;state.active=true;setLive(true)
    try{r.start()}catch(err){state.active=false;state.shouldRestart=false;setLive(false);setStatus(`无法启动语音识别 / Could not start: ${err?.message||err}`)}
  }
  function stop(){
    state.shouldRestart=false;state.active=false;state.interim=''
    try{state.recognition?.stop()}catch{}
    state.recognition=null;setLive(false);setStatus('已暂停 / Paused');render()
  }
  function installOverride(){
    const old=$('recordButton');if(!old)return
    const fresh=old.cloneNode(true);old.replaceWith(fresh)
    fresh.id='recordButton'
    fresh.onclick=()=>state.active?stop():start()
    const newClass=$('newSession');if(newClass){
      const replacement=newClass.cloneNode(true);newClass.replaceWith(replacement);replacement.id='newSession';replacement.onclick=()=>{stop();state.entries=[];state.interim='';if($('classTitle'))$('classTitle').value='新课堂 / New Class';setStatus('已新建本地课堂 / New local class');render()}
    }
    if($('sourceLanguage'))$('sourceLanguage').onchange=()=>{if(state.active){stop();setStatus('语言已切换，请重新开始 / Language changed; tap Start again')}}
    document.querySelectorAll('.subtitle-zh').forEach(el=>el.textContent='BETA 2.0 · v11 · 本地优先课堂识别')
    document.querySelectorAll('.subtitle-en').forEach(el=>el.textContent='BETA 2.0 · v11 · Local-first classroom transcription')
    document.querySelectorAll('.auth-card .eyebrow').forEach(el=>el.textContent='CLASSFLOW BETA · 2.0 · v11')
    document.title='ClassFlow Beta 2.0 · v11 · Local First'
    render();setStatus('BETA 2.0 · v11 · 本地优先，不调用 OpenAI / Local first · no OpenAI calls')
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(installOverride,300),{once:true});else setTimeout(installOverride,300)
})()
