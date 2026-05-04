(() => {
  const API_BASE = '/notifications';
  const POLL_MS = 45000;

  const state = {
    loaded: false,
    open: false,
    button: null,
    popover: null,
    list: null,
    unread: null,
    count: null,
    dot: null,
    cache: []
  };

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (_) {
      return '';
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  function initials(item) {
    const source = item.actor_nombre || item.titulo || 'LX';
    return String(source)
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] || '')
      .join('')
      .toUpperCase() || 'LX';
  }

  function injectStyles() {
    if (document.getElementById('notifications-shared-styles')) return;
    const style = document.createElement('style');
    style.id = 'notifications-shared-styles';
    style.textContent = `
      .tb-btn, .tb-icon-btn { position: relative; }
      .tb-count {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: #e74c3c;
        color: #fff;
        font-size: .65rem;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(15,21,22,.2);
      }
      .tb-dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #e74c3c;
        border: 2px solid #fff;
      }
      .notifications-popover {
        position: fixed;
        top: 76px;
        right: 28px;
        width: min(440px, calc(100vw - 24px));
        background: rgba(255,255,255,.98);
        border: 1px solid rgba(35,76,88,.12);
        border-radius: 18px;
        box-shadow: 0 24px 60px rgba(15,21,22,.18);
        z-index: 1400;
        display: none;
        overflow: hidden;
      }
      .notifications-popover.active { display: block; }
      .notifications-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 14px;
        padding: 18px 18px 12px;
        border-bottom: 1px solid rgba(35,76,88,.08);
      }
      .notifications-kicker {
        font-size: .72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: var(--color-secondary, #5a7a84);
        margin-bottom: 4px;
      }
      .notifications-head h3 { font-size: 1rem; color: var(--color-primary, #234c58); }
      .notifications-close {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(35,76,88,.14);
        background: #fff;
        color: var(--color-secondary, #5a7a84);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all .2s;
        flex-shrink: 0;
      }
      .notifications-close:hover { background: #fdedec; color: #c0392b; }
      .notifications-summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 18px;
        background: linear-gradient(135deg, rgba(35,76,88,.04), rgba(35,76,88,.08));
        border-bottom: 1px solid rgba(35,76,88,.08);
      }
      .notifications-stat { display: grid; gap: 2px; }
      .notifications-stat span {
        font-size: 1.2rem;
        font-weight: 800;
        color: var(--color-primary, #234c58);
      }
      .notifications-stat small {
        font-size: .74rem;
        color: var(--color-secondary, #5a7a84);
        font-weight: 600;
      }
      .notifications-action {
        border: 1px solid rgba(35,76,88,.16);
        background: #fff;
        color: var(--color-primary, #234c58);
        border-radius: 10px;
        padding: 8px 12px;
        font-family: inherit;
        font-size: .78rem;
        font-weight: 700;
        cursor: pointer;
        transition: all .2s;
      }
      .notifications-action:hover { background: rgba(35,76,88,.08); }
      .notifications-list { max-height: 420px; overflow-y: auto; }
      .notification-item {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(35,76,88,.08);
        cursor: pointer;
        transition: background .18s;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .notification-item:last-child { border-bottom: none; }
      .notification-item:hover { background: rgba(35,76,88,.05); }
      .notification-item.unread { background: rgba(35,76,88,.03); }
      .notification-avatar {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--color-primary, #234c58), #2f6475);
        color: #fff;
        font-size: .72rem;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .notification-content { min-width: 0; flex: 1; }
      .notification-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
      .notification-title { font-size: .86rem; font-weight: 700; color: var(--color-dark, #0f1516); line-height: 1.35; }
      .notification-time { font-size: .7rem; color: var(--color-secondary, #5a7a84); font-weight: 600; flex-shrink: 0; }
      .notification-sender { font-size: .74rem; font-weight: 700; color: var(--color-primary, #234c58); margin-bottom: 6px; }
      .notification-message { font-size: .8rem; color: var(--color-secondary, #5a7a84); line-height: 1.45; }
      .notifications-empty {
        padding: 28px 18px;
        text-align: center;
        color: var(--color-secondary, #5a7a84);
        font-size: .84rem;
        font-weight: 600;
      }
      @media (max-width: 640px) {
        .notifications-popover {
          left: 12px;
          right: 12px;
          width: auto;
          top: 68px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function buildPopover() {
    if (document.getElementById('notificationsPopover')) return;
    const popover = document.createElement('div');
    popover.className = 'notifications-popover';
    popover.id = 'notificationsPopover';
    popover.setAttribute('aria-hidden', 'true');
    popover.innerHTML = `
      <div class="notifications-head">
        <div>
          <p class="notifications-kicker">Bandeja de entrada</p>
          <h3>Mensajes</h3>
        </div>
        <button class="notifications-close" id="closeNotifications" aria-label="Cerrar notificaciones"><i class="fas fa-times"></i></button>
      </div>
      <div class="notifications-summary">
        <div class="notifications-stat">
          <span id="notificationsUnread">0</span>
          <small>sin leer</small>
        </div>
        <button class="notifications-action" id="markAllNotificationsRead">Vaciar bandeja</button>
      </div>
      <div class="notifications-list" id="notificationsList">
        <div class="notifications-empty">Cargando notificaciones...</div>
      </div>
    `;
    document.body.appendChild(popover);
  }

  function findButton() {
    const candidates = Array.from(document.querySelectorAll('button'));
    const bellButton = candidates.find((button) => {
      if (!button.querySelector('.fa-bell')) return false;
      const style = window.getComputedStyle(button);
      return style.display !== 'none' && style.visibility !== 'hidden' && button.offsetParent !== null;
    }) || candidates.find((button) => button.querySelector('.fa-bell'));
    if (!bellButton) return null;
    if (!bellButton.id) bellButton.id = 'btnNotisShared';
    bellButton.setAttribute('aria-haspopup', 'true');
    bellButton.setAttribute('aria-expanded', 'false');
    return bellButton;
  }

  function syncBadgeElements(button) {
    let dot = button.querySelector('.tb-dot, .dot');
    let count = button.querySelector('.tb-count');

    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'tb-dot';
      dot.style.display = 'none';
      button.appendChild(dot);
    } else if (!dot.classList.contains('tb-dot')) {
      dot.classList.add('tb-dot');
    }

    if (!count) {
      count = document.createElement('span');
      count.className = 'tb-count';
      count.hidden = true;
      count.textContent = '0';
      button.appendChild(count);
    }

    state.dot = dot;
    state.count = count;
  }

  function getElements() {
    state.button = findButton();
    state.popover = document.getElementById('notificationsPopover');
    state.list = document.getElementById('notificationsList');
    state.unread = document.getElementById('notificationsUnread');

    if (!state.button || !state.popover || !state.list || !state.unread) return false;
    syncBadgeElements(state.button);
    return true;
  }

  async function apiFetch(url, opts = {}) {
    const token = getToken();
    const res = await fetch(url, {
      ...opts,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {})
      }
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.mensaje || errorBody.error || 'No se pudieron cargar las notificaciones');
    }

    return res.json();
  }

  function renderCount(count) {
    const unread = Number(count || 0);
    state.unread.textContent = String(unread);
    if (state.count) {
      state.count.textContent = String(unread);
      state.count.hidden = unread <= 0;
    }
    if (state.dot) state.dot.style.display = unread > 0 ? 'block' : 'none';
  }

  function render(items) {
    if (!items.length) {
      state.list.innerHTML = '<div class="notifications-empty">No tienes notificaciones nuevas.</div>';
      return;
    }

    state.list.innerHTML = items.map((item) => {
      const unreadClass = item.leida ? '' : 'unread';
      const actor = escapeHtml(item.actor_nombre || 'Sistema');
      return `
        <article class="notification-item ${unreadClass}" data-id="${item._id}">
          <div class="notification-avatar">${escapeHtml(initials(item))}</div>
          <div class="notification-content">
            <div class="notification-top">
              <h4 class="notification-title">${escapeHtml(item.titulo || 'Notificación')}</h4>
              <span class="notification-time">${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <div class="notification-sender">${actor}</div>
            <p class="notification-message">${escapeHtml(item.mensaje || '')}</p>
          </div>
        </article>
      `;
    }).join('');

    state.list.querySelectorAll('.notification-item').forEach((node) => {
      node.addEventListener('click', async () => {
        try {
          await apiFetch(`${API_BASE}/${encodeURIComponent(node.dataset.id)}/read`, { method: 'PATCH' });
          state.loaded = false;
          await loadNotifications(true);
        } catch (error) {
          alert(error.message);
        }
      });
    });
  }

  async function loadNotifications(force = false) {
    if (state.loaded && !force) return;
    state.list.innerHTML = '<div class="notifications-empty">Cargando notificaciones...</div>';
    try {
      const data = await apiFetch(`${API_BASE}?limit=20`);
      state.cache = data.data || [];
      render(state.cache);
      renderCount(data.unreadCount || 0);
      state.loaded = true;
    } catch (error) {
      state.list.innerHTML = `<div class="notifications-empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function refreshCount() {
    try {
      const data = await apiFetch(`${API_BASE}?limit=1&soloNoLeidas=true`);
      renderCount(data.unreadCount || 0);
    } catch (_) {}
  }

  function openPanel() {
    state.popover.classList.add('active');
    state.popover.setAttribute('aria-hidden', 'false');
    state.button.setAttribute('aria-expanded', 'true');
    state.open = true;
  }

  function closePanel() {
    state.popover.classList.remove('active');
    state.popover.setAttribute('aria-hidden', 'true');
    state.button.setAttribute('aria-expanded', 'false');
    state.open = false;
  }

  async function togglePanel() {
    if (state.open) {
      closePanel();
      return;
    }
    openPanel();
    await loadNotifications(true);
  }

  function bindEvents() {
    if (state._bound) return;
    state._bound = true;
    if (!state.button.dataset.notificationsBound) {
      state.button.addEventListener('click', togglePanel);
      state.button.dataset.notificationsBound = '1';
    }

    const closeBtn = document.getElementById('closeNotifications');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    const markAllBtn = document.getElementById('markAllNotificationsRead');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
          await apiFetch(`${API_BASE}/read-all`, { method: 'PATCH' });
          state.loaded = false;
          await loadNotifications(true);
          closePanel();
        } catch (error) {
          alert(error.message);
        }
      });
    }

    document.addEventListener('click', (event) => {
      if (!state.open) return;
      if (state.popover.contains(event.target) || state.button.contains(event.target)) return;
      closePanel();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePanel();
    });

    setInterval(refreshCount, POLL_MS);

    const observer = new MutationObserver(() => {
      const currentButton = findButton();
      if (currentButton && currentButton !== state.button) {
        syncBadgeElements(currentButton);
        state.button = currentButton;
        if (!state.button.dataset.notificationsBound) {
          state.button.addEventListener('click', togglePanel);
          state.button.dataset.notificationsBound = '1';
        }
      }
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
  }

  function init() {
    injectStyles();
    buildPopover();
    if (!getElements()) return;
    bindEvents();
    refreshCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
