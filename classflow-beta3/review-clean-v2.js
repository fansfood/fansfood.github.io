(() => {
  const source = document.getElementById('translationStream');
  const target = document.getElementById('reviewArea');
  if (!source || !target) return;

  const noiseWords = new Set(['嗯','哦','啊','呀','诶','唉','好','好的','行','对','对的','嗯嗯','哦哦','哈哈','呃','额','是的']);
  const isNoise = (text) => {
    const t = String(text || '').replace(/\s+/g, '').replace(/[。！？!?…，,、；;：:]/g, '');
    if (!t) return true;
    if (noiseWords.has(t)) return true;
    return t.length <= 1 && !/[A-Za-z0-9]/.test(t);
  };
  const cleanText = (text) => String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^翻译中…?\s*\/\s*Translating\s*$/i, '')
    .trim();
  const visibleTranslation = (card) => {
    const p = card.querySelector('p');
    if (!p) return '';
    const text = cleanText(p.textContent);
    if (!text || text.startsWith('⚠') || isNoise(text)) return '';
    return text;
  };
  const cjkLen = (s) => String(s || '').replace(/\s+/g, '').length;
  const strongEnd = (s) => /[。！？!?]$/.test(String(s || '').trim());
  const joinText = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    const left = a.trim(), right = b.trim();
    const needsSpace = /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right);
    return left + (needsSpace ? ' ' : '') + right;
  };

  function buildParagraphs(texts) {
    const paragraphs = [];
    let buffer = '';
    for (const text of texts) {
      buffer = joinText(buffer, text);
      const len = cjkLen(buffer);
      // 自然段目标约 85–125 字；超过 150 字强制换段。
      if ((len >= 85 && strongEnd(text)) || len >= 150) {
        paragraphs.push(buffer.trim());
        buffer = '';
      }
    }
    if (buffer.trim()) {
      if (paragraphs.length && cjkLen(buffer) < 28) {
        paragraphs[paragraphs.length - 1] = joinText(paragraphs[paragraphs.length - 1], buffer);
      } else {
        paragraphs.push(buffer.trim());
      }
    }
    return paragraphs;
  }

  function renderCleanReview() {
    const cards = [...source.querySelectorAll('.speech-card.translated')];
    const texts = cards.map(visibleTranslation).filter(Boolean);
    if (!texts.length) {
      target.innerHTML = '<div class="empty">这里会以自然段连续显示整堂课的中文译文。</div>';
      return;
    }
    const paragraphs = buildParagraphs(texts);
    target.innerHTML = '<div class="clean-full-translation">' + paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('') + '</div>';
    target.scrollTop = target.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  const style = document.createElement('style');
  style.textContent = `
    #reviewArea .clean-full-translation{padding:6px 4px 24px;max-width:100%;}
    #reviewArea .clean-full-translation p{margin:0 0 1.15em;font-size:14px;line-height:1.9;color:var(--ink,#17211b);text-align:left;word-break:break-word;}
    #reviewArea .clean-full-translation p:last-child{margin-bottom:0;}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(() => queueMicrotask(renderCleanReview));
  observer.observe(source, { childList: true, subtree: true, characterData: true });
  window.addEventListener('load', renderCleanReview);
  setTimeout(renderCleanReview, 600);
})();
