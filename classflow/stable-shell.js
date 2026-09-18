(()=>{
  const normalize=()=>{
    document.title='ClassFlow 4.0 · v3.1 · 实时课堂翻译';
    const status=document.getElementById('status');
    if(status&&/BETA 4\.0|Beta 4|BETA 3\.0|Beta 3/i.test(status.textContent)){
      status.textContent='ClassFlow 4.0 · v3.1 · Course → Lesson / 课程分层';
    }
    document.querySelectorAll('.beta-badge').forEach(el=>{if(el.textContent!=='4.0 · v3.1')el.textContent='4.0 · v3.1'});
    document.querySelectorAll('.account-popover span').forEach(el=>{if(/Beta|BETA/i.test(el.textContent))el.textContent='ClassFlow 4.0 · v3.1'});
  };
  normalize();
  let n=0;
  const timer=setInterval(()=>{normalize();if(++n>=30)clearInterval(timer)},200);
  window.addEventListener('load',normalize,{once:true});
})();
