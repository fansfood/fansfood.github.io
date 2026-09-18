import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'classflow-auth-v1'}})
const $=id=>document.getElementById(id)
const esc=(s='')=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
const normalizeCourse=s=>String(s||'').replace(/\s+/g,' ').trim()
const courseKey=s=>normalizeCourse(s).toLocaleLowerCase()

let baseNewSession=null
let observer=null
let building=false
let scheduled=false
let userId='guest'
let courseCounts=new Map()
let courseNames=new Map()
let expanded=new Set()

function draftKey(){return`classflow-beta4-draft-courses-${userId}`}
function expandedKey(){return`classflow-beta4-expanded-${userId}`}
function loadDrafts(){try{return JSON.parse(localStorage.getItem(draftKey())||'[]').filter(Boolean)}catch{return[]}}
function saveDrafts(v){localStorage.setItem(draftKey(),JSON.stringify([...new Set(v.map(normalizeCourse).filter(Boolean))]))}
function loadExpanded(){try{return new Set(JSON.parse(localStorage.getItem(expandedKey())||'[]'))}catch{return new Set()}}
function saveExpanded(){localStorage.setItem(expandedKey(),JSON.stringify([...expanded]))}

function patchStableLabels(){
  document.title='ClassFlow 4.0 · v4 · 实时课堂翻译'
  const status=$('status')
  if(status&&/BETA 3|Beta 3|BETA 4|Beta 4/i.test(status.textContent))status.textContent='ClassFlow 4.0 · v4 · Course → Lesson / 课程分层'
  const btn=$('newSession');if(btn)btn.textContent='＋ 新增课次 / Add Lesson'
}

function setLessonContext(course,lessonNo,label=''){
  const el=$('lessonContext');if(!el)return
  if(!course){el.textContent='当前课次 / Current lesson: —';return}
  el.textContent=`${course} · 第 ${lessonNo} 节 / Lesson ${lessonNo}${label?` · ${label}`:''}`
}

function currentCourseName(){
  const raw=normalizeCourse($('classTitle')?.value)
  if(!raw||/^(新课堂\s*\/\s*New Class|新课程\s*\/\s*New Course|未命名课程\s*\/\s*Untitled Course)$/i.test(raw))return''
  return raw
}

function rememberDraft(course){
  const name=normalizeCourse(course);if(!name)return
  const drafts=loadDrafts();if(!drafts.some(x=>courseKey(x)===courseKey(name))){drafts.push(name);saveDrafts(drafts)}
}
function forgetDraft(course){const key=courseKey(course);saveDrafts(loadDrafts().filter(x=>courseKey(x)!==key))}

async function resetForCourse(course,lessonNo){
  const name=normalizeCourse(course);if(!name)return
  rememberDraft(name)
  if(typeof baseNewSession==='function')await Promise.resolve(baseNewSession())
  const input=$('classTitle')
  if(input){input.value=name;input.dispatchEvent(new Event('input',{bubbles:true}))}
  setLessonContext(name,lessonNo||((courseCounts.get(courseKey(name))||0)+1),'待开始 / Draft')
  const status=$('status');if(status)status.textContent=`已准备 ${name} 的新课次 / New lesson ready`
  if($('historyDrawer')?.classList.contains('open'))$('closeHistory')?.click()
}

function installMainAddLesson(){
  const btn=$('newSession');if(!btn||btn.dataset.beta4Wrapped==='1')return
  if(typeof btn.onclick!=='function')return
  baseNewSession=btn.onclick
  btn.dataset.beta4Wrapped='1'
  btn.onclick=async()=>{
    let course=currentCourseName()
    if(!course){course=normalizeCourse(window.prompt('请输入课程名称 / Course name','')||'')}
    if(!course)return
    const next=(courseCounts.get(courseKey(course))||0)+1
    await resetForCourse(course,next)
  }
}

function directHistoryButtons(){
  const list=$('historyList');if(!list)return[]
  return [...list.children].filter(el=>el.matches?.('button.history-item'))
}
function scheduleBuild(){
  if(scheduled||building)return;scheduled=true
  queueMicrotask(()=>{scheduled=false;buildHierarchy()})
}

function parseFlatButton(button,index){
  const title=normalizeCourse(button.querySelector('strong')?.textContent||'未命名课程 / Untitled Course')
  const meta=normalizeCourse(button.querySelector('span')?.textContent||'')
  return{button,id:button.dataset.id||'',title,meta,index}
}

