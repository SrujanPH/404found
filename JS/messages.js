// Messages functionality with Socket.io
import { io } from "socket.io-client"

class MessagingManager {
  constructor() {
    this.socket = null
    this.currentConversationId = null
    this.conversations = []
    this.messages = []
    this.typingTimeout = null
    this.isTyping = false

    this.init()
  }

  async init() {
    if (!window.auth || !window.auth.isAuthenticated()) {
      this.showLoginPrompt()
      return
    }

    this.setupEventListeners()
    this.connectSocket()
    await this.loadConversations()
    this.renderConversations()

    // Check if there's a conversation ID in URL params
    const urlParams = new URLSearchParams(window.location.search)
    const conversationId = urlParams.get("conversation")
    if (conversationId) {
      this.selectConversation(conversationId)
    }
  }

  connectSocket() {
    this.socket = io("http://localhost:5013", {
      auth: {
        token: window.auth.token,
      },
    })

    this.socket.on("connect", () => {
      console.log("Connected to server")
      this.updateConnectionStatus(true)
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server")
      this.updateConnectionStatus(false)
    })

    this.socket.on("new_message", (messageData) => {
      this.handleNewMessage(messageData)
    })

    this.socket.on("user_typing", (data) => {
      this.showTypingIndicator(data.username)
    })

    this.socket.on("user_stopped_typing", () => {
      this.hideTypingIndicator()
    })

    this.socket.on("error", (error) => {
      console.error("Socket error:", error)
      this.showError(error.message)
    })
  }

  setupEventListeners() {
    const messageInput = document.getElementById("messageInput")
    const sendBtn = document.getElementById("sendBtn")

    // Message input handling
    messageInput.addEventListener("input", (e) => {
      this.handleMessageInput(e)
    })

    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    // Send button
    sendBtn.addEventListener("click", () => {
      this.sendMessage()
    })

    // Auto-resize textarea
    messageInput.addEventListener("input", () => {
      messageInput.style.height = "auto"
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + "px"
    })
  }

  updateConnectionStatus(connected) {
    const statusDot = document.getElementById("connectionStatus")
    const statusText = document.getElementById("connectionText")

    if (connected) {
      statusDot.classList.add("connected")
      statusDot.classList.remove("disconnected")
      statusText.textContent = "Online"
    } else {
      statusDot.classList.add("disconnected")
      statusDot.classList.remove("connected")
      statusText.textContent = "Offline"
    }
  }

