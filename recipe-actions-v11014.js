const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const supabase=()=>window.Shiguang?.supabase||null;
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._raT);el._raT=setTimeout(()=>el.classList.remove('show'),2100);}
function readState(){try{return JSON.parse(localStorage.getItem('shiguang-v2-state')||'{}')||{}}catch{return{}}}
function saveState(state){localStorage.setItem('shiguang-v2-state',JSON.stringify(state));}
function bindActions(){const add=$('#wdAddRecipeShopping'),tomorrow=$('#wdEatTomorrow');if(add)add.onclick=addToShopping;if(tomorrow)tomorrow.onclick=addToTomorrow;}
function ensureActions(){
  const body=$('#recipeDialogContent .dialog-body');if(!body)return;
  let box=$('.wd-recipe-actions',body);
  if(!box){box=document.createElement('div');box.className='wd-recipe-actions';box.innerHTML='<button class="btn ghost" id="wdAddRecipeShopping" type="button">加入采购清单</button><button class="btn primary" id="wdEatTomorrow" type="button">明天就吃它</button>';body.appendChild(box);}
  bindActions();
}
async function addToShopping(){
  const rows=$$('#recipeDialogContent .ingredient');
  const stamp=Date.now();
  const items=rows.map((el,i)=>({id:`manual:recipe:${stamp}:${i}`,name:$('b',el)?.textContent.trim()||'',qtyText:$('.meal-meta',el)?.textContent.trim()||'1份',category:'其他'})).filter(x=>x.name);
  if(!items.length){toast('这道菜暂时没有可加入的食材');return;}
  const state=readState();state.manualShopping=[...(state.manualShopping||[]),...items];saveState(state);
  const sb=supabase();const user=window.Shiguang?.user;
  if(sb&&user){const {error}=await sb.from('app_state').update({manual_shopping:state.manualShopping,updated_at:new Date().toISOString()}).eq('user_id',user.id);if(error)console.warn('同步采购清单失败',error);}
  toast(`已加入 ${items.length} 项采购食材`);$('#recipeDialog')?.close();location.hash='#shopping';
}
async function addToTomorrow(){
  const sb=supabase();let user=window.Shiguang?.user;
  if(!sb){location.hash='#tomorrow';return;}
  if(!user){const {data}=await sb.auth.getSession();user=data.session?.user||null;}
  if(!user){toast('请先登录');$('#accountBtn')?.click();return;}
  const groupId=localStorage.getItem('fansfood-active-group');if(!groupId){toast('请先选择一个小饭桌');location.hash='#groups';return;}
  const {data:member,error:memberError}=await sb.from('group_members').select('member_role').eq('group_id',groupId).eq('user_id',user.id).maybeSingle();
  if(memberError||member?.member_role!=='chef'){toast('只有本群大厨可以添加明日候选菜');location.hash='#tomorrow';return;}
  const name=$('#recipeDialogContent .dialog-title-overlay h2')?.textContent.trim()||'食光菜谱';
  const category=$('#recipeDialogContent .dialog-title-overlay .eyebrow')?.textContent.trim()||'其他';
  const description=$('#recipeDialogContent .recipe-intro')?.textContent.trim()||'从食光菜谱加入的明日候选。';
  const src=$('#recipeDialogContent .dialog-hero img')?.src||'';
  let imagePath=null,imageUrl=null;
  try{
    if(src&&src.startsWith(location.origin)) imageUrl=src;
    else if(src){const response=await fetch(src);if(response.ok){const blob=await response.blob();const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');imagePath=`${user.id}/${groupId}-${crypto.randomUUID()}.${ext}`;const up=await sb.storage.from('dish-images').upload(imagePath,blob,{contentType:blob.type||'image/jpeg',upsert:false});if(up.error)imagePath=null;}}
    const {error}=await sb.from('site_dishes').insert({name,description,category,image_path:imagePath,image_url:imageUrl,is_active:true,created_by:user.id,group_id:groupId});if(error)throw error;
    toast('已加入当前小饭桌的明日候选');$('#recipeDialog')?.close();location.hash='#tomorrow';
  }catch(error){toast(error?.message||'加入候选失败');}
}
function init(){const root=$('#recipeDialogContent');if(!root)return;new MutationObserver(()=>queueMicrotask(ensureActions)).observe(root,{childList:true,subtree:true});ensureActions();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
