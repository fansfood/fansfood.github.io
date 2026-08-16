const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const RECIPE_META = {
  '番茄牛肉意面': {
    intro: '番茄慢慢炒出浓郁汤汁，包裹牛肉和意面，是一份酸甜开胃、饱腹感很好的家常主食。',
    taste: ['酸甜开胃', '牛肉咸鲜', '番茄浓郁'],
    pairing: '适合搭配清爽生菜沙拉、烤蔬菜或无糖气泡水。'
  },
  '香煎鸡胸配西兰花': {
    intro: '高蛋白又清爽的一餐，鸡胸外层微焦、里面保持嫩度，西兰花负责增加脆嫩口感。',
    taste: ['黑椒咸香', '清爽', '低负担'],
    pairing: '想更饱腹可以配米饭、土豆或玉米；喜欢酸味可以挤一点柠檬汁。'
  },
  '鸡蛋蔬菜早餐卷': {
    intro: '把鸡蛋和新鲜蔬菜卷进全麦饼里，制作快、方便拿着吃，适合作为轻松的早餐或早午餐。',
    taste: ['蛋香', '清新爽口', '轻食'],
    pairing: '适合搭配牛奶、豆浆、咖啡或一份水果。'
  },
  '奶油蘑菇浓汤': {
    intro: '蘑菇的鲜味和奶香融合成顺滑浓汤，天气凉的时候尤其舒服，也很适合作为一顿饭的汤品。',
    taste: ['奶香浓郁', '菌菇鲜香', '顺滑'],
    pairing: '适合搭配烤面包、蒜香法棍或一份简单沙拉。'
  },
  '三文鱼牛油果饭': {
    intro: '三文鱼的鲜香、牛油果的绵密和米饭组合在一起，口感丰富，也兼顾蛋白质和饱腹感。',
    taste: ['鲜香', '醇厚绵密', '清爽'],
    pairing: '可以搭配海苔、温泉蛋、黄瓜，也可以按喜好加少量酱油或柠檬汁。'
  },
  '酸奶水果燕麦杯': {
    intro: '酸奶、燕麦和水果层层叠放，不需要复杂烹饪，清爽又方便，是很适合早晨的一杯。',
    taste: ['酸甜', '果香', '清爽'],
    pairing: '可以加入坚果、奇亚籽、蜂蜜或不同季节水果调整口感。'
  }
};

const CATEGORY_META = {
  '早餐': { taste: ['清爽', '轻盈', '适合早晨'], pairing: '可以按个人习惯搭配牛奶、咖啡或水果。' },
  '主食': { taste: ['咸香', '饱腹', '家常'], pairing: '可以搭配一份蔬菜或清淡汤品，让一餐更完整。' },
  '高蛋白': { taste: ['咸鲜', '高蛋白', '清爽'], pairing: '可以搭配主食和蔬菜，根据运动量调整份量。' },
  '汤': { taste: ['鲜香', '温润', '顺口'], pairing: '适合搭配面包、主食或清爽小菜。' },
  '甜品': { taste: ['香甜', '柔和', '满足感'], pairing: '适合作为饭后甜点，甜度可以按个人喜好调整。' },
  '其他': { taste: ['家常', '可调整', '按喜好调味'], pairing: '可以根据自己的饮食习惯自由搭配。' }
};

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._homeTimer);
  el._homeTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function activateCard(card, handler) {
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.addEventListener('click', handler);
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler(event);
    }
  });
}

function findRecipeButtonByName(name) {
  const cards = $$('#recipeGrid .recipe-card');
  const card = cards.find(item => $('h3', item)?.textContent.trim() === name);
  return card?.querySelector('[data-open]') || null;
}

function openRecipeByName(name) {
  let button = findRecipeButtonByName(name);
  if (button) {
    button.click();
    return true;
  }

  const search = $('#recipeSearch');
  const filters = $('#recipeFilters');
  if (!search || !filters) return false;

  const oldSearch = search.value;
  const oldCategory = filters.dataset.current || '全部';
  const allButton = $$('button[data-cat]', filters).find(b => b.dataset.cat === '全部');
  if (allButton && oldCategory !== '全部') allButton.click();

  search.value = name;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  button = findRecipeButtonByName(name);
  if (button) button.click();

  search.value = oldSearch;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  if (oldCategory !== '全部') {
    const restoreButton = $$('button[data-cat]', filters).find(b => b.dataset.cat === oldCategory);
    restoreButton?.click();
  }
  return Boolean(button);
}

