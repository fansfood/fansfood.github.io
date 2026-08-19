const { test, expect } = require('@playwright/test');
const routes=['home','today','groups','buddies','tomorrow','menu','recipes','shopping','ingredients','pantry','stats','settings'];
function captureErrors(page){const errors=[];page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|ERR_BLOCKED_BY_CLIENT/i.test(t))errors.push(`console: ${t}`)}});return errors}
async function load(page,path='#home'){await page.goto('/'+path,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800)}

test('desktop shell, today dashboard and every route remain usable',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  const errors=captureErrors(page);await load(page,'#home');
  await expect(page.locator('.et-sidebar')).toBeVisible();
  await expect(page.locator('#etHomeDashboard .et-today-card')).toBeVisible();
  await expect(page.locator('#etHomeDashboard')).toContainText('今日计划');
  await expect(page.locator('#etHomeDashboard .et-meal-grid .et-meal')).toHaveCount(3);
  await expect(page.locator('#etHomeDashboard .et-missing')).toBeVisible();
  await expect(page.locator('#etHomeDashboard')).toContainText('明天吃什么');
  await expect(page.locator('#etHomeDashboard')).toContainText('近七天菜谱');
  await expect(page.locator('#etHomeDashboard')).toContainText('采购提醒');
  await expect(page.locator('#etHomeDashboard')).toContainText('我的冰箱');

  for(const id of routes){
    const link=page.locator(`[data-et-route="${id}"]`);
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(page.locator(`#${id}.page.active`)).toBeVisible();
    if(id==='today'){
      await expect(page.locator('#etTodayContent .et-today-meal-card')).toHaveCount(3);
      await expect(page.locator('#etTodayContent')).toContainText('今日采购');
      await expect(page.locator('#etTodayContent')).toContainText('已经拥有');
    }
    if(id==='buddies'){
      await page.waitForTimeout(800);
      await expect(page.locator('#buddyContent')).not.toBeEmpty();
    }
  }
  expect(errors).toEqual([]);
  await page.goto('/#home');await page.waitForTimeout(400);
  await page.screenshot({path:'test-results/desktop-home.png',fullPage:true});
});

test('mobile bottom navigation, today hierarchy and action sheet',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=captureErrors(page);await load(page,'#home');
  await expect(page.locator('.et-mobile-bottom')).toBeVisible();
  await expect(page.locator('#etHomeDashboard .et-today-card')).toBeVisible();
  await expect(page.locator('#etHomeDashboard .et-meal-grid .et-meal')).toHaveCount(3);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator('#etMobilePlus').click();
  await expect(page.locator('#etActionSheet')).toHaveClass(/open/);
  await expect(page.locator('#etActionSheet')).toContainText('添加今日计划');
  await expect(page.locator('#etActionSheet')).toContainText('添加采购');
  await expect(page.locator('#etActionSheet')).toContainText('添加冰箱食材');
  await page.locator('[data-sheet-go="#shopping"]').click();
  await expect(page).toHaveURL(/#shopping$/);
  expect(errors).toEqual([]);
  await page.goto('/#home');await page.waitForTimeout(500);
  await page.screenshot({path:'test-results/mobile-home-390.png',fullPage:true});
});

for(const width of [375,390,430,768,1024,1280,1440,1920]){
  test(`no horizontal overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await load(page,'#home');
    const info=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
    expect(info.scroll-info.inner).toBeLessThanOrEqual(1);
  });
}
