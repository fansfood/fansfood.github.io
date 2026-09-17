(()=>{
  const media=navigator.mediaDevices
  const nativeGetUserMedia=media?.getUserMedia?.bind(media)

  function stableMode(){
    return document.getElementById('pipelineMode')?.value==='browser'
  }

  function applyModeUi(){
    const mode=document.getElementById('pipelineMode')
    const recording=document.getElementById('recordingToggle')
    const recordingStatus=document.getElementById('recordingStatus')
    const segmentStatus=document.getElementById('segmentStatus')
    if(!mode||!recording)return

    if(mode.value==='browser'){
      recording.checked=false
      recording.disabled=true
      if(recordingStatus)recordingStatus.textContent='稳定模式关闭 / Off in Stable mode'
      if(segmentStatus)segmentStatus.textContent='浏览器原生断句 / Browser native'
    }else{
      recording.disabled=false
      if(recordingStatus)recordingStatus.textContent='待机 / Idle'
      if(segmentStatus)segmentStatus.textContent='Realtime 实验断句 / Experimental VAD'
    }
  }

  if(media&&nativeGetUserMedia){
    media.getUserMedia=async function(constraints){
      if(stableMode()){
        // Stable mode deliberately does not pre-open a getUserMedia stream.
        // Web Speech Recognition owns microphone access, matching the proven v1 path.
        return new MediaStream()
      }
      return nativeGetUserMedia(constraints)
    }
  }

  window.addEventListener('DOMContentLoaded',()=>{
    const mode=document.getElementById('pipelineMode')
    if(mode){
      mode.value='browser'
      mode.addEventListener('change',applyModeUi)
    }
    applyModeUi()
  },{once:true})
})()
