// Content editor: overlays "Edit" / "Replace" on the live page structure. Loaded by content.js when ?edit=1.
// Saves go to /api/admin/* which Cloudflare Access + server-side JWT verification restrict to allowed emails.
(function () {
  const SC = window.SiteContent;
  if (!SC) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'edit.css';
  document.head.appendChild(link);

  const MAX_EDGE = 2000;
  let draft = SC.merge(SC.base, SC.published);
  let dirty = false;
  let canRestore = false;
  const overlays = [];

  const layer = el('div', 'cms-layer');
  const bar = el('div', 'cms-bar');
  const status = el('span', 'cms-bar__status');

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function button(label, cls, onClick) {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function setStatus(msg) { status.textContent = msg; }

  function markDirty() {
    dirty = true;
    setStatus('Unsaved changes');
    SC.apply(draft);
    position();
  }

  async function api(path, options) {
    let res;
    try {
      res = await fetch(path, Object.assign({ credentials: 'same-origin', redirect: 'manual' }, options));
    } catch (e) {
      const err = new Error('Could not reach the server. Check your connection and try again.');
      err.status = 0;
      throw err;
    }
    // Without a valid Access session the request is redirected to the login page.
    if (res.type === 'opaqueredirect' || res.status === 302) {
      const err = new Error('Sign-in required.');
      err.status = 401;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Request failed (' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function dialog(title, buildBody, onSave) {
    const d = el('dialog', 'cms-dialog');
    d.appendChild(el('h2', '', title));
    buildBody(d);
    const error = el('p', 'cms-dialog__error');
    error.hidden = true;
    const actions = el('div', 'cms-dialog__actions');
    const cancel = button('Cancel', 'cms-btn', function () { d.close(); });
    const save = button('Apply', 'cms-btn cms-btn--primary', async function () {
      save.disabled = true;
      error.hidden = true;
      try {
        await onSave();
        d.close();
      } catch (e) {
        error.textContent = e.message;
        error.hidden = false;
      } finally {
        save.disabled = false;
      }
    });
    actions.append(cancel, save);
    d.append(error, actions);
    d.addEventListener('close', function () { d.remove(); });
    document.body.appendChild(d);
    d.showModal();
    return d;
  }

  function editText(target) {
    const key = target.getAttribute('data-text');
    let area;
    dialog('Edit Text', function (d) {
      area = el('textarea');
      area.value = draft.text[key] || '';
      d.append(area, el('p', 'cms-dialog__hint', 'Put *asterisks* around a word to italicize it. Press Enter for a new line.'));
    }, function () {
      draft.text[key] = area.value;
      markDirty();
    });
    area.focus();
  }

  function decodeToJpeg(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error('Could not convert that image.'));
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('That file is not a picture this browser can read. Use JPG, PNG, WebP, GIF or BMP.'));
      };
      img.src = url;
    });
  }

  function replaceImage(target) {
    const key = target.getAttribute('data-img');
    const current = draft.images[key] || { src: target.getAttribute('src'), caption: target.alt };
    let file = null;
    let caption;
    dialog('Replace Photo', function (d) {
      const preview = el('img');
      preview.src = current.src;
      preview.alt = 'Current photo';
      const input = el('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp';
      input.addEventListener('change', function () {
        file = input.files && input.files[0];
        if (file) preview.src = URL.createObjectURL(file);
      });
      caption = el('input');
      caption.type = 'text';
      caption.value = current.caption || '';
      caption.setAttribute('aria-label', 'Caption');
      d.append(
        preview, input,
        el('p', 'cms-dialog__hint', 'Choose a picture from your computer. Large photos are resized automatically.'),
        el('p', 'cms-dialog__hint', 'Caption (shown on hover and read by screen readers):'),
        caption
      );
    }, async function () {
      let src = current.src;
      if (file) {
        setStatus('Uploading photo…');
        const blob = await decodeToJpeg(file);
        const up = await api('/api/admin/upload', { method: 'POST', body: blob });
        src = up.src;
      }
      draft.images[key] = { src: src, caption: caption.value };
      markDirty();
    });
  }

  function addOverlay(target, label, onClick) {
    const b = button(label, 'cms-overlay', onClick);
    b.setAttribute('aria-label', label + ' ' + (target.getAttribute('data-text') || target.getAttribute('data-img')));
    layer.appendChild(b);
    overlays.push({ target: target, button: b, image: label === 'Replace' });
  }

  function position() {
    overlays.forEach(function (o) {
      const r = o.target.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0;
      o.button.hidden = !visible;
      o.target.classList.toggle('cms-editable', visible && !o.image);
      if (!visible) return;
      o.button.style.top = window.scrollY + r.top + 6 + 'px';
      o.button.style.left = window.scrollX + r.right - o.button.offsetWidth - 6 + 'px';
    });
  }

  async function saveDraft() {
    setStatus('Saving draft…');
    await api('/api/admin/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    dirty = false;
    setStatus('Draft saved');
  }

  function guarded(fn) {
    return async function () {
      try { await fn(); } catch (e) { setStatus(e.message); }
    };
  }

  function buildBar(editor) {
    bar.appendChild(el('span', 'cms-bar__title', 'Content Management · ' + editor));
    document.querySelectorAll('[data-section]').forEach(function (sec) {
      const name = sec.getAttribute('data-section');
      const label = el('label');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = !(draft.sections[name] && draft.sections[name].visible === false);
      box.addEventListener('change', function () {
        draft.sections[name] = { visible: box.checked };
        markDirty();
      });
      label.append(box, document.createTextNode('Show ' + name.charAt(0).toUpperCase() + name.slice(1) + ' Section'));
      bar.appendChild(label);
    });
    bar.appendChild(status);
    bar.appendChild(button('Save Draft', 'cms-btn', guarded(saveDraft)));
    bar.appendChild(button('Publish', 'cms-btn cms-btn--primary', guarded(async function () {
      if (!confirm('Publish these changes to the live site?')) return;
      await saveDraft();
      setStatus('Publishing…');
      await api('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' })
      });
      canRestore = true;
      setStatus('Published. Changes are live.');
    })));
    bar.appendChild(button('Restore Previous Version', 'cms-btn', guarded(async function () {
      if (!canRestore) { setStatus('There is no previous version yet.'); return; }
      if (!confirm('Put the previous published version back on the live site?')) return;
      await api('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' })
      });
      dirty = false;
      window.location.reload();
    })));
    bar.appendChild(button('Exit Editor', 'cms-btn', function () {
      if (dirty && !confirm('Leave without saving your changes?')) return;
      dirty = false;
      window.location.href = '/';
    }));
  }

  async function start() {
    document.documentElement.classList.add('cms-active');
    document.body.append(layer, bar);

    let info;
    try {
      info = await api('/api/admin/draft');
    } catch (e) {
      bar.appendChild(el('span', 'cms-bar__title', e.status === 401
        ? 'Sign-in required to edit this site.'
        : e.message));
      const a = el('a', 'cms-btn', 'Sign In');
      a.href = '/admin/';
      bar.appendChild(a);
      return;
    }

    canRestore = info.canRestore;
    if (info.draft) draft = SC.merge(SC.base, info.draft);
    SC.apply(draft);

    document.querySelectorAll('[data-text]').forEach(function (t) {
      addOverlay(t, 'Edit', function () { editText(t); });
    });
    document.querySelectorAll('[data-img]').forEach(function (i) {
      addOverlay(i, 'Replace', function () { replaceImage(i); });
    });
    buildBar(info.editor);
    setStatus(info.draft ? 'Editing saved draft' : 'Editing live content');

    position();
    window.addEventListener('resize', position);
    window.addEventListener('load', position);
    new ResizeObserver(position).observe(document.body);
    window.addEventListener('beforeunload', function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  start();
})();
