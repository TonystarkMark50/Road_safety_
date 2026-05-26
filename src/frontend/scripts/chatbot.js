document.addEventListener('DOMContentLoaded', () => {
  initChatbot();
});

function initChatbot() {
  if (document.getElementById('chatbot-widget')) return;
  let conversationId = null;
  let isStreaming = false;
  let currentAbortController = null;

  const container = document.createElement('div');
  container.id = 'chatbot-widget';
  document.body.appendChild(container);

  const fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.id = 'chatbot-toggle';
  fab.setAttribute('aria-label', 'Open chat');
  const avatarSrc = window.location.pathname.includes('/pages/')
    ? '../images/chatbot-avatar.png'
    : 'images/chatbot-avatar.png';
  fab.innerHTML = `<img src="${avatarSrc}" alt="Chat" style="width:28px;height:28px;object-fit:contain" />`;
  container.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'chat-panel';
  panel.id = 'chatbot-panel';
  panel.innerHTML = `
    <div class="chat-head">
      <div class="chat-head-left">
        <div class="chat-avatar" style="position:relative">
          <img src="${avatarSrc}" alt="AI" style="width:100%;height:100%;object-fit:contain;border-radius:8px" />
          <div style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:var(--green);border:2px solid var(--blk-surface);animation:ping 2s infinite"></div>
        </div>
        <div>
          <div class="chat-name">AccelerateZero AI</div>
          <div class="chat-status" style="display:flex;align-items:center;gap:6px">
            <div class="signal-vis" style="height:10px"><div class="signal-bar" style="height:40%;width:2px"></div><div class="signal-bar" style="height:60%;width:2px"></div><div class="signal-bar" style="height:80%;width:2px"></div><div class="signal-bar" style="height:100%;width:2px"></div></div>
            Online
          </div>
        </div>
      </div>
      <div style="display:flex;gap:4px">
        <button id="chatbot-clear" class="chat-close" aria-label="Clear chat">
          <i class="fas fa-trash-alt" style="font-size:0.75rem"></i>
        </button>
        <button id="chatbot-close" class="chat-close" aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
    <div id="chatbot-messages" class="chat-msgs"></div>
    <div class="chat-inp-wrap">
      <div class="chat-inp">
        <input type="text" id="chatbot-input" placeholder="Type your message..." autocomplete="off" />
        <button type="submit" id="chatbot-send" class="chat-send" aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
  container.appendChild(panel);

  const toggle = document.getElementById('chatbot-toggle');
  const panelEl = document.getElementById('chatbot-panel');
  const closeBtn = document.getElementById('chatbot-close');
  const clearBtn = document.getElementById('chatbot-clear');
  const messagesEl = document.getElementById('chatbot-messages');
  const sendBtn = document.getElementById('chatbot-send');
  const input = document.getElementById('chatbot-input');

   const styleEl = document.createElement('style');
   styleEl.textContent = `
     .chat-msg { animation: popIn 0.2s ease-out; }
      .chat-msg.bot .msg-quick-actions { display:flex; gap:6px; margin-top:8px; flex-wrap:wrap }
      .chat-msg.bot .msg-quick-action { padding:8px 14px; border-radius:8px; font-size:.75rem; font-weight:500; background:rgba(0,102,255,.08); color:var(--accent); border:1px solid rgba(0,102,255,.12); cursor:pointer; transition:all .15s ease; font-family:inherit; min-height:36px; touch-action:manipulation }
      .chat-msg.bot .msg-quick-action:hover { background:rgba(0,102,255,.15); border-color:rgba(0,102,255,.25) }
      .chat-msg.bot .msg-quick-action i { margin-right:4px; font-size:.625rem }
      @media(max-width:480px){
        .chat-msg.bot .msg-quick-action { padding:10px 16px; font-size:.8125rem; min-height:44px }
      }
     .chat-close {
       width: 36px;
       height: 36px;
       border-radius: 10px;
       display: flex;
       align-items: center;
       justify-content: center;
       background: var(--blk-elevated);
       border: 1px solid var(--bd);
       color: var(--text-dim);
       font-size: 0.875rem;
       cursor: pointer;
       transition: all 0.2s var(--ease);
       margin: 0;
       padding: 0;
     }
     .chat-close:hover {
       background: var(--blk-hover);
       border-color: var(--bd-hover);
       color: var(--text);
       transform: scale(1.05);
     }
     .chat-close:active {
       transform: scale(0.95);
     }

    .chat-inp-wrap {
      padding: 8px 16px 14px;
      background: var(--blk);
    }
    .chat-inp {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--blk-elevated);
      border: 1px solid var(--bd);
      border-radius: 16px;
      padding: 6px 6px 6px 18px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .chat-inp:focus-within {
      border-color: var(--accent-glow);
      box-shadow: 0 0 0 2px rgba(0,102,255,0.15);
    }
    .chat-inp input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 0.875rem;
      outline: none;
      padding: 6px 0;
    }
    .chat-inp input::placeholder { color: var(--text-faint); }
    .chat-send {
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: linear-gradient(135deg,#0066ff,#0052cc);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      border: none;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .chat-send:hover { transform: scale(1.05); box-shadow: 0 2px 12px rgba(0,102,255,0.4); }
    .chat-send:active { transform: scale(0.95); }
    .chat-send:disabled { opacity: 0.4; transform: none; box-shadow: none; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.92) translateY(4px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .anim-pop { animation: popIn 0.2s ease-out; }

    .streaming-cursor::after {
      content: '...';
      display: inline-block;
      margin-left: 2px;
      vertical-align: bottom;
      font-size: 0.875rem;
      letter-spacing: 1px;
      color: var(--accent);
      animation: dotPulse 1s ease-in-out infinite;
    }
    @keyframes dotPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

  `;
  document.head.appendChild(styleEl);

  toggle.addEventListener('click', () => {
    panelEl.classList.add('open');
    toggle.style.display = 'none';
    if (messagesEl.children.length === 0) {
      showWelcome();
    }
    setTimeout(() => input.focus(), 300);
  });

  closeBtn.addEventListener('click', () => {
    panelEl.classList.remove('open');
    toggle.style.display = 'flex';
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    if (document.activeElement === input) input.blur();
  });

  clearBtn.addEventListener('click', () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    messagesEl.innerHTML = '';
    conversationId = null;
    showWelcome();
  });

  function handleSend() {
    const text = input.value.trim();
    if (!text || isStreaming) return;
    input.value = '';
    addUserMessage(text);
    fetchAIResponse(text);
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  input.addEventListener('focus', () => {
    setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 300);
  });

  let lastHeight = window.innerHeight;
  window.addEventListener('resize', () => {
    const h = window.innerHeight;
    if (panelEl.classList.contains('open') && lastHeight > h) {
      setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 100);
    }
    lastHeight = h;
  });

  function showWelcome() {
    showTyping();
    messagesEl.scrollTop = messagesEl.scrollHeight;

    setTimeout(() => {
      hideTyping();

      const botDiv = document.createElement('div');
      botDiv.className = 'chat-msg bot';
      const contentDiv = document.createElement('div');
      botDiv.appendChild(contentDiv);
      messagesEl.appendChild(botDiv);

      const greeting = "Hi there! I'm AccelerateZero AI, your road safety assistant. How can I help you today?";
      // Add quick action chips after greeting
      const quickActions = document.createElement('div');
      quickActions.className = 'msg-quick-actions';
      quickActions.innerHTML = `
        <button class="msg-quick-action" data-action="report"><i class="fas fa-plus-circle"></i> Report Hazard</button>
        <button class="msg-quick-action" data-action="track"><i class="fas fa-search"></i> Track Issue</button>
        <button class="msg-quick-action" data-action="stats"><i class="fas fa-chart-bar"></i> Safety Stats</button>
        <button class="msg-quick-action" data-action="emergency"><i class="fas fa-phone"></i> Emergency</button>
      `;
      quickActions.querySelectorAll('.msg-quick-action').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'report') window.location.href = '/pages/report.html';
          else if (action === 'track') window.location.href = '/pages/track.html';
          else if (action === 'stats') window.location.href = '/pages/dashboard.html';
          else if (action === 'emergency') {
            if (window.AccelZeroEmergency) {
              window.AccelZeroEmergency.triggerEmergency('chatbot_trigger');
            } else {
              window.location.href = '/pages/emergency.html?mode=sos&source=chatbot';
            }
          }
        });
      });

      let idx = 0;

      function streamChar() {
        if (idx < greeting.length) {
          const visible = greeting.slice(0, idx + 1);
          const lastChar = visible.charAt(visible.length - 1);
          contentDiv.textContent = visible;
          idx++;
          messagesEl.scrollTop = messagesEl.scrollHeight;
          const pause = (lastChar === '.' || lastChar === '!' || lastChar === '?') ? 30 : 8;
          setTimeout(streamChar, pause);
        } else {
          contentDiv.textContent = greeting;
          botDiv.appendChild(quickActions);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      }

      streamChar();
    }, 600);
  }

  function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    let indicator = document.getElementById('chatbot-typing');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'chatbot-typing';
      indicator.className = 'chat-msg bot';
      indicator.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(indicator);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const indicator = document.getElementById('chatbot-typing');
    if (indicator) indicator.remove();
  }

  function getContext() {
    const path = window.location.pathname;
    const ctx = { page: 'home' };
    if (path.includes('dashboard')) ctx.page = 'dashboard';
    else if (path.includes('report')) ctx.page = 'report';
    else if (path.includes('track')) ctx.page = 'track';
    else if (path.includes('map')) ctx.page = 'map';
    return ctx;
  }

  function syncMobileSheet() {
    if (window.innerWidth <= 480) {
      container.classList.add('chat-mobile-sheet');
    } else {
      container.classList.remove('chat-mobile-sheet');
    }
  }
  syncMobileSheet();
  window.addEventListener('resize', syncMobileSheet);

  async function fetchAIResponse(text) {
    if (isStreaming) return;
    const chatToken = await getAccessToken();
    if (!chatToken) {
      addBotMessage('Please sign in to use the AI operations assistant.');
      return;
    }
    isStreaming = true;
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="font-size:0.875rem;color:#fff"></i>';
    showTyping();

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    try {
      if (!conversationId && chatToken) {
        const conv = await createChatConversation();
        conversationId = conv.id;
      }

      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(chatToken ? { 'Authorization': `Bearer ${chatToken}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          context: getContext(),
        }),
        signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      hideTyping();
      const botDiv = document.createElement('div');
      botDiv.className = 'chat-msg bot';
      const contentDiv = document.createElement('div');
      contentDiv.className = 'streaming-cursor chat-stream-cursor';
      botDiv.appendChild(contentDiv);
      messagesEl.appendChild(botDiv);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let displayedLen = 0;
      let charTimer = null;

      function tickChar() {
        if (charTimer) clearTimeout(charTimer);
        const clean = sanitizeAI(fullText);
        if (displayedLen < clean.length) {
          displayedLen += 1;
          contentDiv.textContent = clean.slice(0, displayedLen);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          if (displayedLen < clean.length) {
            charTimer = setTimeout(tickChar, 6);
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'token') {
              fullText += data.content;
              if (!charTimer) tickChar();

            } else if (data.type === 'done') {
              if (charTimer) clearTimeout(charTimer);
              const final = sanitizeAI(fullText);
              contentDiv.textContent = final;
              displayedLen = final.length;
              contentDiv.classList.remove('streaming-cursor');
            } else if (data.type === 'error') {
              contentDiv.classList.remove('streaming-cursor');
              contentDiv.textContent = data.message || "I'm having trouble processing that. Please try again.";
            }
          } catch (e) {}
        }
      }

      if (fullText) {
        if (charTimer) clearTimeout(charTimer);
        const final = sanitizeAI(fullText);
        contentDiv.textContent = final;
        displayedLen = final.length;
        contentDiv.classList.remove('streaming-cursor');
        await saveToConversation(text, fullText);
      }

    } catch (err) {
      hideTyping();
      if (err.name === 'AbortError') return;
      addBotMessage("I'm having trouble connecting right now. Please try again in a moment.");
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      currentAbortController = null;
    }
  }

  async function saveToConversation(userText, aiText) {
    if (!conversationId || !getAccessTokenSync()) return;
    try {
      await apiFetch(`/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content: userText },
      });
    } catch (e) {}
  }

  // ─── Emergency Intent Detection ───
  const emergencyKeywords = [
    'accident', 'emergency', 'crash', 'collision', 'sos', 'help',
    'injured', 'ambulance', 'hospital', 'urgent', 'danger',
    'fire', 'flood', 'collapse', 'hit', 'bumped', 'hurt',
    'bleeding', 'unconscious', 'heart attack', 'stroke',
    '911', '108', '112', 'rescue', 'trapped'
  ];

  function detectEmergencyIntent(text) {
    const lower = text.toLowerCase();
    return emergencyKeywords.some(k => lower.includes(k));
  }

  function showEmergencySupport() {
    const botDiv = document.createElement('div');
    botDiv.className = 'chat-msg bot';
    botDiv.style.border = '1px solid rgba(255,45,85,.2)';
    botDiv.style.background = 'linear-gradient(135deg,rgba(255,45,85,.06),rgba(255,45,85,.02))';
    const contentDiv = document.createElement('div');
    contentDiv.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--red);animation:ping 2s infinite"></div>
        <strong style="color:var(--red);font-size:.8125rem">Emergency Support Mode</strong>
      </div>
      <p style="font-size:.75rem;color:var(--text-dim);line-height:1.5;margin-bottom:10px">
        I understand you need urgent help. Please stay calm. Would you like me to activate the SOS system or call emergency services?
      </p>
      <div class="msg-quick-actions" style="margin-top:6px">
        <button class="msg-quick-action" style="background:rgba(255,45,85,.12);color:var(--red);border-color:rgba(255,45,85,.2)" onclick="handleEmergencySOS()">
          <i class="fas fa-exclamation-triangle"></i> Activate SOS
        </button>
        <button class="msg-quick-action" onclick="window.location.href='/pages/emergency.html'">
          <i class="fas fa-hospital"></i> Find Hospitals
        </button>
        <button class="msg-quick-action" onclick="window.open('tel:112')">
          <i class="fas fa-phone"></i> Call 112
        </button>
      </div>
    `;
    botDiv.appendChild(contentDiv);
    messagesEl.appendChild(botDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Override addBotMessage to detect emergency intent
  const origAddBotMessage = addBotMessage;
  addBotMessage = function(text) {
    origAddBotMessage(text);
  };

  // Override fetchAIResponse for emergency detection
  const origFetchAIResponse = fetchAIResponse;
  fetchAIResponse = async function(text) {
    if (isStreaming) return;
    if (detectEmergencyIntent(text)) {
      isStreaming = true;
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin" style="font-size:0.875rem;color:#fff"></i>';
      hideTyping();

      setTimeout(() => {
        isStreaming = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
        showEmergencySupport();
      }, 800);
      return;
    }
    await origFetchAIResponse(text);
  };

  window.handleEmergencySOS = function() {
    if (window.AccelZeroEmergency) {
      window.AccelZeroEmergency.triggerEmergency('chatbot_emergency');
    } else {
      window.location.href = '/pages/emergency.html?mode=sos&source=chatbot';
    }
  };
}

function sanitizeAI(text) {
  if (!text || !text.trim()) return text;

  const metaPattern = /(we need to|we should|we must|we can|the assistant should|the response should|the answer should|the system will|the model will|i need to|i should|i must|i will now|my response must|my answer should|output only|output just|respond with only|say only|reply with only|keep it to|make sure to|ensure (the|that|we)|ask one (question|thing)|this is a (greeting|response|follow.up)|that's (a|an|the) (greeting|question|warm|friendly|response|answer)|it'?s (a|an|the|one) (question|thing|answer|response)|so (we|the|i|my) (need|should|must|can|will|respond|say|output)|check(ing)? (rules|output|instruction|format)|reasoning[.:]|thinking[.:]|analysis[.:]|chain\s*of\s*thought|internal\s*(note|instruction|thought|prompt)|system\s*prompt|hidden\s*prompt|developer\s*(note|instruction)|scratchpad|planning:|self\.reminder|safety\s+note:|tone\s+check:|meta[.:]|meta\.commentary|follow\s*ing\s*(rule|instruction|format)|probably\s+(ask|say|respond|okay)|so\s+final\s+answer|the\s+final\s+answer|\*\s*mental\s*note\s*\*|\*\s*checks\s*\*|\*\s*remembers\s*\*|just\s+practical|single\s*threaded|avoid\s*ing\s+confusion|no\s+(extra|bullet|markdown|formatting)|they\.re\s+(likely|probably|trying)|^thus\s*:|important\s*:\s*must\s+not|must\s+not\s+repeat|solution\.ori|^good[.!]*$|^perfect[.!]*$|^exactly[.!]*$|^okay[.!]*$|^hmm[.!]*$|^wait[.!]*$|^phew[.!]*$|^nope[.!]*$|^aha[.!]*$)/i;

  const lines = text.split('\n');
  const filtered = lines.filter(line => {
    const s = line.trim();
    if (!s) return true;
    if (s.startsWith('```') || s.startsWith('**')) return false;
    if (metaPattern.test(s)) return false;
    return true;
  }).join('\n').trim();

  if (!filtered) {
    const finalLines = text.split('\n').filter(l => l.trim());
    return finalLines.length > 0 ? finalLines[finalLines.length - 1].trim() : "I'm sorry, I couldn't process that properly. Please try again.";
  }

  return filtered;
}
