(()=>{
  const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
  const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
  const NativeRecognition=window.SpeechRecognition||window.webkitSpeechRecognition
  const CLOUD_ERRORS=new Set(['network','service-not-allowed','not-allowed','audio-capture','aborted'])
  const CHUNK_MS=3200
  const MAX_PARALLEL=2

  function findAccessToken(value,depth=0){
    if(depth>6||!value||typeof value!=='object')return''
    if(typeof value.access_token==='string'&&value.access_token)return value.access_token
    for(const key of Object.keys(value)){
      const token=findAccessToken(value[key],depth+1)
      if(token)return token
    }
    return''
  }

  function sessionToken(){
    const preferred=['classflow-auth-v1']
    for(const key of preferred){
      try{const raw=localStorage.getItem(key);if(raw){const t=findAccessToken(JSON.parse(raw));if(t)return t}}catch{}
    }
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i)||''
      if(!/auth|supabase|classflow/i.test(key))continue
      try{const raw=localStorage.getItem(key);if(raw){const t=findAccessToken(JSON.parse(raw));if(t)return t}}catch{}
    }
    return''
  }

  function mimeChoice(){
    const list=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus']
    return list.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||''
  }

  function getSharedMic(){
    const source=window.__classflowMicStream
    if(!source?.active)return null
    const track=source.getAudioTracks?.()[0]
    if(!track||track.readyState!=='live')return null
    try{
      const clone=track.clone()
      return {stream:new MediaStream([clone]),owned:true,source:'clone'}
    }catch{
      return {stream:source,owned:false,source:'shared'}
    }
  }

  function setCloudUi(active=true,detail=''){
    document.documentElement.dataset.classflowAudioCloud=active?'1':'0'
    const status=document.getElementById('status')
    if(active&&status&&detail)status.textContent=detail
    const pill=document.getElementById('pipelinePill')
    if(active&&pill)pill.textContent='管线 / Pipeline: Audio Cloud'
    const rt=document.getElementById('realtimeStatus')
    if(active&&rt)rt.textContent='OpenAI 音频云 / Audio Cloud'
  }

  function cloudError(message){
    setCloudUi(true,`⚠ Audio Cloud：${message}`)
    console.error('[ClassFlow Audio Cloud]',message)
  }

  class ResilientSpeechRecognition{
    constructor(){
      this.lang='en-US';this.continuous=true;this.interimResults=true
      this.onresult=null;this.onerror=null;this.onend=null;this.onstart=null
      this._native=NativeRecognition?new NativeRecognition():null
      this._mode='native';this._stopped=true;this._stream=null;this._ownsStream=false;this._recorder=null
      this._timer=null;this._watchdog=null;this._ctx=null;this._analyser=null;this._meter=null
      this._maxLevel=0;this._gotResult=false
      this._captureSeq=0;this._sendSeq=0;this._nextEmit=1
      this._queue=[];this._results=new Map();this._inFlight=0
      if(this._native)this._bindNative()
    }

    _bindNative(){
      this._native.onstart=()=>{
        this._mode='native';this._gotResult=false;this.onstart?.()
        clearTimeout(this._watchdog)
        this._watchdog=setTimeout(()=>{if(!this._stopped&&!this._gotResult)this._switchToCloud('timeout')},7000)
      }
      this._native.onresult=e=>{this._gotResult=true;clearTimeout(this._watchdog);this.onresult?.(e)}
      this._native.onerror=e=>{
        if(this._stopped)return
        if(CLOUD_ERRORS.has(e.error)||e.error==='network'){this._switchToCloud(e.error);return}
        this.onerror?.(e)
      }
      this._native.onend=()=>{
        if(this._stopped){this.onend?.();return}
        if(this._mode==='native'&&!this._gotResult)this._switchToCloud('ended')
        else if(this._mode==='native')this.onend?.()
      }
    }

    start(){
      this._stopped=false;this._gotResult=false
      if(this._native){
        this._native.lang=this.lang;this._native.continuous=this.continuous;this._native.interimResults=this.interimResults
        try{this._native.start();return}catch{}
      }
      this._switchToCloud('unavailable')
    }

    stop(){
      this._stopped=true;clearTimeout(this._watchdog)
      try{this._native?.stop()}catch{}
      this._stopCloud();this.onend?.()
    }

    abort(){
      this._stopped=true;clearTimeout(this._watchdog)
      try{this._native?.abort()}catch{}
      this._stopCloud();this.onend?.()
    }

    async _switchToCloud(reason){
      if(this._stopped||this._mode==='cloud')return
      this._mode='cloud';clearTimeout(this._watchdog)
      try{this._native?.abort()}catch{}
      setCloudUi(true,`浏览器识别异常（${reason}），正在启动 OpenAI 音频云转写… / Browser recognition failed; starting Audio Cloud…`)
      try{
        const shared=getSharedMic()
        if(shared){
          this._stream=shared.stream;this._ownsStream=shared.owned
          setCloudUi(true,'正在复用当前麦克风，不再重复申请收音权限… / Reusing the active microphone…')
        }else{
          this._stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
          this._ownsStream=true
        }
        if(!window.MediaRecorder)throw new Error('当前浏览器不支持 MediaRecorder / MediaRecorder unavailable')
        this._startMeter()
        this._recordCycle()
      }catch(err){
        cloudError(String(err?.message||err))
        this.onerror?.({error:'audio-capture',message:String(err?.message||err)})
      }
    }

    _startMeter(){
      try{
        this._ctx=new (window.AudioContext||window.webkitAudioContext)()
        const src=this._ctx.createMediaStreamSource(this._stream)
        this._analyser=this._ctx.createAnalyser();this._analyser.fftSize=256;src.connect(this._analyser)
        const buf=new Uint8Array(this._analyser.fftSize)
        this._meter=setInterval(()=>{
          if(!this._analyser)return
          this._analyser.getByteTimeDomainData(buf);let sum=0
          for(const v of buf){const x=(v-128)/128;sum+=x*x}
          const rms=Math.sqrt(sum/buf.length);this._maxLevel=Math.max(this._maxLevel,rms)
        },100)
      }catch(err){console.warn('[ClassFlow Audio Cloud] meter unavailable',err)}
    }

    _recordCycle(){
      if(this._stopped||this._mode!=='cloud'||!this._stream?.active)return
      const mime=mimeChoice(),chunks=[];this._maxLevel=0
      let recorder
      try{recorder=new MediaRecorder(this._stream,mime?{mimeType:mime,audioBitsPerSecond:48000}:{audioBitsPerSecond:48000})}
      catch(err){cloudError(`无法建立音频切片：${String(err?.message||err)}`);return}
      this._recorder=recorder
      const capture=++this._captureSeq
      recorder.onerror=e=>cloudError(`录音切片失败：${e?.error?.message||e?.error?.name||'unknown recorder error'}`)
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)}
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:recorder.mimeType||mime||'audio/webm'})
        const outerLevel=Number(window.__classflowMicLevel||0)
        const heard=this._maxLevel>.0035||outerLevel>.0035
        if(!this._stopped)setTimeout(()=>this._recordCycle(),30)
        if(!heard){
          setCloudUi(true,'Audio Cloud 已就绪，等待老师讲话… / Audio Cloud ready; waiting for speech…')
          return
        }
        if(blob.size<=700){cloudError(`音频片段过小（${blob.size} B），继续监听`);return}
        const seq=++this._sendSeq
        this._queue.push({seq,blob,capture})
        this._updateQueueUi()
        this._pump()
      }
      try{recorder.start()}catch(err){cloudError(`录音启动失败：${String(err?.message||err)}`);return}
      this._timer=setTimeout(()=>{try{if(recorder.state!=='inactive')recorder.stop()}catch{}},CHUNK_MS)
    }

    _updateQueueUi(){
      if(this._mode!=='cloud')return
      const pending=this._queue.length+this._inFlight
      setCloudUi(true,`Audio Cloud 工作中 · 转写 ${this._inFlight}/${MAX_PARALLEL} · 等待 ${this._queue.length} / Transcribing ${this._inFlight}/${MAX_PARALLEL}, queued ${this._queue.length}`)
      document.documentElement.dataset.classflowCloudBacklog=String(pending)
    }

    _pump(){
      while(!this._stopped&&this._mode==='cloud'&&this._inFlight<MAX_PARALLEL&&this._queue.length){
        const item=this._queue.shift();this._inFlight++;this._updateQueueUi()
        this._transcribe(item.blob,item.seq).then(text=>{
          this._results.set(item.seq,{text})
        }).catch(err=>{
          this._results.set(item.seq,{error:String(err?.message||err)})
        }).finally(()=>{
          this._inFlight--;this._flushResults();this._updateQueueUi();this._pump()
        })
      }
    }

    _flushResults(){
      while(this._results.has(this._nextEmit)){
        const seq=this._nextEmit++,result=this._results.get(seq);this._results.delete(seq)
        if(result?.error){cloudError(`第 ${seq} 段转写失败：${result.error}`);continue}
        const text=String(result?.text||'').trim()
        if(!text)continue
        const alt={transcript:text,confidence:1},speechResult=[alt];speechResult.isFinal=true
        this._gotResult=true
        this.onresult?.({resultIndex:0,results:[speechResult]})
        setCloudUi(true,`Audio Cloud 正常 · 已完成第 ${seq} 段 / Audio Cloud active · chunk ${seq}`)
      }
    }

    async _transcribe(blob,seq){
      const token=sessionToken()
      if(!token)throw new Error('登录会话令牌不可用，请退出后重新登录 Beta / Missing auth token; please sign in again')
      const title=encodeURIComponent(document.getElementById('classTitle')?.value||'ClassFlow classroom')
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),22000)
      try{
        const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-transcribe-chunk`,{
          method:'POST',signal:controller.signal,
          headers:{'Authorization':`Bearer ${token}`,'apikey':SUPABASE_KEY,'Content-Type':blob.type||'audio/webm','x-audio-mime':blob.type||'audio/webm','x-source-language':this.lang,'x-course-title':title,'x-classflow-chunk':String(seq)},
          body:blob
        })
        const raw=await res.text();let data={}
        try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
        if(!res.ok)throw new Error(data?.error||`Audio transcription failed (${res.status})`)
        return String(data?.text||'').trim()
      }catch(err){
        if(err?.name==='AbortError')throw new Error('云转写超时 / transcription timeout')
        throw err
      }finally{clearTimeout(timeout)}
    }

    _stopCloud(){
      clearTimeout(this._timer);clearInterval(this._meter);this._timer=null;this._meter=null
      try{if(this._recorder&&this._recorder.state!=='inactive')this._recorder.stop()}catch{}
      this._recorder=null
      if(this._ownsStream)this._stream?.getTracks().forEach(t=>t.stop())
      this._stream=null;this._ownsStream=false
      this._queue=[];this._results.clear();this._inFlight=0;this._nextEmit=1;this._sendSeq=0;this._captureSeq=0
      try{this._ctx?.close()}catch{};this._ctx=null;this._analyser=null
      document.documentElement.dataset.classflowAudioCloud='0'
    }
  }

  window.SpeechRecognition=ResilientSpeechRecognition
  window.webkitSpeechRecognition=ResilientSpeechRecognition

  setInterval(()=>{
    if(document.documentElement.dataset.classflowAudioCloud==='1'){
      const pill=document.getElementById('pipelinePill');if(pill)pill.textContent='管线 / Pipeline: Audio Cloud'
      const rt=document.getElementById('realtimeStatus');if(rt)rt.textContent='OpenAI 音频云 / Audio Cloud'
    }
  },500)
})()