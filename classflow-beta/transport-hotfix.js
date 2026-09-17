(()=>{
  const nativeFetch=window.fetch.bind(window)
  window.fetch=(input,init={})=>{
    const url=typeof input==='string'?input:input?.url||''
    const headers=new Headers(init.headers||{})
    if(url==='https://api.openai.com/v1/realtime/calls'&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
      const form=new FormData()
      form.append('sdp',new Blob([init.body],{type:'application/sdp'}),'offer.sdp')
      headers.delete('Content-Type')
      return nativeFetch(input,{...init,headers,body:form})
    }
    return nativeFetch(input,init)
  }
})()
