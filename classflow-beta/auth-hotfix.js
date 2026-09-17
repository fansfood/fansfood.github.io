import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm'

const SUPABASE_URL='https://ozegqygkyoigvnfkbuyd.supabase.co'
const SUPABASE_KEY='sb_publishable_YTjdt2VvvyWIeRsTRgpe2g_Q2cO4Mwd'
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'classflow-auth-v1'}})

const form=document.getElementById('authForm')
const emailInput=document.getElementById('authEmail')
const passwordInput=document.getElementById('authPassword')
const message=document.getElementById('authMessage')

function setMessage(text,bad=false){
  if(!message)return
  message.textContent=text
  message.style.color=bad?'#b54b43':'#287a4b'
}

if(form && !document.getElementById('betaSignupButton')){
  const button=document.createElement('button')
  button.id='betaSignupButton'
  button.type='button'
  button.textContent='注册内测账号 / Sign up'
  button.style.cssText='width:100%;min-height:52px;border:1px solid #dce0d8;border-radius:13px;background:#eef1e8;color:#17211b;font-weight:850;margin-top:2px;'
  form.appendChild(button)

  const hint=document.createElement('div')
  hint.style.cssText='margin-top:10px;padding:11px 13px;border:1px solid #dce0d8;border-radius:13px;background:#f7f8f3;color:#6e776f;font-size:11px;line-height:1.55;'
  hint.innerHTML='<strong style="color:#17211b">没有账号？直接在这里注册。</strong><br>当前无需邮箱确认，注册成功后会自动进入 Beta。<br><span>New here? Sign up directly. Email confirmation is currently disabled.</span>'
  form.insertAdjacentElement('afterend',hint)

  button.addEventListener('click',async()=>{
    const email=(emailInput?.value||'').trim()
    const password=passwordInput?.value||''
    if(!email){setMessage('请先填写邮箱。 / Enter your email first.',true);return}
    if(password.length<6){setMessage('密码至少需要 6 位。 / Password must be at least 6 characters.',true);return}
    button.disabled=true
    button.textContent='正在注册… / Signing up…'
    setMessage('正在创建 ClassFlow 账号… / Creating your ClassFlow account…')
    try{
      const {data,error}=await supabase.auth.signUp({email,password})
      if(error)throw error
      if(data?.session){
        setMessage('注册成功，正在进入内测版… / Account created. Opening Beta…')
        setTimeout(()=>location.reload(),250)
        return
      }
      const login=await supabase.auth.signInWithPassword({email,password})
      if(login.error)throw login.error
      setMessage('注册成功，正在进入内测版… / Account created. Opening Beta…')
      setTimeout(()=>location.reload(),250)
    }catch(err){
      const raw=String(err?.message||'')
      let friendly=raw||'注册失败 / Sign-up failed'
      if(/already registered|user already registered/i.test(raw)) friendly='这个邮箱已经注册过，请直接登录。 / This email is already registered; please sign in.'
      else if(/rate limit/i.test(raw)) friendly='操作过于频繁，请稍后再试。 / Too many attempts; please try again shortly.'
      setMessage(friendly,true)
    }finally{
      button.disabled=false
      button.textContent='注册内测账号 / Sign up'
    }
  })
}

if(message){
  const observer=new MutationObserver(()=>{
    const raw=(message.textContent||'').trim()
    if(/invalid login credentials/i.test(raw)){
      message.textContent='邮箱或密码不正确；如果还没有账号，请点击“注册内测账号 / Sign up”。 / Incorrect email or password. If you do not have an account yet, tap Sign up.'
      message.style.color='#b54b43'
    }
  })
  observer.observe(message,{childList:true,characterData:true,subtree:true})
}
