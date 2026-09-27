/* Accessible gallery viewer shared by series and episode pages. */
(function () {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.className = 'gallery-dialog';
  dialog.setAttribute('aria-label', 'نمایش عکس‌ها');
  dialog.innerHTML = `<div class="gallery-viewer">
    <div class="gallery-toolbar"><span id="gallery-title"></span><button type="button" id="gallery-close" aria-label="بستن گالری">×</button></div>
    <div class="gallery-stage"><img id="gallery-large" alt=""><div class="gallery-controls">
      <button type="button" id="gallery-prev" aria-label="عکس قبلی">→</button>
      <button type="button" id="gallery-next" aria-label="عکس بعدی">←</button>
    </div></div>
    <div class="gallery-caption"><span id="gallery-position"></span><a id="gallery-original" target="_blank" rel="noopener noreferrer">نمایش عکس اصلی ↗</a></div>
  </div>`;
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector(id);
  const image = $('#gallery-large');
  let items = [];
  let index = 0;
  let trigger = null;
  function show(i) {
    index = (i + items.length) % items.length;
    const item = items[index];
    image.src = item.href;
    image.alt = item.querySelector('img')?.alt || item.getAttribute('aria-label') || '';
    $('#gallery-title').textContent = item.getAttribute('aria-label') || 'گالری عکس';
    $('#gallery-position').textContent = `${new Intl.NumberFormat('fa-IR').format(index + 1)} از ${new Intl.NumberFormat('fa-IR').format(items.length)}`;
    $('#gallery-original').href = item.href;
    $('#gallery-prev').disabled = $('#gallery-next').disabled = items.length < 2;
  }
  document.addEventListener('click', (event) => {
    const shot = event.target.closest('.gallery a.shot');
    if (!shot) return;
    event.preventDefault();
    items = Array.from(shot.closest('.gallery').querySelectorAll('a.shot'));
    trigger = shot;
    show(items.indexOf(shot));
    dialog.showModal();
    document.body.classList.add('gallery-open');
    $('#gallery-close').focus();
  });
  $('#gallery-close').addEventListener('click', () => dialog.close());
  $('#gallery-prev').addEventListener('click', () => show(index - 1));
  $('#gallery-next').addEventListener('click', () => show(index + 1));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('cancel', () => document.body.classList.remove('gallery-open'));
  dialog.addEventListener('close', () => {
    document.body.classList.remove('gallery-open');
    image.removeAttribute('src');
    trigger?.focus();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); show(index + 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); show(index - 1); }
  });
})();
