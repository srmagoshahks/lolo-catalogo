/**
 * LOLO SOBRE RUEDAS â€” Chat Widget v5.0 (Con Panel Secreto de Admin + Voz Clonada + MicrÃ³fono STT)
 */

const LOLo_CONFIG = {
  API_BASE: 'https://lolo-chat-api.vercel.app',
  LOGO_URL: 'images/icono_lolo_chat.png',
  BUSINESS_NAME: 'LOLO Sobre Ruedas',
  BUSINESS_INFO: {
    direccion: 'Leopoldo Herrera 1693',
    telefono: '3455-541097',
    whatsapp: '5493455541097',
    email: 'lolosobreruedas@gmail.com',
    horario: '9:00 a 12:00 / 16:00 a 19:30'
  },
  SUGERENCIAS: [
    'ðŸ“¦ Â¿QuÃ© tienen nuevo?',
    'ðŸ” Buscar un producto',
    'ðŸ’° Â¿CuÃ¡nto sale...?',
    'ðŸ“ž Datos de contacto'
  ],
  MENSAJE_BIENVENIDA: 'Â¡Hola! ðŸ›¹ Bienvenido a LOLO Sobre Ruedas. Estoy acÃ¡ para ayudarte a encontrar el regalo o producto ideal. PodÃ©s escribir o tocar el micrÃ³fono ðŸŽ™ï¸ y hablarme directo. Â¿QuÃ© estÃ¡s buscando hoy?'
};

