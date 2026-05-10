/* ─── Renderizado de markdown básico ─────────────────────────────────────── */
function renderChatMarkdown(raw) {
  const DISCLAIMER = 'Esta respuesta es únicamente orientativa';
  let main = raw;
  let disclaimer = '';
  const di = raw.indexOf(DISCLAIMER);
  if (di !== -1) {
    main       = raw.slice(0, di).trim();
    disclaimer = raw.slice(di).trim();
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function inline(text) {
    return esc(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>');
  }

  const lines  = main.split('\n');
  const parts  = [];
  let inUl = false, inOl = false;

  for (const raw of lines) {
    const t = raw.trim();
    const ulMatch = t.match(/^[-•]\s+(.*)/);
    const olMatch = t.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) { parts.push('</ol>'); inOl = false; }
      if (!inUl) { parts.push('<ul>'); inUl = true; }
      parts.push(`<li>${inline(ulMatch[1])}</li>`);
    } else if (olMatch) {
      if (inUl) { parts.push('</ul>'); inUl = false; }
      if (!inOl) { parts.push('<ol>'); inOl = true; }
      parts.push(`<li>${inline(olMatch[1])}</li>`);
    } else {
      if (inUl) { parts.push('</ul>'); inUl = false; }
      if (inOl) { parts.push('</ol>'); inOl = false; }
      parts.push(t ? `<p>${inline(t)}</p>` : '<br>');
    }
  }
  if (inUl) parts.push('</ul>');
  if (inOl) parts.push('</ol>');

  let html = parts.join('');
  if (disclaimer) html += `<p class="msg-disclaimer">${esc(disclaimer)}</p>`;
  return html;
}

/* ─── Inyectar estilos una sola vez ──────────────────────────────────────── */
(function injectChatStyles() {
  if (document.getElementById('chat-ui-styles')) return;
  const style = document.createElement('style');
  style.id = 'chat-ui-styles';
  style.textContent = `
    .typing-indicator{display:flex;align-items:center;gap:5px;padding:12px 16px!important}
    .typing-indicator span{width:8px;height:8px;border-radius:50%;background:var(--color-primary,#234c58);opacity:.35;animation:chat-bounce 1.2s infinite}
    .typing-indicator span:nth-child(2){animation-delay:.2s}
    .typing-indicator span:nth-child(3){animation-delay:.4s}
    @keyframes chat-bounce{0%,60%,100%{transform:translateY(0);opacity:.35}30%{transform:translateY(-6px);opacity:.9}}
    .msg-disclaimer{font-size:.73rem!important;color:#5a7a84!important;margin-top:8px!important;padding-top:8px!important;border-top:1px solid rgba(35,76,88,.12)!important;font-style:italic;line-height:1.5}
    .msg.bot ul,.msg.bot ol{margin:4px 0 4px 18px;padding:0}
    .msg.bot li{margin-bottom:3px;line-height:1.5}
    .msg.bot p{margin:0 0 5px}.msg.bot p:last-child{margin-bottom:0}
    .msg.bot br{display:block;margin:2px 0;content:""}
    .chat-counter{font-size:.71rem;color:#9ab0b8;text-align:right;padding:2px 2px 0;grid-column:1/-1}
    .chat-counter.warn{color:#d97706}.chat-counter.limit{color:#c0392b}
    .chat-clear{font-size:.73rem;color:var(--color-primary,#234c58);background:rgba(35,76,88,.07);border:1px solid rgba(35,76,88,.18);border-radius:20px;padding:4px 11px;cursor:pointer;font-weight:600;transition:background .15s;white-space:nowrap}
    .chat-clear:hover{background:rgba(35,76,88,.14)}
  `;
  document.head.appendChild(style);
})();

/* ─── Setup por instancia ─────────────────────────────────────────────────── */
function setupChat(prefix) {
  const body  = document.getElementById(`chatBody${prefix}`);
  const input = document.getElementById(`chatInput${prefix}`);
  const send  = document.getElementById(`chatSend${prefix}`);
  if (!body || !input || !send) return;

  /* Historial de conversación (últimos 8 mensajes = 4 turnos) */
  const history  = [];
  const MAX_HIST = 8;

  /* Botón "Nueva consulta" en el chat-head */
  const container = body.closest('.chatbox, .panel');
  const head = container?.querySelector('.chat-head');
  if (head) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'chat-clear';
    clearBtn.type      = 'button';
    clearBtn.textContent = 'Nueva consulta';
    clearBtn.addEventListener('click', () => {
      history.length = 0;
      /* Conservar el primer mensaje del bot y los suggest, quitar el resto */
      Array.from(body.children).slice(2).forEach(el => el.remove());
    });
    head.appendChild(clearBtn);
  }

  /* Contador de caracteres */
  const chatInput = input.closest('.chat-input');
  let counter = null;
  if (chatInput) {
    counter = document.createElement('span');
    counter.className = 'chat-counter';
    counter.textContent = '0 / 1000';
    chatInput.appendChild(counter);
    input.addEventListener('input', () => {
      const len = input.value.length;
      counter.textContent = `${len} / 1000`;
      counter.className = 'chat-counter' + (len > 950 ? ' limit' : len > 800 ? ' warn' : '');
    });
  }

  /* Agregar mensaje al chat */
  const addMsg = (html, cls, isHtml = false) => {
    const div = document.createElement('div');
    div.className = `msg ${cls}`;
    if (isHtml) div.innerHTML = html;
    else        div.textContent = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  };

  /* Indicador de escritura animado */
  const addTyping = () => {
    const div = document.createElement('div');
    div.className = 'msg bot typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  };

  /* Enviar mensaje */
  const sendUser = async () => {
    const q = input.value.trim();
    if (!q || send.disabled) return;

    addMsg(q, 'user');
    history.push({ role: 'user', content: q });
    input.value = '';
    if (counter) { counter.textContent = '0 / 1000'; counter.className = 'chat-counter'; }
    send.disabled = true;

    const typing = addTyping();

    try {
      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          mensaje:   q,
          historial: history.slice(-(MAX_HIST + 1), -1)
        })
      });
      const data      = await res.json();
      const respuesta = data.respuesta || 'No se pudo obtener respuesta.';
      typing.remove();
      addMsg(renderChatMarkdown(respuesta), 'bot', true);
      history.push({ role: 'assistant', content: respuesta });
      while (history.length > MAX_HIST) history.shift();
    } catch (_) {
      typing.remove();
      addMsg('Error de conexión. Por favor intenta de nuevo.', 'bot');
    } finally {
      send.disabled = false;
      body.scrollTop = body.scrollHeight;
    }
  };

  send.addEventListener('click', sendUser);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendUser(); });

  body.addEventListener('click', e => {
    const btn = e.target.closest('.suggest');
    if (!btn) return;
    input.value = btn.textContent.trim();
    sendUser();
  });
}

setupChat('A');
setupChat('B');
setupChat('C');
