// chat.js - Sistema corrigido com arquitetura separada v4.0
(function(){
  // ============================================================================
  // CONFIGURAÇÃO E UTILITÁRIOS
  // ============================================================================
  
  // Pega URL do backend de várias fontes possíveis
  var thisScript = document.currentScript || (function(){ 
    var s = document.getElementsByTagName('script'); 
    return s[s.length-1]; 
  })();
  
  var API_BASE_URL = (thisScript && thisScript.getAttribute('data-api')) 
                     || (new URLSearchParams(window.location.search).get('api')) 
                     || localStorage.getItem('backend_url') 
                     || 'https://law-firm-backend-936902782519-936902782519.us-central1.run.app';

  // SEU NÚMERO COMERCIAL DO WHATSAPP (ALTERE AQUI)
  var COMMERCIAL_WHATSAPP = "5511918368812";

  // ============================================================================
  // SISTEMA DE VALIDAÇÃO RIGOROSA
  // ============================================================================

  var Validators = {
    name: function(name) {
      if (!name || name.trim().length < 3) return false;
      var words = name.trim().split(/\s+/);
      if (words.length < 2) return false;
      // Não pode conter números
      if (/\d/.test(name)) return false;
      // Deve conter pelo menos letras
      if (!/[a-zA-ZÀ-ÿ]/.test(name)) return false;
      return true;
    },

    phone: function(phone) {
      if (!phone) return false;
      // Remove tudo que não é número
      var numbers = phone.replace(/\D/g, '');
      // Aceita: 11999999999, 5511999999999
      return numbers.length === 11 || (numbers.length === 13 && numbers.startsWith('55'));
    },

    email: function(email) {
      if (!email) return false;
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email.trim());
    },

    legalArea: function(area) {
      if (!area) return false;
      var normalized = area.trim().toLowerCase();
      return normalized === 'penal' || normalized === 'saude' || 
             normalized === 'saúde' || normalized.includes('penal') ||
             normalized.includes('saude') || normalized.includes('saúde');
    },

    description: function(desc) {
      return desc && desc.trim().length >= 20;
    }
  };

  // ============================================================================
  // FLUXO 1: CHAT DA LANDING PAGE (SEM WHATSAPP)
  // ============================================================================

  // Estado global do chat
  var chatState = {
    isLoading: false,
    rateLimited: false,
    rateLimitTimer: null,
    currentSessionId: null,
    conversationData: {},
    retryCount: 0,
    lastCorrelationId: null
  };

  // Constantes de configuração
  var CONFIG = {
    REQUEST_TIMEOUT: 10000,
    RATE_LIMIT_COOLDOWN: 30000,
    MAX_RETRY_ATTEMPTS: 1,
    TYPING_ANIMATION_DELAY: 2000
  };

  // Monta a interface do chat
  function mountChatUI() {
    var root = document.getElementById('chat-root');
    if(!root){ 
      root = document.createElement('div'); 
      root.id = 'chat-root'; 
      document.body.appendChild(root); 
    }
    
    root.innerHTML = `
      <div class="chat-container" role="dialog" aria-label="Chat">
        <div class="chat-header">
          💬 Chat Advocacia — Escritório m.lima
          <div id="progress-bar" class="progress-bar" style="display: none;">
            <div id="progress-fill" class="progress-fill"></div>
          </div>
        </div>
        <div id="chat-messages" class="messages"></div>
        <div class="input-area">
          <input id="chat-input" placeholder="Digite sua mensagem... ⚖️" aria-label="Mensagem"/>
          <button id="chat-send">Enviar</button>
          <div id="rate-limit-timer" class="rate-limit-timer" style="display: none;"></div>
        </div>
      </div>
    `;
    
    // Event listeners do chat
    document.getElementById('chat-send').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e){ 
      if(e.key==='Enter' && !chatState.isLoading && !chatState.rateLimited) {
        sendChatMessage(); 
      }
    });
    
    // Restaurar sessão se existir
    restoreSession();
    
    // Mensagem inicial
    addChatMessage("Olá! Bem-vindo-pronto para conversar?", 'bot');
  }

  // Sistema de persistência de sessão
  function saveSession() {
    try {
      var sessionData = {
        sessionId: chatState.currentSessionId,
        conversationData: chatState.conversationData,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('chat_session_data', JSON.stringify(sessionData));
    } catch(e) {
      console.warn('Não foi possível salvar sessão:', e);
    }
  }

  function restoreSession() {
    try {
      var savedData = localStorage.getItem('chat_session_data');
      if (savedData) {
        var sessionData = JSON.parse(savedData);
        var sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
        if (sessionAge < 3600000) { // 1 hora
          chatState.currentSessionId = sessionData.sessionId;
          chatState.conversationData = sessionData.conversationData || {};
          console.log('✅ Sessão restaurada:', chatState.currentSessionId);
        }
      }
    } catch(e) {
      console.warn('Não foi possível restaurar sessão:', e);
    }
  }

  // Adiciona mensagem na interface do chat
  function addChatMessage(text, sender, messageType = 'normal'){
    var messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;
    
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (sender === 'user' ? 'user' : 'bot');
    
    if (messageType === 'error') messageDiv.classList.add('error-message');
    if (messageType === 'success') messageDiv.classList.add('success-message');
    if (messageType === 'warning') messageDiv.classList.add('warning-message');

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = sender === 'user' ? '👤' : '🤖';

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    if(sender === 'user'){ 
      messageDiv.appendChild(bubble); 
      messageDiv.appendChild(avatar); 
    } else { 
      messageDiv.appendChild(avatar); 
      messageDiv.appendChild(bubble); 
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    saveSession();
  }

  // Sistema de loading com animação
  function showBotTypingAndReply(message, messageType = 'normal', delay = CONFIG.TYPING_ANIMATION_DELAY){
    const messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.classList.add('message', 'bot', 'typing-message');
    typingDiv.innerHTML = `
      <div class="avatar">🤖</div>
      <div class="bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    setTimeout(() => {
      typingDiv.remove();
      addChatMessage(message, 'bot', messageType);
    }, delay);
  }

  // Sistema de barra de progresso
  function updateProgressBar(confidenceScore) {
    var progressBar = document.getElementById('progress-bar');
    var progressFill = document.getElementById('progress-fill');
    
    if (!progressBar || !progressFill) return;
    
    if (confidenceScore > 0) {
      progressBar.style.display = 'block';
      var percentage = Math.min(confidenceScore * 100, 100);
      progressFill.style.width = percentage + '%';
      
      if (percentage >= 100) {
        setTimeout(() => {
          progressBar.style.display = 'none';
        }, 3000);
      }
    } else {
      progressBar.style.display = 'none';
    }
  }

  // Sistema de rate limiting
  function handleRateLimit() {
    chatState.rateLimited = true;
    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send');
    var timerDiv = document.getElementById('rate-limit-timer');
    
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (timerDiv) timerDiv.style.display = 'block';
    
    var remainingTime = CONFIG.RATE_LIMIT_COOLDOWN / 1000;
    
    var countdown = setInterval(() => {
      if (timerDiv) {
        timerDiv.textContent = `Aguarde ${remainingTime}s para enviar nova mensagem`;
      }
      
      remainingTime--;
      
      if (remainingTime <= 0) {
        clearInterval(countdown);
        chatState.rateLimited = false;
        
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (timerDiv) {
          timerDiv.style.display = 'none';
          timerDiv.textContent = '';
        }
      }
    }, 1000);
    
    chatState.rateLimitTimer = countdown;
  }

  // ✅ CÓDIGO CORRIGIDO:
function isDataCollectionCompleted(responseData) {
    // Backend retorna lead_data, NÃO extracted_data
    var leadData = responseData.lead_data || {};
    
    var hasName = leadData.identification && leadData.identification.trim().length > 0;
    var hasContact = leadData.contact_info && leadData.contact_info.trim().length > 0;
    var hasArea = leadData.area_qualification && leadData.area_qualification.trim().length > 0;
    var hasDetails = leadData.case_details && leadData.case_details.trim().length > 0;
    
    var flowCompleted = responseData.flow_completed === true;
    var completedState = responseData.current_step === 'completed';
    
    console.log('🔍 Verificação de coleta completa:', {
      hasName, 
      hasContact, 
      hasArea, 
      hasDetails,
      flowCompleted, 
      completedState,
      leadData: leadData  // Debug
    });
    
    // Fluxo completo = backend marcou como completed OU tem todos os dados essenciais
    return flowCompleted || (hasName && hasContact && hasArea && hasDetails);
}
  // CORRIGIDO: Sistema de tratamento APENAS para chat da landing
  function handleResponseType(responseData) {
    var responseType = responseData.response_type || 'web_intelligent';
    
    switch(responseType) {
      case 'rate_limited':
        console.log('⚠️ Rate limit detectado');
        handleRateLimit();
        showBotTypingAndReply(
          "Você está enviando muitas mensagens. Aguarde um momento para continuar.",
          'warning'
        );
        break;
        
      case 'error_recovery':
        console.log('🔄 Erro recuperável detectado');
        showBotTypingAndReply(
          responseData.response || "Houve um pequeno problema, mas podemos continuar. Tente reformular sua mensagem.",
          'warning'
        );
        break;
        
      case 'system_error':
        console.log('❌ Erro de sistema detectado');
        showBotTypingAndReply(
          "Ocorreu um erro temporário. Nossa equipe foi notificada. Tente novamente em alguns minutos.",
          'error'
        );
        break;
        
      case 'web_intelligent':
      default:
        console.log('✅ Resposta normal processada');
        var message = responseData.response || responseData.reply || responseData.question || 
                     '🤔 Desculpe, não consegui processar sua mensagem adequadamente.';
        
        // CORRIGIDO: Se dados completos, mostrar APENAS mensagem de sucesso
        if (isDataCollectionCompleted(responseData)) {
          showDataCollectionCompleted(message);
        } else {
          showBotTypingAndReply(message);
        }
        
        if (responseData.confidence_score) {
          updateProgressBar(responseData.confidence_score);
        }
        break;
    }
    
    if (responseData.correlation_id) {
      chatState.lastCorrelationId = responseData.correlation_id;
    }
  }

  // NOVO: Mensagem FINAL simples - SEM botões WhatsApp
  function showDataCollectionCompleted(message) {
    var successMessage = message + "\n\n✅ Obrigado! Suas informações foram registradas com sucesso. Nossa equipe analisará seu caso e entrará em contato em breve.";
    
    showBotTypingAndReply(successMessage, 'success');
  }
    
  // Sistema de requisição com timeout
  async function makeRequestWithTimeout(url, options, timeout = CONFIG.REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Sistema de envio de mensagens do chat
  async function sendChatMessage(){
    var input = document.getElementById('chat-input');
    var text = (input.value || '').trim();
    
    if(!text || chatState.isLoading || chatState.rateLimited) return;
    
    chatState.isLoading = true;
    var sendBtn = document.getElementById('chat-send');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Enviando...';
    }
    
    addChatMessage(text, 'user');
    input.value = '';

    if (!chatState.currentSessionId) {
      chatState.currentSessionId = 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    var payload = { 
      message: text, 
      session_id: chatState.currentSessionId,
      user_data: chatState.conversationData
    };

    try {
      console.log('📡 Enviando mensagem:', payload);
      
      var response = await makeRequestWithTimeout(API_BASE_URL + '/api/v1/conversation/respond', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if(!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      var data = await response.json();
      console.log('📨 Resposta recebida:', data);
      
      if(data.session_id) {
        chatState.currentSessionId = data.session_id;
      }
      
      if (data.lead_data) {
    chatState.conversationData = { ...chatState.conversationData, ...data.lead_data };
    }
      
      chatState.retryCount = 0;
      handleResponseType(data);
      
    } catch(error) {
      console.error('❌ Erro na requisição:', error);
      
      if (chatState.retryCount < CONFIG.MAX_RETRY_ATTEMPTS && 
          (error.message.includes('timeout') || error.message.includes('network'))) {
        
        chatState.retryCount++;
        console.log(`🔄 Tentativa ${chatState.retryCount} de ${CONFIG.MAX_RETRY_ATTEMPTS}`);
        
        showBotTypingAndReply(
          `Conexão instável. Tentando novamente... (${chatState.retryCount}/${CONFIG.MAX_RETRY_ATTEMPTS})`,
          'warning',
          1000
        );
        
        setTimeout(() => {
          input.value = text;
          sendChatMessage();
        }, 2000);
        
      } else {
        var errorMessage = "⚠️ Não consegui conectar com o servidor. ";
        
        if (error.message.includes('timeout')) {
          errorMessage += "A conexão demorou muito para responder. Tente novamente.";
        } else if (error.message.includes('rate_limited')) {
          errorMessage += "Muitas mensagens enviadas. Aguarde um momento.";
          handleRateLimit();
        } else {
          errorMessage += "Verifique sua conexão e tente novamente em alguns minutos.";
        }
        
        showBotTypingAndReply(errorMessage, 'error');
        chatState.retryCount = 0;
      }
    } finally {
      chatState.isLoading = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Enviar';
      }
    }
  }

  // ============================================================================
  // FLUXO 2: INTEGRAÇÃO WHATSAPP (APENAS PARA BOTÕES EXTERNOS)
  // ============================================================================

  // CORRIGIDO: Autoriza sessão e abre WhatsApp (apenas para botões da página)
  async function authorizeWhatsAppSession(source, userData = {}) {
    console.log('🚀 [WHATSAPP] Iniciando autorização...', { source, userData });
    
    var sessionId = 'whatsapp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    var requestData = {
      session_id: sessionId,
      phone_number: COMMERCIAL_WHATSAPP,
      source: source,
      user_data: {
        ...userData,
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        referrer: document.referrer || 'direct',
        commercial_number: COMMERCIAL_WHATSAPP
      }
    };

    try {
      console.log('📡 [WHATSAPP] Enviando pré-autorização...', requestData);
      
      var response = await makeRequestWithTimeout(API_BASE_URL + '/api/v1/whatsapp/authorize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log('📡 [WHATSAPP] Response status:', response.status);
      
      if (response.ok) {
        var data = await response.json();
        console.log('✅ [WHATSAPP] Pré-autorização realizada:', data);
        
        var message = generateWhatsAppMessage(userData, source, sessionId);
        var whatsappUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(message);
        
        console.log('📱 [WHATSAPP] Abrindo WhatsApp:', whatsappUrl);
        window.open(whatsappUrl, '_blank');
        
        try {
          localStorage.setItem('whatsapp_session_id', sessionId);
          localStorage.setItem('whatsapp_authorized_at', new Date().toISOString());
        } catch(e) { console.warn('Não foi possível salvar sessão WhatsApp'); }
        
        return { success: true, session_id: sessionId };
        
      } else {
        var errorText = await response.text();
        console.error('❌ [WHATSAPP] Pré-autorização falhou:', response.status, errorText);
        throw new Error('Pré-autorização falhou: ' + response.status);
      }
      
    } catch (error) {
      console.error('❌ [WHATSAPP] Erro na pré-autorização:', error);
      
      console.log('🔄 [WHATSAPP] Executando fallback...');
      var fallbackMessage = "Olá! Vim do site m.lima e preciso de ajuda jurídica urgente.";
      
      if (userData && Object.keys(userData).length > 0) {
        fallbackMessage += "\n\nDados disponíveis:";
        Object.entries(userData).forEach(([key, value]) => {
          fallbackMessage += `\n• ${key}: ${value}`;
        });
      }
      
      var fallbackUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(fallbackMessage);
      
      console.log('📱 [WHATSAPP] Fallback - Abrindo WhatsApp direto:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
      
      return { success: false, fallback: true, error: error.message };
    }
  }

  // Gera mensagem para WhatsApp COM session_id
  function generateWhatsAppMessage(userData, source, sessionId) {
    var baseMessage = "Olá! Vim do site m.lima e preciso de ajuda jurídica urgente.";
    baseMessage += "\n\nGostaria de falar com um advogado especializado para esclarecer algumas dúvidas importantes sobre minha situação.";
    
    if (userData && Object.keys(userData).length > 0) {
      baseMessage += "\n\n📋 Informações iniciais:";
      Object.entries(userData).forEach(([key, value]) => {
        var label = key === 'name' ? 'Nome' : 
                   key === 'phone' ? 'Telefone' : 
                   key === 'email' ? 'Email' : 
                   key === 'legal_area' ? 'Área Jurídica' : key;
        baseMessage += `\n• ${label}: ${value}`;
      });
    }
    
    if (userData.origem && userData.origem !== 'Botão Flutuante') {
      baseMessage += "\n\n📍 Contexto: " + userData.origem;
    }
    
    baseMessage += "\n\nAgradeço desde já a atenção e aguardo retorno.";
    
    if (sessionId) {
      baseMessage += "\n\n🆔 Sessão: " + sessionId;
    }
    
    return baseMessage;
  }

  // INTERCEPTADOR para botões WhatsApp da página
  function interceptWhatsAppButtons() {
    console.log('📱 [WHATSAPP] Configurando interceptador...');
    
    document.addEventListener('click', function(e) {
      var target = e.target;
      var whatsappElement = null;
      var interceptReason = '';
      
      var attempts = 0;
      var searchTarget = target;
      
      while (searchTarget && attempts < 8) {
        if (searchTarget.getAttribute && searchTarget.getAttribute('data-testid') === 'floating-whatsapp-button') {
          whatsappElement = searchTarget;
          interceptReason = 'data-testid=floating-whatsapp-button';
          break;
        }
        
        if (searchTarget.href && searchTarget.href.includes('wa.me')) {
          whatsappElement = searchTarget;
          interceptReason = 'href-wa.me';
          break;
        }
        
        if (searchTarget.className && typeof searchTarget.className === 'string') {
          var className = searchTarget.className.toLowerCase();
          if (className.includes('whatsapp') || className.includes('wa-') || className.includes('float')) {
            whatsappElement = searchTarget;
            interceptReason = 'className-whatsapp';
            break;
          }
        }
        
        if (searchTarget.id && typeof searchTarget.id === 'string') {
          var id = searchTarget.id.toLowerCase();
          if (id.includes('whatsapp') || id.includes('wa-') || id.includes('float')) {
            whatsappElement = searchTarget;
            interceptReason = 'id-whatsapp';
            break;
          }
        }
        
        searchTarget = searchTarget.parentElement;
        attempts++;
      }
      
      if (whatsappElement) {
        console.log('🔥 [WHATSAPP] BOTÃO INTERCEPTADO!', interceptReason);
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        authorizeWhatsAppSession('floating_button', {
          origem: 'Botão Flutuante Interceptado',
          site: 'm.lima',
          intercept_method: interceptReason
        });
        
        return false;
      }
    }, { 
      capture: true,
      passive: false
    });
    
    // Observer para botões criados dinamicamente
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              var selectors = [
                '[data-testid="floating-whatsapp-button"]',
                'a[href*="wa.me"]',
                '[class*="whatsapp"]',
                '[class*="float"]',
                '[id*="whatsapp"]',
                'button[class*="whatsapp"]'
              ];
              
              selectors.forEach(function(selector) {
                try {
                  var found = node.querySelectorAll ? node.querySelectorAll(selector) : [];
                  if (found.length > 0) {
                    console.log('📱 [OBSERVER] Novos botões WhatsApp detectados:', found.length);
                    
                    found.forEach(function(btn) {
                      btn.addEventListener('click', function(e) {
                        console.log('🔥 [OBSERVER] Botão WhatsApp clicado via Observer!');
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        
                        authorizeWhatsAppSession('floating_button_observer', {
                          origem: 'Botão via Observer',
                          site: 'm.lima',
                          selector_matched: selector
                        });
                      }, { capture: true, passive: false });
                    });
                  }
                } catch(e) {
                  // Ignorar erros de seletor
                }
              });
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('✅ [WHATSAPP] Interceptador configurado!');
  }

  // ============================================================================
  // INICIALIZAÇÃO
  // ============================================================================

  function initialize() {
    console.log('🚀 Inicializando Chat + WhatsApp Integration v4.0 CORRIGIDO...');
    console.log('🔧 Backend URL:', API_BASE_URL);
    console.log('📱 WhatsApp Comercial:', COMMERCIAL_WHATSAPP);
    
    // Inicializar chat da landing page
    mountChatUI();
    
    // Configurar interceptação de botões WhatsApp externos
    setTimeout(function() {
      interceptWhatsAppButtons();
    }, 1000);
    
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
      console.log('🧪 [DEV] Modo desenvolvimento detectado');
      window.testWhatsApp = function() {
        authorizeWhatsAppSession('dev_test', { 
          test: true, 
          timestamp: new Date().toISOString()
        });
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Chat launcher
  document.addEventListener('DOMContentLoaded', function() {
    var launcher = document.getElementById('chat-launcher');
    if(launcher) {
      launcher.addEventListener('click', function() {
        var chatRoot = document.getElementById('chat-root');
        if(chatRoot) {
          chatRoot.classList.toggle('active');
        }
      });
    }
  });

  // ============================================================================
  // API PÚBLICA CORRIGIDA
  // ============================================================================

  // Chat da landing page (coleta dados apenas)
  window.ChatWidget = {
    setBackend: function(url) { 
      API_BASE_URL = url; 
      localStorage.setItem('backend_url', url);
      console.log('🔧 Backend URL atualizada:', url);
    },
    sendMessage: sendChatMessage,
    addMessage: addChatMessage,
    clearSession: function() {
      chatState.currentSessionId = null;
      chatState.conversationData = {};
      localStorage.removeItem('chat_session_data');
      console.log('🧹 Sessão do chat limpa');
    },
    getState: function() {
      return {
        isLoading: chatState.isLoading,
        rateLimited: chatState.rateLimited,
        sessionId: chatState.currentSessionId,
        conversationData: chatState.conversationData,
        lastCorrelationId: chatState.lastCorrelationId
      };
    },
    startConversation: function() {
      console.log('🔧 Iniciando conversa manualmente...');
      addChatMessage("Conversa iniciada! Digite 'oi' para começar.", 'bot');
    },
    validateData: function(data) {
      return {
        name: Validators.name(data.name),
        phone: Validators.phone(data.phone),
        email: Validators.email(data.email),
        legalArea: Validators.legalArea(data.legalArea),
        description: Validators.description(data.description)
      };
    }
  };

  // WhatsApp Integration (apenas para botões externos da página)
  window.WhatsAppIntegration = {
    test: function(source) {
      console.log('🧪 Testando integração WhatsApp...');
      return authorizeWhatsAppSession(source || 'manual_test', { 
        test: true, 
        timestamp: new Date().toISOString(),
        manual: true
      });
    },
    authorize: authorizeWhatsAppSession,
    reintercept: interceptWhatsAppButtons,
    setCommercialNumber: function(number) {
      COMMERCIAL_WHATSAPP = number;
      console.log('📱 Número comercial atualizado:', number);
    },
    setBackend: function(url) {
      API_BASE_URL = url;
      localStorage.setItem('backend_url', url);
      console.log('🔧 Backend URL atualizada para WhatsApp:', url);
    },
    openWhatsApp: function(source, userData) {
      console.log('🔄 Abrindo WhatsApp manualmente...', { source, userData });
      return authorizeWhatsAppSession(source || 'manual', userData || {});
    },
    getStatus: function() {
      return {
        commercial_number: COMMERCIAL_WHATSAPP,
        backend_url: API_BASE_URL,
        last_session: localStorage.getItem('whatsapp_session_id'),
        last_authorized: localStorage.getItem('whatsapp_authorized_at')
      };
    },
    clearSession: function() {
      localStorage.removeItem('whatsapp_session_id');
      localStorage.removeItem('whatsapp_authorized_at');
      console.log('🧹 Sessão WhatsApp limpa');
    },
    debugElements: function() {
      console.log('🔍 [DEBUG] Procurando elementos WhatsApp na página...');
      
      var selectors = [
        '[data-testid="floating-whatsapp-button"]',
        'a[href*="wa.me"]',
        '[class*="whatsapp"]',
        '[class*="float"]',
        '[id*="whatsapp"]',
        'button[class*="whatsapp"]'
      ];
      
      selectors.forEach(function(selector) {
        try {
          var elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            console.log(`✅ Encontrado ${elements.length} elemento(s) com: ${selector}`);
            elements.forEach(function(el, index) {
              console.log(`   [${index}] TagName: ${el.tagName}, Class: "${el.className}", ID: "${el.id}"`);
            });
          } else {
            console.log(`❌ Nenhum elemento encontrado para: ${selector}`);
          }
        } catch(e) {
          console.log(`⚠️ Erro ao buscar: ${selector} - ${e.message}`);
        }
      });
      
      return {
        total_found: selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0),
        selectors_tested: selectors.length
      };
    },
    forceIntercept: function(elementSelector) {
      console.log('🎯 [FORCE] Forçando interceptação em:', elementSelector);
      
      var element = document.querySelector(elementSelector);
      if (!element) {
        console.log('❌ [FORCE] Elemento não encontrado:', elementSelector);
        return false;
      }
      
      element.addEventListener('click', function(e) {
        console.log('🔥 [FORCE] Elemento interceptado via forceIntercept!');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        authorizeWhatsAppSession('force_intercept', {
          origem: 'Interceptação Forçada',
          site: 'm.lima',
          selector: elementSelector
        });
      }, { capture: true, passive: false });
      
      console.log('✅ [FORCE] Listener adicionado com sucesso!');
      return true;
    }
  };

  console.log('✅ Chat.js v4.0 CORRIGIDO carregado completamente!');
  console.log('🔧 ARQUITETURA CORRIGIDA:');
  console.log('   ✅ FLUXO 1: Chat da landing - APENAS coleta dados');
  console.log('   ✅ FLUXO 2: Botões WhatsApp - APENAS autoriza e abre WhatsApp');
  console.log('   ❌ REMOVIDO: Botões WhatsApp dentro do chat');
  console.log('   ❌ REMOVIDO: Redirecionamento do chat para WhatsApp');
  console.log('   ❌ REMOVIDO: Lógica de acionamento de advogados no frontend');
  console.log('   ✅ Validação rigorosa de dados implementada');
  console.log('   ✅ Mensagem final simples sem botões');
  console.log('💡 Use ChatWidget.* para chat ou WhatsAppIntegration.* para WhatsApp no console');
})();