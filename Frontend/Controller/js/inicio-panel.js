(() => {
  function getToken() {
    try { return localStorage.getItem('token') || ''; } catch (_) { return ''; }
  }

  async function apiFetch(url) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) return null;
      return res.json();
    } catch (_) {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatCurrency(amount) {
    const n = Number(amount) || 0;
    const intPart = Math.floor(n);
    const decPart = Math.round((n - intPart) * 100);
    return {
      int: '$' + intPart.toLocaleString('es-CO'),
      dec: '.' + String(decPart).padStart(2, '0')
    };
  }

  function formatRelativeDate(dateStr, timeStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);

    let label;
    if (d.getTime() === today.getTime()) label = 'Hoy';
    else if (d.getTime() === tomorrow.getTime()) label = 'Mañana';
    else label = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      label += `, ${h12}:${String(m).padStart(2, '0')} ${period}`;
    }
    return label;
  }

  function agendaIcon(tipo) {
    const icons = { audiencia: 'fa-gavel', reunion: 'fa-handshake', vencimiento: 'fa-exclamation-triangle' };
    return icons[tipo] || 'fa-calendar-check';
  }

  function agendaDotClass(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dateStr + 'T00:00:00');
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime() ? 'agenda-dot-success' : 'agenda-dot-warn';
  }

  function taskDot(estado) {
    const map = {
      pendiente:  { cls: 'pending', icon: 'fa-hourglass-half' },
      en_proceso: { cls: 'pending', icon: 'fa-play' },
      revision:   { cls: 'pending', icon: 'fa-search' },
      completado: { cls: 'done',    icon: 'fa-check' },
      cancelado:  { cls: 'urgent',  icon: 'fa-times' }
    };
    return map[estado] || { cls: 'pending', icon: 'fa-hourglass-half' };
  }

  function notifColor(tipo) {
    const map = {
      documento_rechazado:   'red',
      documento_en_revision: 'amber',
      asignacion_tarea:      'amber',
      tarea_recibida:        'amber',
      documento_aceptado:    'green'
    };
    return map[tipo] || 'amber';
  }

  // ===== ADMIN =====
  async function loadAdminData() {
    const [concilData, finanzasData, tareasData, agendaData, notifData] = await Promise.all([
      apiFetch('/conciliacion?estado=pendiente&limit=200'),
      apiFetch('/finanzas/grafica'),
      apiFetch('/tasks/'),
      apiFetch('/agenda/'),
      apiFetch('/notifications?limit=3')
    ]);

    // Casos pendientes
    const elCasos = document.getElementById('stat-casos-pendientes');
    if (elCasos) elCasos.textContent = concilData ? (concilData.total ?? 0) : '—';

    // Ingresos / Egresos del mes
    if (finanzasData && finanzasData.porMes) {
      const now = new Date();
      const mesKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const mes = finanzasData.porMes.find(m => m.mes === mesKey);

      const elIngMes = document.getElementById('stat-ingresos-mes');
      const elIngDec = document.getElementById('stat-ingresos-dec');
      if (elIngMes) {
        const { int, dec } = formatCurrency(mes?.ingresos || 0);
        elIngMes.textContent = int;
        if (elIngDec) elIngDec.textContent = dec;
      }

      const elEgrMes = document.getElementById('stat-egresos-mes');
      const elEgrDec = document.getElementById('stat-egresos-dec');
      if (elEgrMes) {
        const { int, dec } = formatCurrency(mes?.egresos || 0);
        elEgrMes.textContent = int;
        if (elEgrDec) elEgrDec.textContent = dec;
      }
    }

    // Documentos en proceso (tareas en revisión o en_proceso que tienen documento)
    const elDocs = document.getElementById('stat-docs-proceso');
    if (elDocs && tareasData) {
      const count = (tareasData.data || []).filter(
        t => (t.estado === 'revision' || t.estado === 'en_proceso') && (t.documento_judicante || t.documento_admin)
      ).length;
      elDocs.textContent = count;
    }

    // Agenda próxima
    const elAgenda = document.getElementById('agenda-list-admin');
    if (elAgenda && agendaData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = (agendaData.data || [])
        .filter(e => new Date(e.fecha + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .slice(0, 3);

      if (!upcoming.length) {
        elAgenda.innerHTML = '<p style="padding:12px 0;color:#5a7a84;font-size:.85rem;">No hay eventos próximos.</p>';
      } else {
        elAgenda.innerHTML = upcoming.map(e => `
          <div class="agenda-item">
            <div class="agenda-icon"><i class="fas ${agendaIcon(e.tipo)}"></i></div>
            <div class="agenda-info">
              <div class="agenda-title">${escapeHtml(e.titulo)}</div>
              <div class="agenda-sub">${escapeHtml(e.lugar || e.caso || '')}</div>
            </div>
            <div class="agenda-time">
              <i class="fas fa-circle ${agendaDotClass(e.fecha)}"></i>
              ${escapeHtml(formatRelativeDate(e.fecha, e.hora))}
              <i class="fas fa-chevron-right"></i>
            </div>
          </div>`).join('');
      }
    }

    // Tareas recientes
    const elTareas = document.getElementById('task-list-admin');
    if (elTareas && tareasData) {
      const recent = (tareasData.data || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 4);

      if (!recent.length) {
        elTareas.innerHTML = '<p style="padding:8px 0;color:#5a7a84;font-size:.85rem;">No hay tareas.</p>';
      } else {
        elTareas.innerHTML = recent.map(t => {
          const { cls, icon } = taskDot(t.estado);
          return `<div class="task-item">
            <div class="task-dot ${cls}"><i class="fas ${icon}"></i></div>
            ${escapeHtml(t.descripcion)}
          </div>`;
        }).join('');
      }
    }

    // Notificaciones (panel pequeño)
    const elNotif = document.getElementById('notif-list-admin');
    if (elNotif && notifData) {
      const items = (notifData.data || []).slice(0, 3);
      if (!items.length) {
        elNotif.innerHTML = '<p style="padding:8px 0;color:#5a7a84;font-size:.85rem;">Sin notificaciones.</p>';
      } else {
        elNotif.innerHTML = items.map(n => `
          <div class="notif-item">
            <div class="notif-color ${notifColor(n.tipo)}"></div>
            <div class="notif-text">${escapeHtml(n.titulo || n.mensaje || 'Notificación')}</div>
            <i class="fas fa-chevron-right notif-arr"></i>
          </div>`).join('');
      }
    }
  }

  // ===== JUDICANTE =====
  async function loadJudicanteData() {
    const [tareasData, agendaData, notifData] = await Promise.all([
      apiFetch('/tasks/'),
      apiFetch('/agenda/'),
      apiFetch('/notifications?limit=3')
    ]);

    // Tareas pendientes
    const elTareasPend = document.getElementById('stat-tareas-pendientes');
    if (elTareasPend && tareasData) {
      const count = (tareasData.data || []).filter(t => t.estado === 'pendiente' || t.estado === 'en_proceso').length;
      elTareasPend.textContent = count;
    }

    // Documentos asignados (tareas con documento del admin)
    const elDocsAsig = document.getElementById('stat-docs-asignados');
    if (elDocsAsig && tareasData) {
      const count = (tareasData.data || []).filter(t => t.documento_admin).length;
      elDocsAsig.textContent = count;
    }

    // Próxima cita
    const elCitaTime = document.getElementById('stat-proxima-cita-time');
    const elCitaName = document.getElementById('stat-proxima-cita-name');
    if (agendaData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = (agendaData.data || [])
        .filter(e => new Date(e.fecha + 'T00:00:00') >= today)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

      if (upcoming.length) {
        const next = upcoming[0];
        if (elCitaTime) elCitaTime.textContent = formatRelativeDate(next.fecha, next.hora);
        if (elCitaName) elCitaName.textContent = next.titulo;
      } else {
        if (elCitaTime) elCitaTime.textContent = 'Sin citas';
        if (elCitaName) elCitaName.textContent = '';
      }
    }

    // Calendario semanal
    buildWeekCalendar(agendaData);

    // Tareas recientes del judicante
    const elTareas = document.getElementById('task-list-judic');
    if (elTareas && tareasData) {
      const recent = (tareasData.data || [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 4);

      if (!recent.length) {
        elTareas.innerHTML = '<p style="padding:8px 0;color:#5a7a84;font-size:.85rem;">No tienes tareas asignadas.</p>';
      } else {
        elTareas.innerHTML = recent.map(t => {
          const { cls, icon } = taskDot(t.estado);
          return `<div class="task-item">
            <div class="task-dot ${cls}"><i class="fas ${icon}"></i></div>
            ${escapeHtml(t.descripcion)}
          </div>`;
        }).join('');
      }
    }

    // Notificaciones (panel pequeño)
    const elNotif = document.getElementById('notif-list-judic');
    if (elNotif && notifData) {
      const items = (notifData.data || []).slice(0, 3);
      if (!items.length) {
        elNotif.innerHTML = '<p style="padding:8px 0;color:#5a7a84;font-size:.85rem;">Sin notificaciones.</p>';
      } else {
        elNotif.innerHTML = items.map(n => `
          <div class="notif-item">
            <div class="notif-color ${notifColor(n.tipo)}"></div>
            <div class="notif-text">${escapeHtml(n.titulo || n.mensaje || 'Notificación')}</div>
            <i class="fas fa-chevron-right notif-arr"></i>
          </div>`).join('');
      }
    }
  }

  function buildWeekCalendar(agendaData) {
    const calGrid = document.getElementById('cal-grid-judic');
    if (!calGrid) return;

    const today = new Date();
    const dow = today.getDay(); // 0=Dom
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    monday.setHours(0, 0, 0, 0);

    const dayNames = ['Lun', 'Mar', 'Mier', 'Jue', 'Vie', 'Sáb'];
    const weekDays = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    const eventsByDate = {};
    if (agendaData) {
      (agendaData.data || []).forEach(e => {
        const key = e.fecha; // YYYY-MM-DD
        if (!eventsByDate[key]) eventsByDate[key] = [];
        eventsByDate[key].push(e);
      });
    }

    const headers = weekDays.map((d, i) =>
      `<div class="cal-day-head">${dayNames[i]} ${d.getDate()}</div>`
    ).join('');

    const cells = weekDays.map(d => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const events = eventsByDate[key] || [];
      if (!events.length) return '<div class="cal-day"></div>';

      const evHtml = events.map(e => {
        const color = e.tipo === 'audiencia' ? 'red' : 'teal';
        const time = e.hora ? `<br>${e.hora}` : '';
        return `<div class="cal-event ${color}">${escapeHtml(e.titulo)}${time}</div>`;
      }).join('');
      return `<div class="cal-day has-event">${evHtml}</div>`;
    }).join('');

    calGrid.innerHTML = headers + cells;
  }

  function init() {
    const tipo = localStorage.getItem('tipo_usuario') || 'administrador';
    if (tipo === 'judicante') {
      loadJudicanteData();
    } else {
      loadAdminData();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