  async loadConversations() {
    try {
      const response = await fetch("http://localhost:5013/api/conversations", {
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        this.conversations = await response.json()
      } else {
        throw new Error("Failed to load conversations")
      }
    } catch (error) {
      console.error("Error loading conversations:", error)
      this.showError("Failed to load conversations")
    }
  }

  renderConversations() {
    const conversationsList = document.getElementById("conversationsList")
    const emptyState = document.getElementById("emptyConversations")

    if (this.conversations.length === 0) {
      conversationsList.style.display = "none"
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    conversationsList.style.display = "block"

    conversationsList.innerHTML = this.conversations.map((conv) => this.createConversationItem(conv)).join("")

    // Add click listeners
    conversationsList.querySelectorAll(".conversation-item").forEach((item) => {
      item.addEventListener("click", () => {
        const conversationId = item.dataset.conversationId
        this.selectConversation(conversationId)
      })
    })
  }

  createConversationItem(conversation) {
    const isCurrentUser = conversation.buyer_id === window.auth.user.id
    const otherUser = isCurrentUser ? conversation.seller_username : conversation.buyer_username
    const otherUserInitial = otherUser.charAt(0).toUpperCase()

    const productImages = JSON.parse(conversation.product_images || "[]")
    const lastMessageTime = conversation.last_message_time
      ? this.formatTime(conversation.last_message_time)
      : this.formatTime(conversation.created_at)

    const lastMessagePreview = conversation.last_message
      ? conversation.last_message.length > 50
        ? conversation.last_message.substring(0, 50) + "..."
        : conversation.last_message
      : "No messages yet"

    return `
            <div class="conversation-item" data-conversation-id="${conversation.id}">
                <div class="conversation-avatar">${otherUserInitial}</div>
                <div class="conversation-content">
                    <div class="conversation-header">
                        <h4 class="conversation-title">${otherUser}</h4>
                        <span class="conversation-time">${lastMessageTime}</span>
                    </div>
                    <div class="conversation-product">
                        <span>💰</span>
                        <span>${conversation.product_title} - $${Number.parseFloat(conversation.product_price).toFixed(2)}</span>
                    </div>
                    <div class="conversation-preview">${lastMessagePreview}</div>
                </div>
            </div>
        `
  }

  async selectConversation(conversationId) {
    // Leave current conversation room
    if (this.currentConversationId) {
      this.socket.emit("leave_conversation", this.currentConversationId)
    }

    this.currentConversationId = conversationId

    // Update UI
    document.querySelectorAll(".conversation-item").forEach((item) => {
      item.classList.remove("active")
    })

    const selectedItem = document.querySelector(`[data-conversation-id="${conversationId}"]`)
    if (selectedItem) {
      selectedItem.classList.add("active")
    }

    // Join new conversation room
    this.socket.emit("join_conversation", conversationId)

    // Load conversation details and messages
    await this.loadConversationDetails(conversationId)
    await this.loadMessages(conversationId)

    // Show chat container
    document.getElementById("noConversationSelected").style.display = "none"
    document.getElementById("chatContainer").style.display = "flex"

    this.renderMessages()
    this.scrollToBottom()
  }

  async loadConversationDetails(conversationId) {
    const conversation = this.conversations.find((c) => c.id == conversationId)
    if (!conversation) return

    const isCurrentUser = conversation.buyer_id === window.auth.user.id
    const otherUser = isCurrentUser ? conversation.seller_username : conversation.buyer_username
    const otherUserInitial = otherUser.charAt(0).toUpperCase()

    const chatHeader = document.getElementById("chatHeader")
    chatHeader.innerHTML = `
            <div class="chat-header-content">
                <div class="chat-avatar">${otherUserInitial}</div>
                <div class="chat-info">
                    <h3>${otherUser}</h3>
                    <div class="chat-product-info">
                        <span>💰</span>
                        <span>${conversation.product_title} - $${Number.parseFloat(conversation.product_price).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `
  }

  async loadMessages(conversationId) {
    try {
      const response = await fetch(`http://localhost:5013/api/messages/${conversationId}`, {
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        this.messages = await response.json()
      } else {
        throw new Error("Failed to load messages")
      }
    } catch (error) {
      console.error("Error loading messages:", error)
      this.showError("Failed to load messages")
    }
  }

  renderMessages() {
    const messagesArea = document.getElementById("messagesArea")

    if (this.messages.length === 0) {
      messagesArea.innerHTML = `
                <div style="text-align: center; color: var(--muted-foreground); padding: var(--spacing-xl);">
                    <div style="font-size: 2rem; margin-bottom: var(--spacing-md);">💬</div>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `
      return
    }

    messagesArea.innerHTML = this.messages.map((message) => this.createMessageElement(message)).join("")
  }

  createMessageElement(message) {
    const isOwn = message.sender_id === window.auth.user.id
    const senderInitial = message.sender_username.charAt(0).toUpperCase()
    const messageTime = this.formatTime(message.created_at)

    return `
            <div class="message ${isOwn ? "own" : ""}">
                <div class="message-avatar">${senderInitial}</div>
                <div class="message-content">
                    <div class="message-bubble">${this.escapeHtml(message.message)}</div>
                    <div class="message-time">${messageTime}</div>
                </div>
            </div>
        `
  }

  handleMessageInput(e) {
    const input = e.target
    const message = input.value.trim()
    const sendBtn = document.getElementById("sendBtn")
    const charCount = document.getElementById("charCount")

    // Update character count
    charCount.textContent = `${input.value.length}/1000`

    // Enable/disable send button
    sendBtn.disabled = message.length === 0

    // Handle typing indicators
    if (message.length > 0 && !this.isTyping) {
      this.isTyping = true
      this.socket.emit("typing_start", this.currentConversationId)
    }

    // Clear typing timeout
    clearTimeout(this.typingTimeout)

    // Set new timeout to stop typing indicator
    this.typingTimeout = setTimeout(() => {
      if (this.isTyping) {
        this.isTyping = false
        this.socket.emit("typing_stop", this.currentConversationId)
      }
    }, 1000)
  }

  sendMessage() {
    const messageInput = document.getElementById("messageInput")
    const message = messageInput.value.trim()

    if (!message || !this.currentConversationId) return

    // Stop typing indicator
    if (this.isTyping) {
      this.isTyping = false
      this.socket.emit("typing_stop", this.currentConversationId)
    }

    // Send message via socket
    this.socket.emit("send_message", {
      conversationId: this.currentConversationId,
      message: message,
    })

    // Clear input
    messageInput.value = ""
    messageInput.style.height = "auto"
    document.getElementById("sendBtn").disabled = true
    document.getElementById("charCount").textContent = "0/1000"
  }

  handleNewMessage(messageData) {
    // Add message to current conversation if it matches
    if (messageData.conversation_id == this.currentConversationId) {
      this.messages.push(messageData)

      // Re-render messages
      this.renderMessages()
      this.scrollToBottom()
    }

    // Update conversation list (move to top and update preview)
    this.updateConversationPreview(messageData)
  }

  updateConversationPreview(messageData) {
    // Find and update the conversation in the list
    const conversationIndex = this.conversations.findIndex((c) => c.id == messageData.conversation_id)
    if (conversationIndex !== -1) {
      this.conversations[conversationIndex].last_message = messageData.message
      this.conversations[conversationIndex].last_message_time = messageData.created_at

      // Move conversation to top
      const conversation = this.conversations.splice(conversationIndex, 1)[0]
      this.conversations.unshift(conversation)

      // Re-render conversations
      this.renderConversations()

      // Restore active state if needed
      if (this.currentConversationId) {
        const activeItem = document.querySelector(`[data-conversation-id="${this.currentConversationId}"]`)
        if (activeItem) {
          activeItem.classList.add("active")
        }
      }
    }
  }

  showTypingIndicator(username) {
    const typingIndicator = document.getElementById("typingIndicator")
    const typingText = typingIndicator.querySelector(".typing-text")

    typingText.textContent = `${username} is typing...`
    typingIndicator.style.display = "flex"

    this.scrollToBottom()
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById("typingIndicator")
    typingIndicator.style.display = "none"
  }

  scrollToBottom() {
    const messagesArea = document.getElementById("messagesArea")
    messagesArea.scrollTop = messagesArea.scrollHeight
  }

  formatTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString([], { weekday: "short" })
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" })
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  showError(message) {
    // Simple error display - could be enhanced with a toast system
    console.error(message)
    alert(message)
  }

  showLoginPrompt() {
    const mainContent = document.querySelector(".messages-content") || document.body
    mainContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: var(--spacing-xl);">
        <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🔒</div>
        <h2 style="margin-bottom: var(--spacing-md);">Login Required</h2>
        <p style="margin-bottom: var(--spacing-lg); color: var(--muted-foreground);">Please log in to view your messages</p>
        <a href="login.html" class="btn btn-primary">Login</a>
      </div>
    `
  }
}

// Global function to start conversation (called from marketplace)
window.startConversation = async (productId, sellerId) => {
  if (!window.auth || !window.auth.isAuthenticated()) {
    alert("Please log in to contact sellers")
    window.location.href = "login.html"
    return
  }

  try {
    const response = await fetch("http://localhost:5013/api/conversations", {
      method: "POST",
      headers: window.auth.getAuthHeaders(),
      body: JSON.stringify({ productId, sellerId }),
    })

    const result = await response.json()

    if (response.ok) {
      window.location.href = `messages.html?conversation=${result.conversationId}`
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error("Error starting conversation:", error)
    alert("Failed to start conversation")
  }
}

// Initialize messaging when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.messagingManager = new MessagingManager()
})
