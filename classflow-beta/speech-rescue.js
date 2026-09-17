(()=>{
  const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
  const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
  const NativeRecognition=window.SpeechRecognition||window.webkitSpeechRecognition
  const CLOUD_ERRORS=new Set(['network','service-not-allowed','not-allowed','audio-capture','aborted'])

  function sessionToken(){
    try{
      const raw=localStorage.getItem('classflow-auth-v1')
      if(!raw)return''
      const obj=JSON.parse(raw)
      return obj?.access_token||obj?.currentSession?.access_token||obj?.session?.access_token||''
    }catch{return''}
  }

  function mimeChoice(){
    const list=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus']
    return list.find(x=>window.MediaRecorder?.isTypeSupported?.(x))||''
  }

  function setCloudUi(active=true,detail=''){
    document.documentElement.dataset.classflowAudioCloud=active?'1':'0'
    const status=document.getElementById('status')
    if(active&&status)status.textContent=detail||'浏览器语音服务不可用，已切换 OpenAI 音频云转写 / Browser speech unavailable; using OpenAI audio transcription'
    const pill=document.getElementById('pipelinePill')
    if(active&&pill)pill.textContent='管线 / Pipeline: Audio Cloud'
    const rt=document.getElementById('realtimeStatus')
    if(active&&rt)rt.textContent='OpenAI 音频兼容 / Audio fallback'
  }

  class ResilientSpeechRecognition{
    constructor(){
      this.lang='en-US';this.continuous=true;this.interimResults=true
      this.onresult=null;this.onerror=null;this.onend=null;this.onstart=null
      this._native=NativeRecognition?new NativeRecognition():null
      this._mode='native';this._stopped=true;this._stream=null;this._recorder=null
      this._timer=null;this._watchdog=null;this._ctx=null;this._analyser=null;this._meter=null
      this._maxLevel=0;this._upload=Promise.resolve();this._gotResult=false
      if(this._native)this._bindNative()
    }
    _bindNative(){
      this._native.onstart=()=>{this._mode='native';this._gotResult=false;this.onstart?.();clearTimeout(this._watchdog);this._watchdog=setTimeout(()=>{if(!this._stopped&&!this._gotResult)this._switchToCloud('timeout')},8000)}
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
    stop(){this._stopped=true;clearTimeout(this._watchdog);try{this._native?.stop()}catch{};this._stopCloud();this.onend?.()}
    abort(){this._stopped=true;clearTimeout(this._watchdog);try{this._native?.abort()}catch{};this._stopCloud();this.onend?.()}
    async _switchToCloud(reason){
      if(this._stopped||this._mode==='cloud')return
      this._mode='cloud';clearTimeout(this._watchdog);try{this._native?.abort()}catch{}
      setCloudUi(true,`浏览器识别异常（${reason}），已自动切换 OpenAI 音频云转写 / Browser recognition failed; switched to OpenAI audio transcription`)
      try{
        this._stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
        this._startMeter()
        this._recordCycle()
      }catch(err){
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
        },120)
      }catch{}
    }
    _recordCycle(){
      if(this._stopped||this._mode!=='cloud'||!this._stream)return
      const mime=mimeChoice(),chunks=[];this._maxLevel=0
      let r
      try{r=new MediaRecorder(this._stream,mime?{mimeType:mime,audioBitsPerSecond:48000}:{audioBitsPerSecond:48000})}
      catch(err){this.onerror?.({error:'audio-capture',message:String(err)});return}
      this._recorder=r
      r.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)}
      r.onstop=()=>{
        const blob=new Blob(chunks,{type:r.mimeType||mime||'audio/webm'}),heard=this._maxLevel>.006
        if(!this._stopped)this._recordCycle()
        if(heard&&blob.size>1200)this._upload=this._upload.then(()=>this._transcribe(blob)).catch(()=>{})
      }
      r.start();this._timer=setTimeout(()=>{try{if(r.state!=='inactive')r.stop()}catch{}},4200)
    }
    async _transcribe(blob){
      const token=sessionToken();if(!token)return
      const title=encodeURIComponent(document.getElementById('classTitle')?.value||'ClassFlow classroom')
      const res=await fetch(`${SUPABASE_URL}/functions/v1/classflow-transcribe-chunk`,{
        method:'POST',
        headers:{'Authorization':`Bearer ${token}`,'apikey':SUPABASE_KEY,'Content-Type':blob.type||'audio/webm','x-audio-mime':blob.type||'audio/webm','x-source-language':this.lang,'x-course-title':title},
        body:blob
      })
      const data=await res.json().catch(()=>({}))
      if(!res.ok)throw new Error(data?.error||`Audio transcription failed (${res.status})`)
      const text=String(data?.text||'').trim();if(!text)return
      const alt={transcript:text,confidence:1},result=[alt];result.isFinal=true
      this._gotResult=true;this.onresult?.({resultIndex:0,results:[result]})
      setCloudUi(true,'OpenAI 音频云转写工作中 / OpenAI audio transcription active')
    }
    _stopCloud(){
      clearTimeout(this._timer);clearInterval(this._meter);this._timer=null;this._meter=null
      try{if(this._recorder&&this._recorder.state!=='inactive')this._recorder.stop()}catch{}
      this._recorder=null;this._stream?.getTracks().forEach(t=>t.stop());this._stream=null
      try{this._ctx?.close()}catch{};this._ctx=null;this._analyser=null
      setCloudUi(false)
    }
  }

  window.SpeechRecognition=ResilientSpeechRecognition
  window.webkitSpeechRecognition=ResilientSpeechRecognition

  setInterval(()=>{
    if(document.documentElement.dataset.classflowAudioCloud==='1'){
      const pill=document.getElementById('pipelinePill');if(pill)pill.textContent='管线 / Pipeline: Audio Cloud'
      const rt=document.getElementById('realtimeStatus');if(rt)rt.textContent='OpenAI 音频兼容 / Audio fallback'
    }
  },700)
})()