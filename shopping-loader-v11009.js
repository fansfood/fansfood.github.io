async function loadShoppingEnhancements(){
  try{
    await import('./shopping-dates.js');
    await import('./shopping-ui-v10009.js');
    await import('./shopping-bulk-v11009.js');
  }catch(error){
    console.warn('食光采购增强模块加载失败',error);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',loadShoppingEnhancements,{once:true});
else loadShoppingEnhancements();