function enhanceTodayCards() {
  const grid = $('#todayMeals');
  if (!grid) return;

  $$('.meal-card', grid).forEach(card => {
    if (card.dataset.homeEnhanced === '1') return;
    card.dataset.homeEnhanced = '1';
    card.classList.add('home-entry-card');

    const title = $('h3', card)?.textContent.trim() || '';
    const content = $('.content', card);
    if (content && !$('.home-card-action', content)) {
      const action = document.createElement('div');
      action.className = 'home-card-action';
      action.innerHTML = title === '还没安排'
        ? '<span>去安排这一餐</span><b>→</b>'
        : '<span>查看简介与做法</span><b>→</b>';
      content.appendChild(action);
    }

    activateCard(card, () => {
      if (!title || title === '还没安排') {
        location.hash = '#menu';
        return;
      }
      if (!openRecipeByName(title)) {
        location.hash = '#recipes';
        toast('已为你打开食谱库');
      }
    });
  });
}

function enhanceDashboardCards() {
  const entries = [
    { countId: 'shoppingCount', target: '#shopping', label: '进入采购清单' },
    { countId: 'pantryCount', target: '#pantry', label: '打开我的冰箱' },
    { countId: 'favoriteCount', target: '#recipes', label: '查看收藏食谱' }
  ];

  entries.forEach(entry => {
    const count = document.getElementById(entry.countId);
    const card = count?.closest('.stat-card');
    if (!card || card.dataset.homeEnhanced === '1') return;
    card.dataset.homeEnhanced = '1';
    card.classList.add('home-entry-card', 'home-stat-entry');

    const info = card.querySelector('div');
    if (info && !info.querySelector('.home-stat-action')) {
      const action = document.createElement('span');
      action.className = 'home-stat-action';
      action.textContent = `${entry.label} →`;
      info.appendChild(action);
    }

    activateCard(card, () => {
      if (entry.countId === 'favoriteCount') {
        const search = $('#recipeSearch');
        if (search) {
          search.value = '';
          search.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const allButton = $$('#recipeFilters button[data-cat]').find(b => b.dataset.cat === '全部');
        allButton?.click();
      }
      location.hash = entry.target;
    });
  });
}

function getDialogMeta(title, category) {
  if (RECIPE_META[title]) return RECIPE_META[title];
  const fallback = CATEGORY_META[category] || CATEGORY_META['其他'];
  return {
    intro: `这是一道“${title}”的自定义食谱。你可以按照当前食材和步骤制作，并根据自己的口味调整调味与份量。`,
    taste: fallback.taste,
    pairing: fallback.pairing
  };
}

function enhanceRecipeDialog() {
  const content = $('#recipeDialogContent');
  if (!content || content.querySelector('.recipe-overview')) return;

  const body = $('.dialog-body', content);
  const title = $('.dialog-title-overlay h2', content)?.textContent.trim();
  const category = $('.dialog-title-overlay .eyebrow', content)?.textContent.trim() || '其他';
  if (!body || !title) return;

  const meta = getDialogMeta(title, category);
  const section = document.createElement('section');
  section.className = 'recipe-overview';
  section.innerHTML = `
    <div class="recipe-overview-heading">
      <span class="eyebrow">DISH PROFILE</span>
      <h3>这道菜怎么样？</h3>
    </div>
    <p class="recipe-intro">${meta.intro}</p>
    <div class="recipe-detail-grid">
      <div class="recipe-detail-box">
        <span>口味</span>
        <div class="taste-tags">${meta.taste.map(t => `<b>${t}</b>`).join('')}</div>
      </div>
      <div class="recipe-detail-box">
        <span>推荐搭配</span>
        <p>${meta.pairing}</p>
      </div>
    </div>`;
  body.prepend(section);
}

function refreshHomeEnhancements() {
  enhanceTodayCards();
  enhanceDashboardCards();
  enhanceRecipeDialog();
}

const todayGrid = $('#todayMeals');
if (todayGrid) {
  new MutationObserver(() => enhanceTodayCards())
    .observe(todayGrid, { childList: true, subtree: true });
}

const dialogContent = $('#recipeDialogContent');
if (dialogContent) {
  new MutationObserver(() => enhanceRecipeDialog())
    .observe(dialogContent, { childList: true, subtree: true });
}

window.addEventListener('hashchange', () => setTimeout(refreshHomeEnhancements, 0));
window.addEventListener('focus', refreshHomeEnhancements);
setTimeout(refreshHomeEnhancements, 0);
