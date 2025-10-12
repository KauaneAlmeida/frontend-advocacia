/**
 * 🎯 CHAT WIDGET INTEGRADO COM BACKEND - COM AVATARES
 * Garante que o ícone abre/fecha corretamente o chat
 */

class ChatWidget {
    constructor() {
        this.isOpen = false;
        this.sessionId = null;
        this.messageCount = 0;
        this.flowCompleted = false;
        this.phoneCollected = false;
        this.currentStep = '';

        // 🔧 CONFIGURAÇÃO DO BACKEND
        this.backendUrl = this.detectBackendUrl();

        this.init();
    }

    detectBackendUrl() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        } else {
            return 'https://law-firm-backend-936902782519.us-central1.run.app';
        }
    }

    init() {
        this.createChatInterface();
        this.attachEventListeners();
        console.log('🚀 Chat Widget inicializado | Backend:', this.backendUrl);
    }

    createChatInterface() {
        // Botão launcher
        const launcher = document.createElement('div');
        launcher.className = 'chat-launcher';
        launcher.innerHTML = `
            <div class="chat-launcher-text">
                Fale com nosso assistente e seja direcionado a um advogado em minutos.
            </div>
            <div class="chat-launcher-icon">⚖️</div>
        `;
        document.body.appendChild(launcher);

        // Container do chat
        const chatRoot = document.createElement('div');
        chatRoot.id = 'chat-root';
        chatRoot.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    💼 Chat Advocacia — Escritório m.lima
                    <button class="chat-close-btn">×</button>
                    <div class="progress-bar"><div class="progress-fill"></div></div>
                </div>
                <div class="messages" id="chat-messages">
                    <div class="message bot">
                        <img src="assets/bot.png" alt="Bot" class="avatar">
                        <div class="bubble">Conectando com nosso sistema...</div>
                    </div>
                </div>
                <div class="input-area">
                    <input type="text" id="chat-input" placeholder="Digite sua mensagem..." disabled>
                    <button id="chat-send" disabled>Enviar</button>
                </div>
            </div>
        `;
        document.body.appendChild(chatRoot);
    }

    attachEventListeners() {
        // 🚀 Listeners globais (usando delegation para evitar problemas de timing)
        document.addEventListener("click", (e) => {
            if (e.target.closest(".chat-launcher")) {
                console.log("⚡ Clique no launcher detectado");
                this.toggleChat();
            }
            if (e.target.closest(".chat-close-btn")) {
                console.log("⚡ Clique no botão fechar detectado");
                this.closeChat();
            }
            if (e.target.closest("#chat-send")) {
                this.sendMessage();
            }
        });

        document.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && document.activeElement.id === "chat-input") {
                this.sendMessage();
            }
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const chatRoot = document.getElementById('chat-root');
        const launcher = document.querySelector('.chat-launcher');

        if (chatRoot && launcher) {
            chatRoot.classList.add('active');
            launcher.style.display = 'none';
            this.isOpen = true;

            if (!this.sessionId) {
                this.startConversation();
            }
        }
    }

    closeChat() {
        const chatRoot = document.getElementById('chat-root');
        const launcher = document.querySelector('.chat-launcher');

        if (chatRoot && launcher) {
            chatRoot.classList.remove('active');
            launcher.style.display = 'flex';
            this.isOpen = false;
        }
    }

    async startConversation() {
        try {
            console.log('🚀 Iniciando conversa com backend...');
            const response = await fetch(`${this.backendUrl}/api/v1/conversation/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = await response.json();
            this.sessionId = data.session_id;
            this.clearMessages();
            this.addBotMessage(data.response);
            this.enableInput();
        } catch (error) {
            console.error('❌ Erro ao iniciar conversa:', error);
            this.clearMessages();
            this.addBotMessage('Erro ao conectar, tente novamente mais tarde.');
        }
    }

    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || !this.sessionId) return;

        this.addUserMessage(message);
        input.value = '';
        this.disableInput();
        this.showTypingIndicator();

        try {
            const response = await fetch(`${this.backendUrl}/api/v1/conversation/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ message, session_id: this.sessionId })
            });

            const data = await response.json();
            this.hideTypingIndicator();
            this.addBotMessage(data.response);
            this.enableInput();
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem:', error);
            this.hideTypingIndicator();
            this.addBotMessage('Erro ao enviar, tente novamente.');
            this.enableInput();
        }
    }

    // === Helpers básicos ===
    clearMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) messagesContainer.innerHTML = '';
    }

    addBotMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.innerHTML = `
            <img src="assets/bot.png" alt="Bot" class="avatar">
            <div class="bubble">${message}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addUserMessage(message) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';
        messageDiv.innerHTML = `
            <div class="bubble">${message}</div>
            <img src="assets/user.png" alt="User" class="avatar">
        `;
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot typing-message';
        typingDiv.innerHTML = `
            <img src="assets/bot.png" alt="Bot" class="avatar">
            <div class="typing-indicator">Digitando<span></span><span></span><span></span></div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingMessage = document.querySelector('.typing-message');
        if (typingMessage) typingMessage.remove();
    }

    enableInput() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        if (input && sendBtn) {
            input.disabled = false;
            sendBtn.disabled = false;
        }
    }

    disableInput() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        if (input && sendBtn) {
            input.disabled = true;
            sendBtn.disabled = true;
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// 🚀 Iniciar assim que DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.chatWidget = new ChatWidget();
});