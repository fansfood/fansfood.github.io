(()=>{
  const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
  const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
  const NativeRecognition=window.SpeechRecognition||window.webkitSpeechRecognition
  const CLOUD_ERRORS=new Set(['network','service-not-allowed','not-allowed','audio-capture','aborted'])
  const CHUNK_MS=3000
  const TARGET_RATE=16000
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

  function getSharedMic(){
    const stream=window.__classflowMicStream
    if(!stream?.active)return null
    const track=stream.getAudioTracks?.()[0]
    if(!track||track.readyState!=='live')return null
    return stream
  }

  function concatFloat32(parts,total){
    const out=new Float32Array(total)
    let offset=0
    for(const part of parts){out.set(part,offset);offset+=part.length}
    return out
  }

  function resampleLinear(input,fromRate,toRate){
    if(fromRate===toRate)return input
    const ratio=fromRate/toRate
    const length=Math.max(1,Math.floor(input.length/ratio))
    const out=new Float32Array(length)
    for(let i=0;i<length;i++){
      const pos=i*ratio
      const left=Math.floor(pos)
      const right=Math.min(input.length-1,left+1)
      const frac=pos-left
      out[i]=input[left]*(1-frac)+input[right]*frac
    }
    return out
  }

  function wavBlob(samples,sampleRate){
    const buffer=new ArrayBuffer(44+samples.length*2)
    const view=new DataView(buffer)
    const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
    write(0,'RIFF')
    view.setUint32(4,36+samples.length*2,true)
    write(8,'WAVE')
    write(12,'fmt ')
    view.setUint32(16,16,true)
    view.setUint16(20,1,true)
    view.setUint16(22,1,true)
    view.setUint32(24,sampleRate,true)
    view.setUint32(28,sampleRate*2,true)
    view.setUint16(32,2,true)
    view.setUint16(34,16,true)
    write(36,'data')
    view.setUint32(40,samples.length*2,true)
    let offset=44
    for(let i=0;i<samples.length;i++,offset+=2){
      const s=Math.max(-1,Math.min(1,samples[i]))
      view.setInt16(offset,s<0?s*0x8000:s*0x7fff,true)
    }
    return new Blob([buffer],{type:'audio/wav'})
  }

  class ResilientSpeechRecognition{
    constructor(){
      this.lang='en-US';this.continuous=true;this.interimResults=true
      this.onresult=null;this.onerror=null;this.onend=null;this.onstart=null
      this._native=NativeRecognition?new NativeRecognition():null
      this._mode='native';this._stopped=true;this._stream=null;this._ownsStream=false
      this._watchdog=null;this._ctx=null;this._source=null;this._processor=null;this._silentGain=null
      this._pcm=[];this._pcmSamples=0;this._energy=0;this._energySamples=0
      this._gotResult=false;this._sendSeq=0;this._nextEmit=1
      this._queue=[];this._results=new Map();this._inFlight=0
      if(this._native)this._bindNative()
    }

    _bindNative(){
      this._native.onstart=()=>{
        this._mode='native';this._gotResult=false;this.onstart?.()
        clearTimeout(this._watchdog)
        this._watchdog=setTimeout(()=>{if(!this._stopped&&!this._gotResult)this._switchToCloud('timeout')},6500)
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
      this.onstart?.()
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
      setCloudUi(true,`浏览器识别异常（${reason}），正在启动 PCM 音频云转写… / Starting PCM Audio Cloud…`)
      try{
        const shared=getSharedMic()
        if(shared){this._stream=shared;this._ownsStream=false}
        else{this._stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});this._ownsStream=true}
        const AC=window.AudioContext||window.webkitAudioContext
        if(!AC)throw new Error('当前浏览器不支持 Web Audio / Web Audio unavailable')
        this._ctx=new AC()
        if(this._ctx.state==='suspended')await this._ctx.resume().catch(()=>{})
        this._source=this._ctx.createMediaStreamSource(this._stream)
        const createProcessor=this._ctx.createScriptProcessor?.bind(this._ctx)
        if(!createProcessor)throw new Error('当前浏览器缺少 PCM 音频处理能力 / PCM audio processor unavailable')
        this._processor=createProcessor(4096,1,1)
        this._silentGain=this._ctx.createGain()
        this._silentGain.gain.value=0.00001
        this._source.connect(this._processor)
        this._processor.connect(this._silentGain)
        this._silentGain.connect(this._ctx.destination)
        this._processor.onaudioprocess=e=>this._onPcm(e)
        setCloudUi(true,'PCM Audio Cloud 已启动，等待老师讲话… / PCM Audio Cloud ready; waiting for speech…')
      }catch(err){
        cloudError(String(err?.message||err))
        this.onerror?.({error:'audio-capture',message:String(err?.message||err)})
      }
    }

    _onPcm(event){
      if(this._stopped||this._mode!=='cloud')return
      const input=event.inputBuffer.getChannelData(0)
      const copy=new Float32Array(input.length);copy.set(input)
      let energy=0
      for(let i=0;i<copy.length;i++)energy+=copy[i]*copy[i]
      this._pcm.push(copy);this._pcmSamples+=copy.length
      this._energy+=energy;this._energySamples+=copy.length
      const needed=Math.floor(this._ctx.sampleRate*(CHUNK_MS/1000))
      if(this._pcmSamples>=needed)this._finalizePcmChunk()
    }

    _finalizePcmChunk(){
      const parts=this._pcm;const total=this._pcmSamples
      const rms=this._energySamples?Math.sqrt(this._energy/this._energySamples):0
      this._pcm=[];this._pcmSamples=0;this._energy=0;this._energySamples=0
      const outer=Number(window.__classflowMicLevel||0)
      const heard=rms>.0015||outer>.003
      if(!heard){
        setCloudUi(true,'PCM Audio Cloud 已就绪，等待老师讲话… / PCM Audio Cloud ready; waiting for speech…')
        return
      }
      const merged=concatFloat32(parts,total)
      const pcm=resampleLinear(merged,this._ctx.sampleRate,TARGET_RATE)
      const blob=wavBlob(pcm,TARGET_RATE)
      const seq=++this._sendSeq
      this._queue.push({seq,blob})
      if(this._queue.length>8)this._queue.splice(0,this._queue.length-8)
      this._updateQueueUi()
      this._pump()
    }

    _updateQueueUi(){
      if(this._mode!=='cloud')return
      setCloudUi(true,`PCM Audio Cloud 工作中 · 转写 ${this._inFlight}/${MAX_PARALLEL} · 等待 ${this._queue.length} / Transcribing ${this._inFlight}/${MAX_PARALLEL}, queued ${this._queue.length}`)
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
        const alt={transcript:text,confidence:1}
        const speechResult=[alt];speechResult.isFinal=true
        this._gotResult=true
        this.onresult?.({resultIndex:0,results:[speechResult]})
        setCloudUi(true,`PCM Audio Cloud 正常 · 已完成第 ${seq} 段 / PCM Audio Cloud active · chunk ${seq}`)
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
          headers:{'Authorization':`Bearer ${token}`,'apikey':SUPABASE_KEY,'Content-Type':'audio/wav','x-audio-mime':'audio/wav','x-source-language':this.lang,'x-course-title':title,'x-classflow-chunk':String(seq)},
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
      try{if(this._processor)this._processor.onaudioprocess=null}catch{}
      try{this._source?.disconnect()}catch{}
      try{this._processor?.disconnect()}catch{}
      try{this._silentGain?.disconnect()}catch{}
      this._source=null;this._processor=null;this._silentGain=null
      if(this._ownsStream)this._stream?.getTracks().forEach(t=>t.stop())
      this._stream=null;this._ownsStream=false
      try{this._ctx?.close()}catch{};this._ctx=null
      this._pcm=[];this._pcmSamples=0;this._energy=0;this._energySamples=0
      this._queue=[];this._results.clear();this._inFlight=0;this._nextEmit=1;this._sendSeq=0
      document.documentElement.dataset.classflowAudioCloud='0'
    }
  }

  window.SpeechRecognition=ResilientSpeechRecognition
  window.webkitSpeechRecognition=ResilientSpeechRecognition

  setInterval(()=>{
    if(document.documentElement.dataset.classflowAudioCloud==='1'){
      const pill=document.getElementById('pipelinePill');if(pill)pill.textContent='管线 / Pipeline: Audio Cloud'
      const rt=document.getElementById('realtimeStatus');if(rt)rt.textContent='OpenAI PCM 云转写 / PCM Audio Cloud'
    }
  },500)
})()