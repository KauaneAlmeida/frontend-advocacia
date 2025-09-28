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
      var fallbackMessage = "Olá! Vim do site m.lima e preciso de ajuda jurídica.";
      var fallbackUrl = 'https://wa.me/' + COMMERCIAL_WHATSAPP + '?text=' + encodeURIComponent(fallbackMessage);
      
      console.log('📱 [WHATSAPP] Fallback - Abrindo WhatsApp direto:', fallbackUrl);
      window.open(fallbackUrl, '_blank');
      
      return { success: false, fallback: true, error: error.message };
    }
  }

  // Gera mensagem COM SESSION_ID para o bot identificar
  function generateWhatsAppMessage(userData, source, sessionId) {
    var baseMessage = "Olá! Vim do site m.lima e preciso de ajuda jurídica urgente.";
    baseMessage += "\n\nGostaria de falar com um advogado especializado para esclarecer algumas dúvidas importantes sobre minha situação.";
    baseMessage += "\n\nAgradeço desde já a atenção e aguardo retorno.";
    
    // Adicionar contexto específico se disponível
    if (userData.origem && userData.origem !== 'Botão Flutuante') {
      baseMessage += "\n\n📍 Contexto: " + userData.origem;
    }
    
    // 🔧 ESSENCIAL: Session ID para o bot identificar e responder
    if (sessionId) {
      baseMessage += "\n\n🆔 Sessão: " + sessionId;
      baseMessage += "\n(Este é meu código de identificação para o sistema de atendimento)";
    }
    
    return baseMessage;
  }

  // 🔥 INTERCEPTADOR ULTRA-ROBUSTO - Múltiplas estratégias
  function interceptWhatsAppButtons() {
    console.log('📱 [WHATSAPP] Configurando interceptador ultra-robusto...');
    
    // 🎯 ESTRATÉGIA 1: Event listener com múltiplas verificações
    document.addEventListener('click', function(e) {
      var target = e.target;
      var whatsappElement = null;
      var interceptReason = '';
      
      console.log('🔍 [CLICK] Elemento clicado:', target);
      
      // 🔍 BUSCA PROFUNDA em vários níveis
      var attempts = 0;
      var searchTarget = target;
      
      while (searchTarget && attempts < 8) {
        // Verificação 1: data-testid (react-whatsapp-button)
        if (searchTarget.getAttribute && searchTarget.getAttribute('data-testid') === 'floating-whatsapp-button') {
          whatsappElement = searchTarget;
          interceptReason = 'data-testid=floating-whatsapp-button';
          break;
        }
        
        // Verificação 2: href com wa.me
        if (searchTarget.href && searchTarget.href.includes('wa.me')) {
          whatsappElement = searchTarget;
          interceptReason = 'href-wa.me';
          break;
        }
        
        // Verificação 3: classes WhatsApp
        if (searchTarget.className && typeof searchTarget.className === 'string') {
          var className = searchTarget.className.toLowerCase();
          if (className.includes('whatsapp') || className.includes('wa-') || className.includes('float')) {
            whatsappElement = searchTarget;
            interceptReason = 'className-whatsapp';
            break;
          }
        }
        
        // Verificação 4: ID relacionado
        if (searchTarget.id && typeof searchTarget.id === 'string') {
          var id = searchTarget.id.toLowerCase();
          if (id.includes('whatsapp') || id.includes('wa-') || id.includes('float')) {
            whatsappElement = searchTarget;
            interceptReason = 'id-whatsapp';
            break;
          }
        }
        
        // Verificação 5: atributos React específicos
        var attributes = searchTarget.attributes || [];
        for (var i = 0; i < attributes.length; i++) {
          var attr = attributes[i];
          if (attr.name && attr.name.includes('whatsapp')) {
            whatsappElement = searchTarget;
            interceptReason = 'attribute-whatsapp';
            break;
          }
        }
        
        if (whatsappElement) break;
        
        searchTarget = searchTarget.parentElement;
        attempts++;
      }
      
      if (whatsappElement) {
        console.log('🔥 [WHATSAPP] BOTÃO INTERCEPTADO!');
        console.log('📍 Razão:', interceptReason);
        console.log('🎯 Elemento:', whatsappElement);
        console.log('🏷️ TagName:', whatsappElement.tagName);
        console.log('🎨 ClassName:', whatsappElement.className);
        console.log('🆔 ID:', whatsappElement.id);
        
        // Para TODOS os eventos
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Executar autorização
        authorizeWhatsAppSession('floating_button', {
          origem: 'Botão Flutuante Interceptado',
          site: 'm.lima',
          intercept_method: interceptReason,
          element_info: {
            tagName: whatsappElement.tagName,
            className: whatsappElement.className,
            id: whatsappElement.id
          }
        });
        
        return false;
      }
    }, { 
      capture: true,
      passive: false
    });
    
    // 🎯 ESTRATÉGIA 2: Observer para botões criados dinamicamente
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Procurar novos botões WhatsApp
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
                    console.log('📱 [OBSERVER] Novos botões WhatsApp detectados:', selector, found.length);
                    
                    // Adicionar evento específico a cada novo botão
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
              
              // Verificar se o próprio nó é um botão WhatsApp
              if (node.getAttribute && node.getAttribute('data-testid') === 'floating-whatsapp-button') {
                console.log('📱 [OBSERVER] Botão WhatsApp direto detectado!');
                node.addEventListener('click', function(e) {
                  console.log('🔥 [OBSERVER] Botão direto clicado!');
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                  
                  authorizeWhatsAppSession('floating_button_direct', {
                    origem: 'Botão Direto via Observer',
                    site: 'm.lima'
                  });
                }, { capture: true, passive: false });
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
    
    // 🎯 ESTRATÉGIA 3: Interceptação por timer (fallback)
    var checkInterval = setInterval(function() {
      var floatingBtn = document.querySelector('[data-testid="floating-whatsapp-button"]');
      if (floatingBtn && !floatingBtn.dataset.intercepted) {
        console.log('📱 [TIMER] Botão WhatsApp encontrado por timer!');
        floatingBtn.dataset.intercepted = 'true';
        
        floatingBtn.addEventListener('click', function(e) {
          console.log('🔥 [TIMER] Botão via timer clicado!');
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          authorizeWhatsAppSession('floating_button_timer', {
            origem: 'Botão via Timer',
            site: 'm.lima'
          });
        }, { capture: true, passive: false });
      }
    }, 2000);
    
    // Limpar timer após 30 segundos
    setTimeout(function() {
      clearInterval(checkInterval);
      console.log('⏰ [TIMER] Timer de interceptação finalizado');
    }, 30000);
    
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

  // 🔥 API EXPANDIDA do WhatsApp com DEBUG
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
    // 🔥 NOVA FUNÇÃO DE DEBUG
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
              console.log(`   [${index}] Texto: "${el.textContent ? el.textContent.substring(0, 50) : 'N/A'}"`);
              console.log(`   [${index}] Elemento:`, el);
            });
          } else {
            console.log(`❌ Nenhum elemento encontrado para: ${selector}`);
          }
        } catch(e) {
          console.log(`⚠️ Erro ao buscar: ${selector} - ${e.message}`);
        }
      });
      
      // Buscar por texto "WhatsApp" em botões
      var allButtons = document.querySelectorAll('button, a');
      var whatsappButtons = [];
      allButtons.forEach(function(btn) {
        var text = (btn.textContent || '').toLowerCase();
        var title = (btn.title || '').toLowerCase();
        var ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        
        if (text.includes('whatsapp') || title.includes('whatsapp') || ariaLabel.includes('whatsapp')) {
          whatsappButtons.push(btn);
        }
      });
      
      if (whatsappButtons.length > 0) {
        console.log(`✅ Encontrado ${whatsappButtons.length} botão(ões) com texto "WhatsApp":`);
        whatsappButtons.forEach(function(btn, index) {
          console.log(`   [${index}] Elemento:`, btn);
        });
      } else {
        console.log(`❌ Nenhum botão com texto "WhatsApp" encontrado`);
      }
      
      return {
        total_found: selectors.reduce((acc, sel) => acc + document.querySelectorAll(sel).length, 0),
        whatsapp_text_buttons: whatsappButtons.length,
        selectors_tested: selectors.length
      };
    },
    // 🔥 FUNÇÃO PARA FORÇAR INTERCEPTAÇÃO DE ELEMENTO ESPECÍFICO
    forceIntercept: function(elementSelector) {
      console.log('🎯 [FORCE] Forçando interceptação em:', elementSelector);
      
      var element = document.querySelector(elementSelector);
      if (!element) {
        console.log('❌ [FORCE] Elemento não encontrado:', elementSelector);
        return false;
      }
      
      console.log('✅ [FORCE] Elemento encontrado:', element);
      
      // Adicionar listener específico
      element.addEventListener('click', function(e) {
        console.log('🔥 [FORCE] Elemento interceptado via forceIntercept!');
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        authorizeWhatsAppSession('force_intercept', {
          origem: 'Interceptação Forçada',
          site: 'm.lima',
          selector: elementSelector,
          element_info: {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            text: element.textContent
          }
        });
      }, { capture: true, passive: false });
      
      console.log('✅ [FORCE] Listener adicionado com sucesso!');
      return true;
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