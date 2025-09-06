// API Configuration
const API_BASE_URL = "http://localhost:5013/api"

// Authentication utilities
class AuthManager {
  constructor() {
    this.token = localStorage.getItem("authToken")
    this.user = JSON.parse(localStorage.getItem("user") || "null")
  }

  setAuth(token, user) {
    this.token = token
    this.user = user
    localStorage.setItem("authToken", token)
    localStorage.setItem("user", JSON.stringify(user))
  }

  clearAuth() {
    this.token = null
    this.user = null
    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
  }

  isAuthenticated() {
    return !!this.token
  }

  getAuthHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    }
  }
}

const auth = new AuthManager()

// API Helper functions
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  }

  console.log("[v0] Making API request to:", url)
  console.log("[v0] Request config:", config)

  try {
    const response = await fetch(url, config)
    console.log("[v0] Response status:", response.status)
    console.log("[v0] Response ok:", response.ok)

    const data = await response.json()
    console.log("[v0] Response data:", data)

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong")
    }

    return data
  } catch (error) {
    console.error("[v0] API Request failed:", error)
    console.error("[v0] Error details:", error.message)
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      throw new Error("Cannot connect to server. Make sure the backend is running on port 5013.")
    }
    throw error
  }
}

// Form validation utilities
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function validatePassword(password) {
  return password.length >= 6
}

function showError(message, elementId = "errorMessage") {
  const errorElement = document.getElementById(elementId)
  if (errorElement) {
    errorElement.textContent = message
    errorElement.style.display = "block"
    setTimeout(() => {
      errorElement.style.display = "none"
    }, 5000)
  }
}

function showLoading(buttonId, show = true) {
  const button = document.getElementById(buttonId)
  const btnText = button.querySelector(".btn-text")
  const btnLoader = button.querySelector(".btn-loader")

  if (show) {
    btnText.style.display = "none"
    btnLoader.style.display = "inline-block"
    button.disabled = true
  } else {
    btnText.style.display = "inline-block"
    btnLoader.style.display = "none"
    button.disabled = false
  }
}

// Login functionality
async function handleLogin(event) {
  event.preventDefault()

  const form = event.target
  const formData = new FormData(form)
  const email = formData.get("email")
  const password = formData.get("password")

  // Validation
  if (!validateEmail(email)) {
    showError("Please enter a valid email address")
    return
  }

  if (!validatePassword(password)) {
    showError("Password must be at least 6 characters long")
    return
  }

  showLoading("loginBtn", true)

  try {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })

    auth.setAuth(response.token, response.user)

    window.location.href = "marketplace.html"
  } catch (error) {
    showError(error.message)
  } finally {
    showLoading("loginBtn", false)
  }
}

// Registration functionality
async function handleRegister(event) {
  event.preventDefault()

  const form = event.target
  const formData = new FormData(form)
  const fullName = formData.get("fullName")
  const username = formData.get("username")
  const email = formData.get("email")
  const location = formData.get("location")
  const password = formData.get("password")
  const confirmPassword = formData.get("confirmPassword")
  const terms = formData.get("terms")

  // Validation
  if (!fullName.trim()) {
    showError("Please enter your full name")
    return
  }

  if (!username.trim() || username.length < 3) {
    showError("Username must be at least 3 characters long")
    return
  }

  if (!validateEmail(email)) {
    showError("Please enter a valid email address")
    return
  }

  if (!location.trim()) {
    showError("Please enter your location")
    return
  }

  if (!validatePassword(password)) {
    showError("Password must be at least 6 characters long")
    return
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match")
    return
  }

  if (!terms) {
    showError("Please accept the terms of service")
    return
  }

  showLoading("registerBtn", true)

  try {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName,
        username,
        email,
        location,
        password,
      }),
    })

    auth.setAuth(response.token, response.user)

    // Show success message and redirect
    alert("Account created successfully! Welcome to EcoMarket!")
    window.location.href = "marketplace.html"
  } catch (error) {
    showError(error.message)
  } finally {
    showLoading("registerBtn", false)
  }
}

// Google OAuth placeholder (would need actual Google OAuth setup)
function handleGoogleAuth() {
  alert("Google OAuth integration would be implemented here with actual Google OAuth credentials")
}

// Initialize page functionality
document.addEventListener("DOMContentLoaded", () => {
  // Login form
  const loginForm = document.getElementById("loginForm")
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin)
  }

  // Register form
  const registerForm = document.getElementById("registerForm")
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegister)
  }

  // Google auth buttons
  const googleLoginBtn = document.getElementById("googleLoginBtn")
  const googleRegisterBtn = document.getElementById("googleRegisterBtn")

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", handleGoogleAuth)
  }

  if (googleRegisterBtn) {
    googleRegisterBtn.addEventListener("click", handleGoogleAuth)
  }

  // Password confirmation validation
  const confirmPasswordInput = document.getElementById("confirmPassword")
  const passwordInput = document.getElementById("password")

  if (confirmPasswordInput && passwordInput) {
    confirmPasswordInput.addEventListener("input", function () {
      if (this.value && this.value !== passwordInput.value) {
        this.setCustomValidity("Passwords do not match")
      } else {
        this.setCustomValidity("")
      }
    })
  }

  // Real-time email validation
  const emailInputs = document.querySelectorAll('input[type="email"]')
  emailInputs.forEach((input) => {
    input.addEventListener("blur", function () {
      if (this.value && !validateEmail(this.value)) {
        this.setCustomValidity("Please enter a valid email address")
      } else {
        this.setCustomValidity("")
      }
    })
  })
})

// Export for use in other modules
window.AuthManager = AuthManager
window.auth = auth
