// Applies site content (text, images, section visibility) onto the fixed page structure.
// Order: site-content.json (shipped defaults) -> /api/content (published edits).
// With ?edit=1 the content editor (edit.js) is loaded on top.
(function () {
  function fill(el, value) {
    el.textContent = '';
    String(value).split('\n').forEach(function (line, i) {
      if (i > 0) el.appendChild(document.createElement('br'));
      line.split(/\*([^*]+)\*/).forEach(function (part, j) {
        if (!part) return;
        if (j % 2) {
          const em = document.createElement('em');
          em.textContent = part;
          el.appendChild(em);
        } else {
          el.appendChild(document.createTextNode(part));
        }
      });
    });
  }

  function apply(config) {
    const sections = config.sections || {};
    document.querySelectorAll('[data-section]').forEach(function (el) {
      const name = el.getAttribute('data-section');
      const visible = !sections[name] || sections[name].visible !== false;
      el.hidden = !visible;
      document.querySelectorAll('[data-section-link="' + name + '"]').forEach(function (link) {
        link.hidden = !visible;
      });
    });

    const text = config.text || {};
    document.querySelectorAll('[data-text]').forEach(function (el) {
      const value = text[el.getAttribute('data-text')];
      if (typeof value === 'string') fill(el, value);
    });

    const images = config.images || {};
    document.querySelectorAll('[data-img]').forEach(function (img) {
      const item = images[img.getAttribute('data-img')];
      if (!item) return;
      if (item.src) img.src = item.src;
      if (typeof item.caption === 'string') {
        img.alt = item.caption;
        const hover = img.parentElement && img.parentElement.querySelector('.cf-hover-text');
        if (hover) hover.textContent = item.caption;
      }
    });
  }

  function merge(base, over) {
    return {
      sections: Object.assign({}, base.sections, over && over.sections),
      text: Object.assign({}, base.text, over && over.text),
      images: Object.assign({}, base.images, over && over.images)
    };
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      return r.ok ? r.json() : Promise.reject(new Error(url + ' ' + r.status));
    });
  }

  const editMode = new URLSearchParams(window.location.search).get('edit') === '1';

  getJson('site-content.json')
    .then(function (base) {
      return getJson('/api/content')
        .catch(function () { return null; })
        .then(function (published) {
          apply(merge(base, published));
          window.SiteContent = { apply: apply, merge: merge, base: base, published: published };
          if (editMode) {
            const s = document.createElement('script');
            s.src = 'edit.js';
            document.body.appendChild(s);
          }
        });
    })
    .catch(function (err) { console.warn('Site content not applied:', err); });
})();