function buildHierarchy(){
  const list=$('historyList'),toolbar=$('courseToolbar');if(!list||building)return
  const buttons=directHistoryButtons()
  const baseEmpty=[...list.children].some(el=>el.classList?.contains('empty'))
  if(!buttons.length&&!baseEmpty)return
  building=true
  try{
    const flat=buttons.map(parseFlatButton)
    const groups=[];const map=new Map()
    for(const item of flat){
      const key=courseKey(item.title)
      if(!map.has(key)){const g={key,name:item.title,items:[],firstIndex:item.index,draft:false};map.set(key,g);groups.push(g)}
      map.get(key).items.push(item)
    }
    for(const draft of loadDrafts()){
      const key=courseKey(draft)
      if(!map.has(key)){const g={key,name:draft,items:[],firstIndex:9999,draft:true};map.set(key,g);groups.push(g)}
      else map.get(key).draft=true
    }
    groups.sort((a,b)=>a.firstIndex-b.firstIndex||a.name.localeCompare(b.name))
    courseCounts=new Map(groups.map(g=>[g.key,g.items.length]));courseNames=new Map(groups.map(g=>[g.key,g.name]))
    if(!expanded.size&&groups[0])expanded.add(groups[0].key)

    list.innerHTML=''
    if(!groups.length){list.innerHTML='<div class="empty">还没有课程。点击“新建课程”开始 / No courses yet.</div>';if(toolbar)toolbar.hidden=false;return}

    for(const group of groups){
      const block=document.createElement('section');block.className=`course-block${expanded.has(group.key)?'':' collapsed'}`;block.dataset.courseKey=group.key;block.dataset.courseName=group.name
      const head=document.createElement('div');head.className='course-head'
      const courseCheck=document.createElement('input');courseCheck.type='checkbox';courseCheck.className='course-select';courseCheck.setAttribute('aria-label',`选择课程 ${group.name}`)
      const toggle=document.createElement('button');toggle.type='button';toggle.className='course-toggle';toggle.textContent='⌄';toggle.title='展开/收起 / Expand or collapse'
      const title=document.createElement('div');title.className='course-title-wrap';title.innerHTML=`<strong>${esc(group.name)}${group.draft&&!group.items.length?'<span class="course-draft-badge">Draft</span>':''}</strong><span>${group.items.length} 节课 / ${group.items.length} lessons</span>`
      const add=document.createElement('button');add.type='button';add.className='course-add';add.textContent='＋';add.title='新增课次 / Add lesson'
      head.append(courseCheck,toggle,title,add);block.appendChild(head)
      const lessonList=document.createElement('div');lessonList.className='lesson-list'
      const chronological=[...group.items].reverse()
      chronological.forEach((item,i)=>{
        const no=i+1,row=document.createElement('div');row.className='lesson-row';row.dataset.sessionId=item.id
        const check=document.createElement('input');check.type='checkbox';check.className='lesson-select';check.dataset.sessionId=item.id;check.dataset.courseKey=group.key;check.setAttribute('aria-label',`选择第 ${no} 节课`)
        const btn=item.button;btn.classList.add('lesson-open-button');btn.innerHTML=`<strong>第 ${no} 节课 / Lesson ${no}</strong><span>${esc(item.meta)}</span>`
        btn.addEventListener('click',()=>setLessonContext(group.name,no,'已载入 / Loaded'),{capture:true})
        const del=document.createElement('button');del.type='button';del.className='lesson-delete';del.textContent='−';del.title='删除这节课 / Delete lesson';del.dataset.sessionId=item.id
        row.append(check,btn,del);lessonList.appendChild(row)
        check.addEventListener('change',()=>{syncCourseCheckbox(block);updateSelectionState()})
        del.addEventListener('click',async e=>{e.stopPropagation();if(!confirm(`删除 ${group.name} 的第 ${no} 节课？\nDelete Lesson ${no}?`))return;await deleteSessions([item.id],[group.key]);refreshHistory()})
      })
      if(!group.items.length){const empty=document.createElement('div');empty.className='empty-course';empty.textContent='还没有课次 / No lessons yet';lessonList.appendChild(empty)}
      block.appendChild(lessonList);list.appendChild(block)

      toggle.onclick=title.onclick=()=>{block.classList.toggle('collapsed');if(block.classList.contains('collapsed'))expanded.delete(group.key);else expanded.add(group.key);saveExpanded()}
      add.onclick=()=>resetForCourse(group.name,group.items.length+1)
      courseCheck.onchange=()=>{block.classList.toggle('selected',courseCheck.checked);block.querySelectorAll('.lesson-select').forEach(c=>c.checked=courseCheck.checked);updateSelectionState()}
    }
    if(toolbar)toolbar.hidden=false
    updateSelectionState()
  }finally{building=false}
}

function syncCourseCheckbox(block){
  const c=block.querySelector('.course-select'),lessons=[...block.querySelectorAll('.lesson-select')]
  if(!c)return
  const checked=lessons.filter(x=>x.checked).length
  c.checked=lessons.length?checked===lessons.length:c.checked
  c.indeterminate=checked>0&&checked<lessons.length
  block.classList.toggle('selected',c.checked||c.indeterminate)
}

function selection(){
  const ids=[...document.querySelectorAll('#historyList .lesson-select:checked')].map(x=>x.dataset.sessionId).filter(Boolean)
  const emptyCourses=[...document.querySelectorAll('#historyList .course-block')].filter(b=>b.querySelector('.course-select')?.checked&&!b.querySelector('.lesson-select')).map(b=>b.dataset.courseKey)
  const fullCourses=[...document.querySelectorAll('#historyList .course-block')].filter(b=>{
    const all=[...b.querySelectorAll('.lesson-select')];return b.querySelector('.course-select')?.checked&&(all.length===0||all.every(x=>x.checked))
  }).map(b=>b.dataset.courseKey)
  return{ids,emptyCourses,fullCourses:[...new Set(fullCourses)]}
}

