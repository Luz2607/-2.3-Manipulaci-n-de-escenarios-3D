// assets/js/main.js

(() => {
  // =============== Helpers ===============
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

  // =============== DOM refs ===============
  const yearEl = $('#year');
  const splash = $('#splash');
  const loader = $('#loader');
  const app    = $('#app');
  const btnTheme = $('#btnTheme');
  const btnOpenAll = $('#btnOpenAll');
  const navbar = document.querySelector('nav.navbar');

  // =============== Año footer ===============
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // =============== Duraciones ===============
  const SPLASH_MS = 1400;
  const LOADER_MS = 1100;

  // =============== Imagen de inicio SOLO al recargar (1ra vez por pestaña) ===============
  // Ajusta la ruta de la imagen aquí:
  const SPLASH_IMG = 'assets/img/general.png';
  // Se mostrará ÚNICAMENTE si la navegación es "reload" y aún no se mostró en esta sesión (pestaña).
  const RELOAD_FLAG = 'ui.reloadSplashShownSession';

  function isReloadNavigation() {
    try {
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'reload';
      // Fallback legacy
      return performance.navigation && performance.navigation.type === 1;
    } catch { return false; }
  }

  const isReload = isReloadNavigation();
  const alreadyShownThisSession = sessionStorage.getItem(RELOAD_FLAG) === '1';
  const showSplashNow = isReload && !alreadyShownThisSession;

  // Preconfigura el splash lo antes posible
  if (splash) {
    if (showSplashNow) {
      // Imagen a pantalla completa
      splash.style.background = `#000 url('${SPLASH_IMG}') center/cover no-repeat`;
    } else {
      // Si NO toca mostrar imagen, ocultamos temprano para evitar parpadeos
      splash.classList.add('d-none');
    }
  }

  // =============== Splash -> Loader -> App ===============
  // Splash solo PRIMERA vez (conservado por compatibilidad)
  const FIRST_KEY = 'ui.firstVisitShown';

  window.addEventListener('load', () => {
    // Precarga de imágenes usadas en las cards (evita “parpadeo”)
    preloadCardImages();

    if (splash && loader && app) {
      if (showSplashNow) {
        // Mostrar imagen de inicio -> luego loader -> app
        setTimeout(() => {
          splash.classList.add('d-none');
          loader.classList.remove('d-none');
          setTimeout(() => {
            loader.classList.add('d-none');
            app.classList.remove('d-none');
            // marca que ya se mostró en esta sesión
            sessionStorage.setItem(RELOAD_FLAG, '1');
            localStorage.setItem(FIRST_KEY, '1');
          }, LOADER_MS);
        }, SPLASH_MS);
      } else {
        // Sin imagen de inicio: solo loader breve -> app
        splash.classList.add('d-none');
        loader.classList.remove('d-none');
        setTimeout(() => {
          loader.classList.add('d-none');
          app.classList.remove('d-none');
          localStorage.setItem(FIRST_KEY, '1');
        }, Math.min(500, LOADER_MS));
      }
    }

    // Inicializa previews (lazy al voltear)
    initCardPreviews();
  });

  // =============== Toggle tema (con persistencia) ===============
  const THEME_KEY = 'ui.theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  function setNavbarTone(theme) {
    if (!navbar) return;
    navbar.classList.remove('navbar-dark', 'navbar-light');
    if (theme === 'dark') navbar.classList.add('navbar-dark');
    else navbar.classList.add('navbar-light');
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    setNavbarTone(theme);
    if (btnTheme) {
      btnTheme.innerHTML =
        theme === 'dark'
          ? '<i class="bi bi-moon-stars"></i>'
          : '<i class="bi bi-sun"></i>';
    }
  }

  // Inicializa tema (persistente)
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
    const urls = [
      'demos/geometry-minecraft/index.html',
      'demos/controls-orbit/index.html',
      'demos/controls-map/index.html',
      'demos/controls-pointerlock/index.html'
    ];
    urls.forEach(u => window.open(u, '_blank'));
  });

  // =============== Smooth scroll para anclas internas ===============
  $$('a[href^="#"]').forEach(a => {
    on(a, 'click', (e) => {
      const target = a.getAttribute('href');
      if (!target || target.length < 2) return;
      const el = $(target);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // =============== Mostrar loader al abrir una demo (mejor UX) ===============
  function enableLoaderOnCardLinks() {
    $$('.card-link').forEach(a => {
      on(a, 'click', () => {
        if (loader) loader.classList.remove('d-none');
      });
    });
  }
  enableLoaderOnCardLinks();

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
    urls.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }

  // =============== Accesibilidad / Tecla rápida ===============
  // G → baja a la colección (#coleccion) si existe
  on(document, 'keydown', (e) => {
    if (e.key.toLowerCase() === 'g') {
      const target = $('#coleccion') || app;
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // =============== Respeta “prefers-reduced-motion” ===============
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce.matches) {
    document.body.classList.add('reduce-motion');
    const style = document.createElement('style');
    style.textContent = `
      .flip-card-inner { transition: none !important; }
      .card-glow:hover {
        transform: none !important;
        box-shadow: 0 12px 24px rgba(0,0,0,.35) !important;
      }
      @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
    `;
    document.head.appendChild(style);
  }

  // =============== Loader al abandonar la página (navegación estándar) ===============
  window.addEventListener('beforeunload', () => {
    if (loader) loader.classList.remove('d-none');
  });

  // =============== Vista previa en reverso (lazy) ===============
  function initCardPreviews() {
    const cards = $$('.flip-card');
    const opts = { threshold: 0.3 };

    const io = ('IntersectionObserver' in window)
      ? new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const back = entry.target;
              const wrap = back.querySelector('.preview-embed[data-src]');
              const iframe = wrap?.querySelector('iframe');
              if (wrap && iframe && !wrap.dataset.loaded) {
                iframe.src = wrap.dataset.src;
                wrap.dataset.loaded = '1';
              }
            }
          });
        }, opts)
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

      if (io) io.observe(back);
    });
  }
})();

// ===== Buscador de demos (filtra por título/subtítulo) =====
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
