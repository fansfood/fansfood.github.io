(() => {
  const flagNames = new Set(['重点','考试','没听懂','例子']);
  let scheduled = false;

  function applyFlagColors(){
    document.querySelectorAll('.meta b, .review-meta b').forEach((badge) => {
      const name = badge.textContent.trim();
      if(flagNames.has(name)) badge.dataset.flag = name;
    });
  }

  function moveNotesBelowButton(){
    const review = document.getElementById('reviewArea');
    const output = document.getElementById('notesOutput');
    if(!review || !output) return;
    const note = review.querySelector('.generated-notes');
    if(note){
      output.hidden = false;
      output.replaceChildren(note);
    } else if(!output.querySelector('.generated-notes')) {
      output.hidden = true;
    }
  }

  function sync(){
    scheduled = false;
    applyFlagColors();
    moveNotesBelowButton();
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();

  new MutationObserver(schedule).observe(document.documentElement, {subtree:true, childList:true, characterData:true});
})();