function updateSelectionState(){
  const {ids,emptyCourses}=selection(),btn=$('deleteSelectedCourses'),selectAll=$('selectAllCourses')
  const count=ids.length+emptyCourses.length
  if(btn){btn.disabled=!count;btn.textContent=count?`删除所选 (${count}) / Delete selected`:'删除所选 / Delete selected'}
  if(selectAll){const checks=[...document.querySelectorAll('#historyList .course-select')],all=checks.length&&checks.every(x=>x.checked);selectAll.textContent=all?'☑ 取消全选 / Clear':'☐ 全选 / Select all'}
}

async function deleteSessions(ids,courseKeys=[]){
  const unique=[...new Set(ids.filter(Boolean))]
  const current=currentCourseName(),deletedCourses=new Set(courseKeys)
  try{
    if(unique.length){
      const {data:recs}=await supabase.from('classflow_recordings').select('storage_path').in('session_id',unique)
      const paths=(recs||[]).map(r=>r.storage_path).filter(Boolean)
      if(paths.length)await supabase.storage.from('classflow-recordings').remove(paths).catch(()=>{})
      for(const table of ['classflow_latency_samples','classflow_segments','classflow_recordings']){
        const {error}=await supabase.from(table).delete().in('session_id',unique)
        if(error)console.warn(`Beta4 cleanup ${table}:`,error.message)
      }
      const {error}=await supabase.from('classflow_sessions').delete().in('id',unique)
      if(error)throw error
    }
    for(const key of deletedCourses){const name=courseNames.get(key);if(name)forgetDraft(name)}
    if(typeof baseNewSession==='function')await Promise.resolve(baseNewSession())
    const keepCurrent=current&&!deletedCourses.has(courseKey(current))
    const input=$('classTitle');if(input){input.value=keepCurrent?current:'未命名课程 / Untitled Course';input.dispatchEvent(new Event('input',{bubbles:true}))}
    setLessonContext('',0)
    const status=$('status');if(status)status.textContent='删除完成 / Deleted'
  }catch(err){alert(`删除失败 / Delete failed:\n${err?.message||err}`);throw err}
}

async function deleteSelected(){
  const s=selection(),count=s.ids.length+s.emptyCourses.length
  if(!count)return
  if(!confirm(`确定删除所选 ${count} 项？删除后无法恢复。\nDelete ${count} selected item(s)?`))return
  for(const key of s.emptyCourses){const name=courseNames.get(key);if(name)forgetDraft(name)}
  await deleteSessions(s.ids,s.fullCourses)
  refreshHistory()
}

function selectAllToggle(){
  const checks=[...document.querySelectorAll('#historyList .course-select')]
  const shouldCheck=!checks.length?false:!checks.every(x=>x.checked)
  checks.forEach(c=>{c.checked=shouldCheck;c.indeterminate=false;const block=c.closest('.course-block');block?.classList.toggle('selected',shouldCheck);block?.querySelectorAll('.lesson-select').forEach(l=>l.checked=shouldCheck)})
  updateSelectionState()
}

function newCourse(){
  const name=normalizeCourse(prompt('新课程名称 / New course name','')||'');if(!name)return
  rememberDraft(name);expanded.add(courseKey(name));saveExpanded();refreshHistory()
}

function refreshHistory(){
  const btn=$('historyButton');if(btn)btn.click();else scheduleBuild()
}

function installToolbar(){
  $('selectAllCourses')?.addEventListener('click',selectAllToggle)
  $('deleteSelectedCourses')?.addEventListener('click',deleteSelected)
  $('newCourseButton')?.addEventListener('click',newCourse)
}

function installObserver(){
  const list=$('historyList');if(!list||observer)return
  observer=new MutationObserver(()=>{if(building)return;const direct=directHistoryButtons();const hasBaseEmpty=[...list.children].some(el=>el.classList?.contains('empty'));if(direct.length||hasBaseEmpty)scheduleBuild()})
  observer.observe(list,{childList:true})
  if(directHistoryButtons().length)scheduleBuild()
}

async function boot(){
  const {data:{session}}=await supabase.auth.getSession().catch(()=>({data:{session:null}}));userId=session?.user?.id||'guest';expanded=loadExpanded()
  installToolbar();patchStableLabels()
  let tries=0
  const timer=setInterval(()=>{
    tries++;installMainAddLesson();installObserver();patchStableLabels()
    if(baseNewSession||tries>40)clearInterval(timer)
  },150)
  supabase.auth.onAuthStateChange((_e,s)=>{const next=s?.user?.id||'guest';if(next!==userId){userId=next;expanded=loadExpanded();setTimeout(refreshHistory,200)}})
}

boot()
