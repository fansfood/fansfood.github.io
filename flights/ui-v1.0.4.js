(() => {
  const VISIBLE_VERSION_FROM = 'v1.0.3';
  const VISIBLE_VERSION_TO = 'v1.0.4';
  const AIR_CHINA_FULL_LOGO = 'https://cdn.worldvectorlogo.com/logos/air-china-logo.svg';
  const AIR_CHINA_FALLBACK = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Air_China_wordmark.svg/500px-Air_China_wordmark.svg.png';

  function upgradeAirChinaLogo(root = document) {
    root.querySelectorAll?.('.logo-wrap.air-china-logo img').forEach((img) => {
      if (img.dataset.fullLogoApplied === '1') return;
      img.dataset.fullLogoApplied = '1';
      img.alt = '中国国际航空完整 Logo（凤凰标志）';
      img.classList.add('air-china-full-logo-img');
      img.src = AIR_CHINA_FULL_LOGO;
      img.addEventListener('error', () => {
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = AIR_CHINA_FALLBACK;
      }, { once: true });
    });
  }

  function setBaggageState(box, open) {
    const title = box.querySelector('.baggage-title');
    const label = title?.querySelector('strong');
    box.classList.toggle('is-open', open);
    title?.setAttribute('aria-expanded', String(open));
    if (label) label.textContent = open ? '行李额度 · 点击收起' : '行李额度 · 点击展开';
  }

  function upgradeBaggage(root = document) {
    root.querySelectorAll?.('.baggage-box').forEach((box) => {
      if (box.dataset.collapsible === '1') return;
      box.dataset.collapsible = '1';
      box.classList.add('baggage-collapsible');

      const title = box.querySelector('.baggage-title');
      if (!title) return;
      title.classList.add('baggage-toggle');
      title.setAttribute('role', 'button');
      title.setAttribute('tabindex', '0');

      const chevron = document.createElement('span');
      chevron.className = 'baggage-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '⌄';
      title.appendChild(chevron);

      setBaggageState(box, false);

      const toggle = () => setBaggageState(box, !box.classList.contains('is-open'));
      title.addEventListener('click', toggle);
      title.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });
    });
  }

  function updateVisibleVersion(root = document) {
    if (!root) return;
    const nodes = [];
    if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
    else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
    }
    nodes.forEach((node) => {
      if (node.nodeValue?.includes(VISIBLE_VERSION_FROM)) {
        node.nodeValue = node.nodeValue.replaceAll(VISIBLE_VERSION_FROM, VISIBLE_VERSION_TO);
      }
    });
  }

  function enhance(root = document) {
    upgradeAirChinaLogo(root);
    upgradeBaggage(root);
    updateVisibleVersion(root);
  }

  function start() {
    enhance(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) enhance(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
