// chat.js - Sistema completo de Chat + Integração WhatsApp CORRIGIDO
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
  var COMMERCIAL_WHATSAPP = "5511918368812"; // ⚠️ SUBSTITUA PELO SEU NÚMERO

  // ============================================================================
  // SISTEMA DE CHAT
  // ============================================================================

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
        <div class="chat-header">💬 Chat Advocacia — Escritório m.lima</div>
        <div id="chat-messages" class="messages"></div>
        <div class="input-area">
          <input id="chat-input" placeholder="Digite sua mensagem... ⚖️" aria-label="Mensagem"/>
          <button id="chat-send">Enviar</button>
        </div>
      </div>
    `;
    
    // Event listeners do chat
    document.getElementById('chat-send').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e){ 
      if(e.key==='Enter') sendChatMessage(); 
    });
    
    // Mensagem inicial
    addChatMessage("Olá! Para começar nosso atendimento, digite uma saudação como 'oi'.", 'bot');
  }

  // Adiciona mensagem na interface do chat
  function addChatMessage(text, sender){
    var messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;
    
    var messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (sender === 'user' ? 'user' : 'bot');

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
  }

  // Mostra indicador de "digitando" e depois a resposta
  function showBotTypingAndReply(message){
    const messagesContainer = document.getElementById('chat-messages');
    if(!messagesContainer) return;

    // Indicador de digitando
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

    // Após 2 segundos, remove o "digitando" e mostra a resposta
    setTimeout(() => {
      typingDiv.remove();
      addChatMessage(message, 'bot');
    }, 2000);
  }

  // Gerenciamento de sessão do chat
  function setChatSessionId(id){ 
    try{ localStorage.setItem('chat_session_id', id); }catch(e){} 
  }
  
  function getChatSessionId(){ 
    try{ return localStorage.getItem('chat_session_id'); }catch(e){ return null; } 
  }

  // Envio de mensagens do chat
  async function sendChatMessage(){
    var input = document.getElementById('chat-input');
    var text = (input.value || '').trim();
    if(!text) return;
    
    addChatMessage(text, 'user');
    input.value = '';

    var payload = { 
      message: text, 
      session_id: getChatSessionId() || ('web_' + Date.now()) 
    };

    try {
      var response = await fetch(API_BASE_URL + '/api/v1/conversation/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if(!response.ok) throw new Error('Response not ok: ' + response.status);
      
      var data = await response.json();
      if(data.session_id) setChatSessionId(data.session_id);
      
      var botMessage = data.response || data.reply || data.question || '🤔 O bot não respondeu.';
      showBotTypingAndReply(botMessage);
      
    } catch(error) {
      console.warn('Chat API falhou, usando fallback:', error);
      showBotTypingAndReply("⚠️ Não consegui conectar com o servidor. Tente novamente em alguns minutos.");
    }
  }

  // ============================================================================
  // INTEGRAÇÃO WHATSAPP - VERSÃO CORRIGIDA
  // ============================================================================

  // 🔥 FUNÇÃO PRINCIPAL CORRIGIDA - Autoriza e abre WhatsApp
  async function authorizeWhatsAppSession(source, userData = {}) {
    console.log('🚀 [WHATSAPP] Iniciando autorização...', { source, userData });
    
    // Gerar session_id único para WhatsApp
    var sessionId = 'whatsapp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // 🔧 DADOS COMPLETOS para autorização - PHONE_NUMBER OBRIGATÓRIO
    var requestData = {
      session_id: sessionId,
      phone_number: COMMERCIAL_WHATSAPP, // ✅ CORRIGIDO: Usar o número comercial
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
      
      // 🔥 CORREÇÃO: Endpoint correto + timeout
      var response = await fetch(API_BASE_URL + '/api/v1/whatsapp/authorize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData),
        timeout: 10000 // 10 segundos timeout
      });
      
      console.log('📡 [WHATSAPP] Response status:', response.status);
      
      if (response.ok) {
        var data = await response.json();
        console.log('✅ [WHATSAPP] Pré-autorização realizada:', data);
        
        // Abrir WhatsApp com mensagem personalizada
        var message = generateWhatsAppMessage(userData, source, sessionId);
        var whatsappUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(message);
        
        console.log('📱 [WHATSAPP] Abrindo WhatsApp:', whatsappUrl);
        window.open(whatsappUrl, '_blank');
        
        // 🔥 SALVAR sessão para tracking
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
      
      // 🔥 FALLBACK melhorado - abrir WhatsApp mesmo sem autorização
      console.log('🔄 [WHATSAPP] Executando fallback...');
      var fallbackMessage = generateWhatsAppMessage(userData, source + '_fallback');
      var fallbackUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(fallbackMessage);
      
      console.log('📱 [WHATSAPP] Fallback - Abrindo WhatsApp direto:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
      
      return { success: false, fallback: true, error: error.message };
    }
  }

  // 🔥 MENSAGEM PERSONALIZADA com session_id para tracking
  function generateWhatsAppMessage(userData, source, sessionId) {
    var baseMessage = "Olá! Vim do site m.lima e gostaria de falar com um advogado.";
    
    // Adicionar contexto se disponível
    if (userData.origem) {
      baseMessage += "\n\n📍 Origem: " + userData.origem;
    }
    
    if (source) {
      baseMessage += "\n🔗 Via: " + source;
    }
    
    // 🔥 IMPORTANTE: Incluir session_id para o bot identificar
    if (sessionId) {
      baseMessage += "\n\n🆔 Sessão: " + sessionId;
    }
    
    return baseMessage;
  }

  // 🔥 INTERCEPTADOR ROBUSTO - Funciona com qualquer botão WhatsApp
  function interceptWhatsAppButtons() {
    console.log('📱 [WHATSAPP] Configurando interceptador robusto...');
    
    // 🔥 INTERCEPTADOR GLOBAL que pega QUALQUER link do WhatsApp
    document.addEventListener('click', function(e) {
      var target = e.target;
      var whatsappElement = null;
      
      // 🔍 BUSCA em vários níveis - botão flutuante, links, etc.
      var attempts = 0;
      while (target && attempts < 5) {
        // Verifica se é botão flutuante do react-whatsapp-button
        if (target.getAttribute && target.getAttribute('data-testid') === 'floating-whatsapp-button') {
          whatsappElement = target;
          break;
        }
        
        // Verifica se é link do WhatsApp
        if (target.href && target.href.includes('wa.me')) {
          whatsappElement = target;
          break;
        }
        
        // Verifica se tem classe relacionada ao WhatsApp
        if (target.className && typeof target.className === 'string') {
          if (target.className.includes('whatsapp') || target.className.includes('wa-')) {
            whatsappElement = target;
            break;
          }
        }
        
        target = target.parentElement;
        attempts++;
      }
      
      if (whatsappElement) {
        console.log('🔥 [WHATSAPP] Botão interceptado!', whatsappElement);
        
        // Para o evento ANTES do React ou qualquer handler processar
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Fazer pré-autorização e abrir WhatsApp
        authorizeWhatsAppSession('floating_button', {
          origem: 'Botão Flutuante',
          site: 'm.lima',
          intercepted_element: whatsappElement.tagName + (whatsappElement.className ? '.' + whatsappElement.className : '')
        });
        
        return false;
      }
    }, { 
      capture: true, // Captura o evento ANTES de chegar ao React
      passive: false // Permite preventDefault
    });
    
    // 🔥 INTERCEPTADOR ADICIONAL para links criados dinamicamente
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Verifica novos botões WhatsApp adicionados
              var newWhatsAppButtons = node.querySelectorAll('[data-testid="floating-whatsapp-button"], a[href*="wa.me"], [class*="whatsapp"]');
              if (newWhatsAppButtons.length > 0) {
                console.log('📱 [WHATSAPP] Novos botões WhatsApp detectados:', newWhatsAppButtons.length);
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('✅ [WHATSAPP] Interceptador configurado com sucesso!');
  }

  // ============================================================================
  // INICIALIZAÇÃO E EXPOSIÇÃO PÚBLICA
  // ============================================================================

  // Inicialização principal
  function initialize() {
    console.log('🚀 Inicializando Chat + WhatsApp Integration v2.0...');
    console.log('🔧 Backend URL:', API_BASE_URL);
    console.log('📱 WhatsApp Comercial:', COMMERCIAL_WHATSAPP);
    console.log('🎯 Usando interceptação robusta v2.0');
    
    // Inicializar chat
    mountChatUI();
    
    // Configurar integração WhatsApp (versão corrigida)
    setTimeout(function() {
      interceptWhatsAppButtons();
    }, 1000);
    
    // 🔥 TESTE automático se estiver em desenvolvimento
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
      console.log('🧪 [DEV] Modo desenvolvimento detectado');
      window.testWhatsApp = function() {
        authorizeWhatsAppSession('dev_test', { test: true, timestamp: new Date().toISOString() });
      };
    }
  }

  // Event listener para inicialização
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Configurar botão launcher do chat (se existir)
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
  // API PÚBLICA - VERSÃO EXPANDIDA
  // ============================================================================

  // Expor funcionalidades do Chat
  window.ChatWidget = {
    setBackend: function(url) { 
      API_BASE_URL = url; 
      localStorage.setItem('backend_url', url);
      console.log('🔧 Backend URL atualizada:', url);
    },
    sendMessage: sendChatMessage,
    addMessage: addChatMessage,
    clearSession: function() {
      localStorage.removeItem('chat_session_id');
      console.log('🧹 Sessão do chat limpa');
    },
    startConversation: function() {
      console.log('🔧 Iniciando conversa manualmente...');
      addChatMessage("Conversa iniciada! Digite 'oi' para começar.", 'bot');
    }
  };

  // 🔥 API EXPANDIDA do WhatsApp
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
    }
  };

  console.log('✅ Chat.js v2.0 carregado completamente!');
  console.log('💡 Use ChatWidget.* ou WhatsAppIntegration.* no console para debug');
  console.log('🔥 CORREÇÕES APLICADAS:');
  console.log('   - Endpoint correto /api/v1/whatsapp/authorize');
  console.log('   - Timeout e error handling melhorados');
  console.log('   - Session tracking implementado');
  console.log('   - Interceptação mais robusta');
  console.log('   - Fallback melhorado');

})();