(function() {
  'use strict';

  let chatOpen = false;
  let messages = [];
  let isLoading = false;
  let unreadCount = 0;
  let widgetContainer = null;
  let chatWindow = null;
  let messagesArea = null;
  let inputField = null;
  let sendBtn = null;
  let micBtn = null;
  let typingIndicator = null;
  let statusDot = null;
  let badge = null;
  let suggestionsArea = null;
  let voiceBtn = null;

  // Reconocimiento de voz (MicrÃ³fono)
  let recognition = null;
  let isListening = false;

  // Estado de audio
  let voiceEnabled = true;
  let currentAudio = null;
  let hasPlayedWelcome = false;

  // Estado global del Admin (Control Maestro)
  let adminConfig = { agente_activo: true, voz_activa: true };
  let adminModal = null;
  let adminSession = null; // Guarda credenciales temporales si se logueÃ³

  // Obtener estado del servidor
  async function fetchAdminStatus() {
    try {
      const res = await fetch(`${LOLo_CONFIG.API_BASE}/api/admin/status`);
      if (res.ok) {
        adminConfig = await res.json();
        applyAdminState();
      }
    } catch(e) {}
  }

  function applyAdminState() {
    if (!widgetContainer) return;
    if (adminConfig.agente_activo === false) {
      widgetContainer.style.display = 'none';
      if (chatOpen) toggleChat();
    } else {
      widgetContainer.style.display = 'block';
    }

    if (adminConfig.voz_activa === false) {
      voiceEnabled = false;
      if (voiceBtn) {
        voiceBtn.textContent = 'ðŸ”‡';
        voiceBtn.title = 'Voz desactivada por el administrador';
        voiceBtn.style.opacity = '0.5';
        voiceBtn.disabled = true;
      }
    } else {
      if (voiceBtn) {
        voiceBtn.disabled = false;
        voiceBtn.style.opacity = '1';
        voiceBtn.textContent = voiceEnabled ? 'ðŸ”Š' : 'ðŸ”‡';
      }
    }
  }

  // Reproducir audio
  function playNeuralAudio(base64Audio, fallbackText) {
    if (!voiceEnabled || adminConfig.voz_activa === false) return;

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (base64Audio) {
      try {
        currentAudio = new Audio('data:audio/mp3;base64,' + base64Audio);
        currentAudio.play().catch(e => {
          console.log('Error reproduciendo audio, usando fallback:', e);
          speakFallback(fallbackText);
        });
        return;
      } catch(e) {}
    }

    speakFallback(fallbackText);
  }

  function speakFallback(text) {
    if (!voiceEnabled || adminConfig.voz_activa === false || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      let clean = text
        .replace(/ID:\s*\d+/gi, '')
        .replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\$([\d\.]+)/g, '$1 pesos')
        .replace(/[*_#`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'es-AR';
      utterance.pitch = 1.0;
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    } catch(e) {}
  }

  // Configurar reconocimiento de voz (MicrÃ³fono)
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function() {
      isListening = true;
      if (micBtn) {
        micBtn.classList.add('recording');
        micBtn.title = 'Escuchando... HablÃ¡ ahora';
      }
      inputField.placeholder = 'ðŸŽ™ï¸ Escuchando... HablÃ¡ ahora';
    };

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        inputField.value = transcript;
        sendBtn.disabled = false;
        setTimeout(() => sendMessage(), 400);
      }
    };

    recognition.onerror = function(event) {
      console.log('Error reconocimiento voz:', event.error);
      stopListening();
    };

    recognition.onend = function() {
      stopListening();
    };
  }

  function toggleListening() {
    if (!recognition) {
      alert('Tu navegador no soporta dictado por voz. PodÃ©s escribir tu mensaje normalmente.');
      return;
    }
    if (isListening) {
      recognition.stop();
      stopListening();
    } else {
      try {
        if (currentAudio) currentAudio.pause();
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        recognition.start();
      } catch(e) {
        console.log('Error start recognition:', e);
      }
    }
  }

  function stopListening() {
    isListening = false;
    if (micBtn) {
      micBtn.classList.remove('recording');
      micBtn.title = 'Hablar por micrÃ³fono';
    }
    inputField.placeholder = 'EscribÃ­ tu consulta...';
  }

  // --- INIT ---
  function init() {
    if (document.getElementById('lolo-chat-widget')) return;
    initSpeechRecognition();
    createWidget();
    initSecretAdminTrigger();
    loadSession();
    fetchAdminStatus();

    if (messages.length === 0) {
      addBotMessage(LOLo_CONFIG.MENSAJE_BIENVENIDA, null, false);
    } else {
      renderAllMessages();
    }
    showSuggestions();
  }

  // --- TRIGGER SECRETO DE ADMIN (3 CLICS EN EL LOGO DE LA PÃGINA) ---
  function initSecretAdminTrigger() {
    let clickCount = 0;
    let clickTimer = null;

    function handleLogoClick(e) {
      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => { clickCount = 0; }, 1500);
      } else if (clickCount >= 3) {
        clearTimeout(clickTimer);
        clickCount = 0;
        e.preventDefault();
        e.stopPropagation();
        openAdminModal();
      }
    }

    // Escuchar clics y toques en cualquier elemento del logo (video, imagen, contenedor, titulo)
    const logoSelectors = [
      '.brand-logo-wrap',
      '.brand-logo-wrap video',
      '.brand-logo-wrap img',
      '.brand',
      '.brand h1',
      '.lolo-chat-header .header-logo',
      '.lolo-chat-header .header-name'
    ];

    logoSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.addEventListener('click', handleLogoClick);
        el.addEventListener('touchend', handleLogoClick);
        el.style.cursor = 'pointer';
      });
    });

    // DelegaciÃ³n global por si se genera dinÃ¡micamente
    document.addEventListener('click', function(e) {
      if (e.target.closest('.brand-logo-wrap, .brand, .lolo-chat-header .header-logo')) {
        handleLogoClick(e);
      }
    });
  }

  // --- MODAL DE ADMINISTRADOR ---
  function openAdminModal() {
    if (adminModal) {
      adminModal.remove();
    }

    adminModal = document.createElement('div');
    adminModal.id = 'lolo-admin-modal';
    adminModal.className = 'lolo-admin-overlay';

    if (!adminSession) {
      // Pantalla de Login
      adminModal.innerHTML = `
        <div class="lolo-admin-box">
          <button class="lolo-admin-close">&times;</button>
          <div class="lolo-admin-title">ðŸ”’ Panel de Control LOLO</div>
          <div class="lolo-admin-subtitle">Acceso exclusivo Administrador</div>
          <div class="lolo-admin-form">
            <div class="lolo-admin-group">
              <label>Usuario</label>
              <input type="text" id="admUser" placeholder="admin" autocomplete="off">
            </div>
            <div class="lolo-admin-group">
              <label>ContraseÃ±a</label>
              <input type="password" id="admPass" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢">
            </div>
            <div id="admError" class="lolo-admin-error" style="display:none">Credenciales invÃ¡lidas</div>
            <button id="admLoginBtn" class="lolo-admin-btn">Ingresar</button>
          </div>
        </div>
      `;
    } else {
      // Pantalla de Controles (ON/OFF)
      renderAdminControls();
      return;
    }

    document.body.appendChild(adminModal);

    const closeBtn = adminModal.querySelector('.lolo-admin-close');
    closeBtn.onclick = () => adminModal.remove();

    const loginBtn = adminModal.querySelector('#admLoginBtn');
    const userInp = adminModal.querySelector('#admUser');
    const passInp = adminModal.querySelector('#admPass');
    const errDiv = adminModal.querySelector('#admError');

    loginBtn.onclick = async function() {
      const u = userInp.value.trim();
      const p = passInp.value.trim();
      if (!u || !p) return;

      try {
        loginBtn.textContent = 'Verificando...';
        loginBtn.disabled = true;
        const res = await fetch(`${LOLo_CONFIG.API_BASE}/api/admin/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (data.success) {
          adminSession = { username: u, password: p };
          adminConfig = data.status;
          applyAdminState();
          renderAdminControls();
        } else {
          errDiv.style.display = 'block';
          errDiv.textContent = data.error || 'Credenciales invÃ¡lidas';
          loginBtn.textContent = 'Ingresar';
          loginBtn.disabled = false;
        }
      } catch(e) {
        errDiv.style.display = 'block';
        errDiv.textContent = 'Error de conexiÃ³n con el servidor';
        loginBtn.textContent = 'Ingresar';
        loginBtn.disabled = false;
      }
    };

    userInp.focus();
    userInp.onkeydown = (e) => { if(e.key === 'Enter') passInp.focus(); };
    passInp.onkeydown = (e) => { if(e.key === 'Enter') loginBtn.click(); };
  }

  function renderAdminControls() {
    if (!adminModal) return;
    adminModal.innerHTML = `
      <div class="lolo-admin-box">
        <button class="lolo-admin-close">&times;</button>
        <div class="lolo-admin-title">âš™ï¸ Control Maestro de LOLO</div>
        <div class="lolo-admin-subtitle">ConfiguraciÃ³n global del catÃ¡logo</div>

        <div class="lolo-admin-switches">
          <div class="lolo-switch-row">
            <div>
              <div class="lolo-switch-name">ðŸ¤– Asistente Virtual LOLO</div>
              <div class="lolo-switch-desc">Mostrar u ocultar el botÃ³n flotante y el chat</div>
            </div>
            <label class="lolo-toggle">
              <input type="checkbox" id="toggleAgente" ${adminConfig.agente_activo ? 'checked' : ''}>
              <span class="lolo-slider"></span>
            </label>
          </div>

          <div class="lolo-switch-row">
            <div>
              <div class="lolo-switch-name">ðŸŽ™ï¸ Voz con IA (Voz Clonada)</div>
              <div class="lolo-switch-desc">Activar o desactivar sÃ­ntesis de voz en respuestas</div>
            </div>
            <label class="lolo-toggle">
              <input type="checkbox" id="toggleVoz" ${adminConfig.voz_activa ? 'checked' : ''}>
              <span class="lolo-slider"></span>
            </label>
          </div>
        </div>

        <div id="admSavedMsg" class="lolo-admin-saved" style="display:none">âœ… Cambios guardados correctamente</div>
        
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="admSaveBtn" class="lolo-admin-btn" style="flex:1">Guardar Cambios</button>
          <button id="admLogoutBtn" class="lolo-admin-btn-secondary" style="width:auto">Cerrar SesiÃ³n</button>
        </div>
      </div>
    `;

    const closeBtn = adminModal.querySelector('.lolo-admin-close');
    closeBtn.onclick = () => adminModal.remove();

    const toggleAg = adminModal.querySelector('#toggleAgente');
    const toggleVz = adminModal.querySelector('#toggleVoz');
    const saveBtn = adminModal.querySelector('#admSaveBtn');
    const logoutBtn = adminModal.querySelector('#admLogoutBtn');
    const savedMsg = adminModal.querySelector('#admSavedMsg');

    saveBtn.onclick = async function() {
      const nuevoAgente = toggleAg.checked;
      const nuevaVoz = toggleVz.checked;

      try {
        saveBtn.textContent = 'Guardando...';
        saveBtn.disabled = true;

        const res = await fetch(`${LOLo_CONFIG.API_BASE}/api/admin/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: adminSession.username,
            password: adminSession.password,
            agente_activo: nuevoAgente,
            voz_activa: nuevaVoz
          })
        });
        const data = await res.json();
        if (data.success) {
          adminConfig = data.status;
          applyAdminState();
          savedMsg.style.display = 'block';
          saveBtn.textContent = 'Guardar Cambios';
          saveBtn.disabled = false;
          setTimeout(() => { savedMsg.style.display = 'none'; }, 3000);
        }
      } catch(e) {
        alert('Error al guardar configuraciÃ³n');
        saveBtn.textContent = 'Guardar Cambios';
        saveBtn.disabled = false;
      }
    };

    logoutBtn.onclick = function() {
      adminSession = null;
      adminModal.remove();
    };
  }

  // --- CREAR WIDGET ---
  function createWidget() {
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'lolo-chat-widget';

    chatWindow = document.createElement('div');
    chatWindow.className = 'lolo-chat-window';
    chatWindow.innerHTML = buildChatHTML();

    const btn = document.createElement('button');
    btn.className = 'lolo-chat-btn';
    btn.setAttribute('aria-label', 'Abrir chat con Lolo');
    btn.onclick = toggleChat;
    
    const logoImg = new Image();
    logoImg.src = LOLo_CONFIG.LOGO_URL;
    logoImg.alt = 'Lolo';
    logoImg.onerror = function() {
      btn.innerHTML = '<span class="lolo-icon-fallback">ðŸ›¹</span>';
    };
    logoImg.onload = function() {
      btn.innerHTML = '';
      btn.appendChild(logoImg);
    };
    btn.appendChild(logoImg);

    // Globo flotante de invitaciÃ³n
    const voiceBubble = document.createElement('div');
    voiceBubble.className = 'lolo-voice-invite';
    voiceBubble.innerHTML = '<span>ðŸŽ™ï¸ Â¡Hablame o escribime!</span>';
    voiceBubble.onclick = toggleChat;
    widgetContainer.appendChild(voiceBubble);

    badge = document.createElement('span');
    badge.className = 'lolo-chat-badge';
    badge.textContent = '1';
    widgetContainer.appendChild(badge);

    widgetContainer.appendChild(chatWindow);
    widgetContainer.appendChild(btn);

    document.body.appendChild(widgetContainer);

    // Referencias
    messagesArea = chatWindow.querySelector('.lolo-chat-messages');
    inputField = chatWindow.querySelector('.lolo-chat-input');
    sendBtn = chatWindow.querySelector('.lolo-chat-send');
    micBtn = chatWindow.querySelector('.lolo-chat-mic');
    typingIndicator = chatWindow.querySelector('.lolo-typing');
    statusDot = chatWindow.querySelector('.header-status .dot');
    suggestionsArea = chatWindow.querySelector('.lolo-suggestions');
    voiceBtn = chatWindow.querySelector('.header-voice-btn');

    if (voiceBtn) {
      voiceBtn.onclick = function() {
        if (adminConfig.voz_activa === false) return;
        voiceEnabled = !voiceEnabled;
        voiceBtn.textContent = voiceEnabled ? 'ðŸ”Š' : 'ðŸ”‡';
        voiceBtn.title = voiceEnabled ? 'Voz activada (clic para silenciar)' : 'Voz silenciada (clic para activar)';
        if (!voiceEnabled) {
          if (currentAudio) currentAudio.pause();
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }
      };
    }

    if (micBtn) {
      micBtn.onclick = toggleListening;
    }

    const closeBtn = chatWindow.querySelector('.header-close');
    if (closeBtn) closeBtn.onclick = toggleChat;

    inputField.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener('click', sendMessage);
    inputField.addEventListener('input', function() {
      sendBtn.disabled = !this.value.trim();
    });
    sendBtn.disabled = true;
  }

  // --- HTML DEL CHAT ---
  function buildChatHTML() {
    const headerLogo = `<img class="header-logo" src="${LOLo_CONFIG.LOGO_URL}" alt="Lolo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="header-logo-fallback" style="display:none">ðŸ›¹</div>`;

    return `
      <div class="lolo-chat-header">
        ${headerLogo}
        <div class="header-info">
          <div class="header-name">${LOLo_CONFIG.BUSINESS_NAME}</div>
          <div class="header-status">
            <span class="dot"></span>
            <span class="status-text">Voz Humana Clonada ðŸŽ™ï¸</span>
          </div>
        </div>
        <button class="header-voice-btn" title="Voz activada (clic para silenciar)">ðŸ”Š</button>
        <button class="header-close" aria-label="Cerrar chat">âœ•</button>
      </div>
      <div class="lolo-chat-messages"></div>
      <div class="lolo-suggestions"></div>
      <div class="lolo-typing">
        <span class="dot-typing"></span>
        <span class="dot-typing"></span>
        <span class="dot-typing"></span>
      </div>
      <div class="lolo-chat-input-area">
        <button class="lolo-chat-mic" type="button" title="Hablar por micrÃ³fono">ðŸŽ™ï¸</button>
        <input type="text" class="lolo-chat-input" placeholder="EscribÃ­ tu consulta..." autocomplete="off">
        <button class="lolo-chat-send" disabled aria-label="Enviar">âž¤</button>
      </div>
      <div class="lolo-chat-footer">Potenciado por IA â€¢ ${LOLo_CONFIG.BUSINESS_NAME}</div>
    `;
  }

  // --- TOGGLE CHAT ---
  function toggleChat() {
    chatOpen = !chatOpen;
    chatWindow.classList.toggle('open', chatOpen);
    
    const invite = widgetContainer.querySelector('.lolo-voice-invite');
    if (invite) invite.style.display = 'none';

    if (chatOpen) {
      unreadCount = 0;
      updateBadge();
      setTimeout(() => inputField.focus(), 350);
      scrollToBottom();

      if (!hasPlayedWelcome && voiceEnabled && adminConfig.voz_activa !== false && messages.length <= 1) {
        hasPlayedWelcome = true;
        try {
          if (currentAudio) currentAudio.pause();
          currentAudio = new Audio('bienvenida.mp3');
          currentAudio.play().catch(e => console.log('Autoplay bloqueado:', e));
        } catch(e) {}
      }
    } else {
      if (currentAudio) currentAudio.pause();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      stopListening();
    }
  }

  // --- ENVIAR MENSAJE ---
  function sendMessage() {
    const text = inputField.value.trim();
    if (!text || isLoading) return;

    addUserMessage(text);
    inputField.value = '';
    sendBtn.disabled = true;
    hideSuggestions();
    callAPI(text);
  }

  // --- AGREGAR MENSAJES ---
  function addUserMessage(text) {
    const msg = { role: 'user', text, time: Date.now() };
    messages.push(msg);
    appendMessageDOM(msg);
    saveSession();
  }

  function addBotMessage(text, audio_b64 = null, shouldSpeak = true) {
    const msg = { role: 'bot', text, audio_b64, time: Date.now() };
    messages.push(msg);
    appendMessageDOM(msg);
    if (!chatOpen) {
      unreadCount++;
      updateBadge();
    }
    saveSession();
    if (shouldSpeak && chatOpen && adminConfig.voz_activa !== false) {
      playNeuralAudio(audio_b64, text);
    }
  }

  function addBotProductCards(productos) {
    productos.forEach(p => {
      const msg = { role: 'bot', type: 'product', data: p, time: Date.now() };
      messages.push(msg);
      appendProductCard(p);
    });
    saveSession();
  }

  // --- RENDER MENSAJES ---
  function appendMessageDOM(msg) {
    const div = document.createElement('div');
    div.className = `lolo-msg ${msg.role}`;

    if (msg.role === 'bot') {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.innerHTML = escapeHTML(msg.text);

      if (adminConfig.voz_activa !== false) {
        const audioBtn = document.createElement('button');
        audioBtn.className = 'lolo-msg-audio-btn';
        audioBtn.innerHTML = 'ðŸ”Š Escuchar';
        audioBtn.onclick = () => playNeuralAudio(msg.audio_b64, msg.text);
        bubble.appendChild(audioBtn);
      }

      div.appendChild(bubble);
    } else {
      div.innerHTML = `<div class="bubble">${escapeHTML(msg.text)}</div>`;
    }

    messagesArea.appendChild(div);
    scrollToBottom();
  }

  function appendProductCard(producto) {
    const card = document.createElement('div');
    card.className = 'lolo-msg bot';
    
    let fotoNombre = '';
    if (Array.isArray(producto.fotos) && producto.fotos.length > 0) {
      fotoNombre = producto.fotos[0];
    } else if (typeof producto.foto === 'string' && producto.foto.trim()) {
      fotoNombre = producto.foto.trim();
    }
    const imgUrl = fotoNombre ? `images/${fotoNombre}` : '';
    
    const imgHTML = imgUrl 
      ? `<div class="pc-img"><img src="${imgUrl}" alt="${escapeHTML(producto.nombre)}" onerror="this.parentElement.innerHTML='<span class=no-img>Sin foto</span>'"></div>` 
      : `<div class="pc-img"><span class="no-img">Sin foto</span></div>`;

    card.innerHTML = `
      <div class="bubble lolo-product-card" style="cursor:pointer;" title="Clic para ver detalle completo">
        ${imgHTML}
        <div class="pc-info">
          <div class="pc-nombre">${escapeHTML(producto.nombre)}</div>
          <div class="pc-precio">$ ${formatPrice(producto.precio)}</div>
          <button class="pc-btn-detalle" type="button">ðŸ” Ver Detalle</button>
        </div>
      </div>
    `;

    card.onclick = function(e) {
      e.stopPropagation();
      if (typeof window.openModal === 'function') {
        let prodEnCatalogo = null;
        if (Array.isArray(window.PRODUCTOS)) {
          prodEnCatalogo = window.PRODUCTOS.find(p => p.id === producto.id || p.codigo === producto.codigo || p.nombre === producto.nombre);
        }
        if (!prodEnCatalogo) {
          prodEnCatalogo = {
            id: producto.id,
            codigo: producto.codigo || '',
            nombre: producto.nombre,
            precio: producto.precio,
            precio_lista: producto.precio_lista || producto.precio,
            en_oferta: false,
            descuento_pct: 0,
            stock: producto.stock || 1,
            rubro: producto.rubro || 'LOLO SOBRE RUEDAS',
            fotos: Array.isArray(producto.fotos) ? producto.fotos : (producto.foto ? [producto.foto] : []),
            descripcion: producto.descripcion || '',
            descripcion_ia: producto.descripcion_ia || producto.descripcion || '',
            tipo: producto.tipo || '',
            material: producto.material || '',
            dimensiones: producto.dimensiones || '',
            funciones: producto.funciones || '',
            publico: producto.publico || ''
          };
        }
        window.openModal(prodEnCatalogo);
        return;
      }

      const urlWa = `https://wa.me/${LOLo_CONFIG.BUSINESS_INFO.whatsapp}?text=${encodeURIComponent('Hola! Me interesa: ' + producto.nombre + ' ($' + producto.precio + ')')}`;
      window.open(urlWa, '_blank');
    };

    messagesArea.appendChild(card);
    scrollToBottom();
  }

  function renderAllMessages() {
    messagesArea.innerHTML = '';
    messages.forEach(msg => {
      if (msg.type === 'product') {
        appendProductCard(msg.data);
      } else {
        appendMessageDOM(msg);
      }
    });
  }

  // --- LLAMAR API ---
  async function callAPI(userText) {
    isLoading = true;
    showTyping(true);

    try {
      const response = await fetch(`${LOLo_CONFIG.API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: messages.slice(-10).map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            text: m.text || (m.data ? m.data.nombre : '')
          }))
        })
      });

      if (!response.ok) throw new Error('Error de conexiÃ³n');

      const data = await response.json();
      showTyping(false);

      if (data.reply) {
        addBotMessage(data.reply, data.audio_b64, true);
      }

      const prods = data.products || data.productos; 
      if (prods && prods.length > 0) {
        setTimeout(() => addBotProductCards(prods), 300);
      }

    } catch (err) {
      showTyping(false);
      addBotMessage('Ups, tuve un problemita de conexiÃ³n ðŸ˜•. ProbÃ¡ de nuevo en un ratito. Si necesitas algo urgente, escribime por WhatsApp Â¡Te ayudo al toque! ðŸ“±', null, true);
    }

    isLoading = false;
  }

  function showTyping(show) {
    typingIndicator.classList.toggle('visible', show);
    if (statusDot) statusDot.classList.toggle('thinking', show);
    if (show) scrollToBottom();
  }

  function showSuggestions() {
    if (!suggestionsArea) return;
    suggestionsArea.innerHTML = '';
    LOLo_CONFIG.SUGERENCIAS.forEach(sug => {
      const chip = document.createElement('button');
      chip.className = 'lolo-sug-chip';
      chip.textContent = sug;
      chip.onclick = function() {
        addUserMessage(sug);
        hideSuggestions();
        callAPI(sug);
      };
      suggestionsArea.appendChild(chip);
    });
    suggestionsArea.style.display = 'flex';
  }

  function hideSuggestions() {
    if (suggestionsArea) suggestionsArea.style.display = 'none';
  }

  function updateBadge() {
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function scrollToBottom() {
    if (messagesArea) {
      setTimeout(() => {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }, 50);
    }
  }

  function saveSession() {
    try {
      const session = { messages: messages.slice(-20) };
      sessionStorage.setItem('lolo_chat_session', JSON.stringify(session));
    } catch(e) {}
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem('lolo_chat_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.messages) messages = session.messages;
      }
    } catch(e) {}
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatPrice(num) {
    return Number(num).toLocaleString('es-AR');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
