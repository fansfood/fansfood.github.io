(()=>{
  // Beta v5 transport + microphone guard.
  // Current Realtime WebRTC call creation uses multipart/form-data with an
  // `sdp` field. beta.js still sends raw SDP, so normalize that request here.
  const nativeFetch=window.fetch.bind(window)
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||''
    if(url==='https://api.openai.com/v1/realtime/calls'&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
      const form=new FormData()
      form.append('sdp',init.body)
      const headers=new Headers(init.headers||{})
      headers.delete('Content-Type')
      return nativeFetch(input,{...init,headers,body:form})
    }
    return nativeFetch(input,init)
  }

  const media=navigator.mediaDevices
  if(!media?.getUserMedia)return
  const nativeGetUserMedia=media.getUserMedia.bind(media)
  let ctx=null,analyser=null,meterTimer=null,lastHeardAt=0,listenStartedAt=0,autoFallbackDone=false
  window.__classflowMicLevel=0

  function friendlyMediaError(err){
    const name=String(err?.name||'')
    if(name==='NotAllowedError'||name==='SecurityError')return new Error('浏览器没有麦克风权限。请在当前网页的站点权限中允许“麦克风”，然后重新开始。 / Microphone permission is blocked for this site.')
    if(name==='NotFoundError'||name==='DevicesNotFoundError')return new Error('没有找到可用麦克风。 / No microphone was found on this device.')
    if(name==='NotReadableError'||name==='TrackStartError')return new Error('麦克风暂时无法读取，可能正被其他应用占用。请关闭占用麦克风的应用后重试。 / Microphone is busy or unavailable.')
    return err
  }

  async function startMeter(stream){
    try{
      clearInterval(meterTimer)
      ctx=ctx||new (window.AudioContext||window.webkitAudioContext)()
      if(ctx.state==='suspended')await ctx.resume().catch(()=>{})
      const source=ctx.createMediaStreamSource(stream)
      analyser=ctx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.72;source.connect(analyser)
      const buf=new Uint8Array(analyser.fftSize)
      meterTimer=setInterval(()=>{
        if(!analyser)return
        analyser.getByteTimeDomainData(buf);let sum=0
        for(const v of buf){const x=(v-128)/128;sum+=x*x}
        const rms=Math.sqrt(sum/buf.length);window.__classflowMicLevel=rms
        if(rms>.008)lastHeardAt=Date.now()
        const badge=document.getElementById('classflowMicBadge')
        if(badge){const pct=Math.min(99,Math.max(0,Math.round(rms*700)));badge.textContent=`🎙 麦克风 / Mic: ${pct}%`;badge.dataset.active=rms>.008?'1':'0'}
      },180)
    }catch{}
  }

  media.getUserMedia=async function(constraints){
    let stream
    try{stream=await nativeGetUserMedia(constraints)}
    catch(err){
      if(constraints?.audio&&String(err?.name||'')==='OverconstrainedError'){
        try{stream=await nativeGetUserMedia({audio:true,video:false})}catch(second){throw friendlyMediaError(second)}
      }else throw friendlyMediaError(err)
    }
    window.__classflowMicStream=stream;startMeter(stream);return stream
  }

  function setupUi(){
    const strip=document.querySelector('.beta-strip')
    if(strip&&!document.getElementById('classflowMicBadge')){
      const wrap=document.createElement('div')
      wrap.innerHTML='<strong id="classflowMicBadge">🎙 麦克风 / Mic: 待机</strong><small>实时输入检测 / Input monitor</small>'
      strip.insertBefore(wrap,strip.firstChild)
    }
    const button=document.getElementById('recordButton'),label=document.getElementById('recordLabel'),status=document.getElementById('status'),pipeline=document.getElementById('pipelinePill'),mode=document.getElementById('pipelineMode'),original=document.getElementById('originalStream')
    if(!button||!label||!status||!pipeline||!mode||!original)return

    button.addEventListener('click',()=>setTimeout(()=>{const running=/暂停|Pause/.test(label.textContent||'');if(running){listenStartedAt=Date.now();lastHeardAt=0;autoFallbackDone=false}else{listenStartedAt=0;autoFallbackDone=false}},120))

    setInterval(()=>{
      const running=/暂停|Pause/.test(label.textContent||'')
      if(!running||!listenStartedAt)return
      const elapsed=Date.now()-listenStartedAt,recentAudio=lastHeardAt>0&&Date.now()-lastHeardAt<2600,hasFinal=!!original.querySelector('.speech-card:not(.interim)'),realtime=/Realtime/i.test(pipeline.textContent||'')
      if(elapsed>6000&&!recentAudio&&window.__classflowMicLevel<.004)status.textContent='⚠ 没有检测到麦克风声音。请检查当前浏览器的麦克风权限。 / No microphone audio detected.'
      if(elapsed>7000&&realtime&&recentAudio&&!hasFinal&&!autoFallbackDone&&mode.value==='auto'){
        autoFallbackDone=true
        status.textContent='检测到麦克风有声音，但 Realtime 暂无字幕，正在切换备用音频识别… / Mic audio detected; switching to resilient audio fallback…'
        mode.value='browser';button.click();setTimeout(()=>button.click(),500)
      }
    },800)
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupUi,{once:true});else setupUi()
})()