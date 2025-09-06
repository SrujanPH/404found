// Main application JavaScript
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop()
  const publicPages = ["index.html", "login.html", "register.html", ""]

  if (!publicPages.includes(currentPage) && window.auth && window.auth.isAuthenticated()) {
    // Update navigation for authenticated users
    updateNavigation()
  }

  // Add smooth scrolling for anchor links
  const anchorLinks = document.querySelectorAll('a[href^="#"]')
  anchorLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault()
      const target = document.querySelector(this.getAttribute("href"))
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
    })
  })

  // Add intersection observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1"
        entry.target.style.transform = "translateY(0)"
      }
    })
  }, observerOptions)

  // Observe elements for animation
  const animatedElements = document.querySelectorAll(".hero-content, .hero-image, .stat")
  animatedElements.forEach((el) => {
    el.style.opacity = "0"
    el.style.transform = "translateY(20px)"
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease"
    observer.observe(el)
  })
})

function updateNavigation() {
  const nav = document.querySelector(".nav")
  if (nav && window.auth && window.auth.user) {
    nav.innerHTML = `
            <a href="marketplace.html" class="nav-link">Marketplace</a>
            <a href="profile.html" class="nav-link">Profile</a>
            <a href="wishlist.html" class="nav-link">Wishlist</a>
            <a href="messages.html" class="nav-link">Messages</a>
            <button onclick="logout()" class="nav-link" style="background: none; border: none; cursor: pointer;">Logout</button>
        `
  }
}

function logout() {
  if (window.auth) {
    window.auth.clearAuth()
    window.location.href = "index.html"
  }
}

// Add global error handling
window.addEventListener("error", (e) => {
  console.error("Global error:", e.error)
})

// Add global unhandled promise rejection handling
window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e.reason)
})
