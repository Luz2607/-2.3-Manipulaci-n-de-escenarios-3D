// assets/js/main.js  (sin loader)

(() => {
  // =============== Helpers ===============
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  // =============== DOM refs ===============
  const yearEl   = $('#year');
  const splash   = $('#splash');
  const app      = $('#app');
  const btnTheme = $('#btnTheme');
  const btnOpenAll = $('#btnOpenAll');
  const navbar   = document.querySelector('nav.navbar');

  // =============== Año footer ===============
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // =============== Imagen de inicio SOLO al recargar ===============
  const SPLASH_MS  = 1400; // cuánto dura la imagen de inicio
  const SPLASH_IMG = 'assets/img/general.png'; // <-- ajusta si usas otro nombre

  function isReloadNavigation() {
    try {
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      if (nav?.type) return nav.type === 'reload';
      return performance.navigation && performance.navigation.type === 1;
    } catch { return false; }
  }

  const showSplashNow = isReloadNavigation();

  // Preconfigura el splash lo antes posible
  if (splash) {
    if (showSplashNow) {
      splash.style.background = `#000 url('${SPLASH_IMG}') center/cover no-repeat`;
      splash.classList.remove('d-none'); // mostrar SOLO en recarga
    } else {
      splash.classList.add('d-none');    // en carga normal, oculto
    }
  }

  // =============== On load ===============
  window.addEventListener('load', () => {
    preloadCardImages();

    if (!app) return;

    if (showSplashNow && splash) {
      // Imagen de inicio -> app
      setTimeout(() => {
        splash.classList.add('d-none');
        app.classList.remove('d-none');
      }, SPLASH_MS);
    } else {
      // Directo a la app (sin loader)
      splash?.classList.add('d-none');
      app.classList.remove('d-none');
    }

    // Previews en reverso (lazy)
    initCardPreviews();
  });

  // =============== Tema (persistente) ===============
  const THEME_KEY = 'ui.theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function setNavbarTone(theme) {
    if (!navbar) return;
    navbar.classList.remove('navbar-dark', 'navbar-light');
    navbar.classList.add(theme === 'dark' ? 'navbar-dark' : 'navbar-light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    setNavbarTone(theme);
    if (btnTheme) {
      btnTheme.innerHTML = theme === 'dark'
        ? '<i class="bi bi-moon-stars"></i>'
        : '<i class="bi bi-sun"></i>';
    }
  }

  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    setTheme(saved || (prefersDark ? 'dark' : 'light'));
  })();

  on(btnTheme, 'click', () => {
    const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  // =============== Abrir todas en nuevas pestañas ===============
  on(btnOpenAll, 'click', () => {
    [
      'demos/geometry-minecraft/index.html',
      'demos/controls-orbit/index.html',
      'demos/controls-map/index.html',
      'demos/controls-pointerlock/index.html'
    ].forEach(u => window.open(u, '_blank'));
  });

  // =============== Smooth scroll ===============
  $$('a[href^="#"]').forEach(a => {
    on(a, 'click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = $(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // =============== Precarga de imágenes de las cards ===============
  function extractUrlFromBgStyle(styleStr) {
    const m = styleStr && styleStr.match(/url\(['"]?([^'")]+)['"]?\)/i);
    return m ? m[1] : null;
  }
  function preloadCardImages() {
    const elems = $$('.flip-card-front, .flip-card-back');
    const urls = new Set();
    elems.forEach(el => {
      const s = el.getAttribute('style') || '';
      const u = extractUrlFromBgStyle(s);
      if (u) urls.add(u);
    });
    urls.forEach(src => { const img = new Image(); img.src = src; });
  }

  // =============== Accesibilidad: tecla G ===============
  on(document, 'keydown', (e) => {
    if (e.key.toLowerCase() === 'g') {
      const target = $('#coleccion') || app;
      target?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // =============== Reduced motion ===============
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) {
    document.body.classList.add('reduce-motion');
    const style = document.createElement('style');
    style.textContent = `
      .flip-card-inner { transition: none !important; }
      .card-glow:hover { transform: none !important; box-shadow: 0 12px 24px rgba(0,0,0,.35) !important; }
      @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
    `;
    document.head.appendChild(style);
  }

  // =============== Previews en reverso (lazy) ===============
  function initCardPreviews() {
    const cards = $$('.flip-card');
    const io = ('IntersectionObserver' in window)
      ? new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const back = entry.target;
            const wrap = back.querySelector('.preview-embed[data-src]');
            const iframe = wrap?.querySelector('iframe');
            if (wrap && iframe && !wrap.dataset.loaded) {
              iframe.src = wrap.dataset.src;
              wrap.dataset.loaded = '1';
            }
          });
        }, { threshold: 0.3 })
      : null;

    cards.forEach(card => {
      const back = card.querySelector('.flip-card-back');
      if (!back) return;

      const loadNow = () => {
        const wrap = back.querySelector('.preview-embed[data-src]');
        const iframe = wrap?.querySelector('iframe');
        if (wrap && iframe && !wrap.dataset.loaded) {
          iframe.src = wrap.dataset.src;
          wrap.dataset.loaded = '1';
        }
      };

      card.addEventListener('mouseenter', loadNow, { passive: true });
      card.addEventListener('touchstart', loadNow, { passive: true });

      io && io.observe(back);
    });
  }
})();

// ===== Buscador =====
(() => {
  const q = document.getElementById('q');
  if (!q) return;
  const items = [...document.querySelectorAll('.flip-card')].map(card => ({
    card,
    text: (card.querySelector('.label .title')?.textContent + ' ' +
           card.querySelector('.label .subtitle')?.textContent || '').toLowerCase()
  }));
  q.addEventListener('input', () => {
    const term = q.value.trim().toLowerCase();
    items.forEach(({card, text}) => {
      card.closest('.col-12').classList.toggle('d-none', term && !text.includes(term));
    });
  });
})();
