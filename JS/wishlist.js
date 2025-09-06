// Wishlist functionality
class WishlistManager {
  constructor() {
    this.wishlistItems = []
    this.init()
  }

  async init() {
    if (!window.auth || !window.auth.isAuthenticated()) {
      this.showLoginPrompt()
      return
    }

    await this.loadWishlist()
    this.renderWishlist()
  }

  async loadWishlist() {
    try {
      this.showLoading(true)

      const response = await fetch("http://localhost:5013/api/wishlist", {
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        this.wishlistItems = await response.json()
      } else {
        throw new Error("Failed to load wishlist")
      }
    } catch (error) {
      console.error("Error loading wishlist:", error)
      this.showError("Failed to load wishlist")
    } finally {
      this.showLoading(false)
    }
  }

  renderWishlist() {
    const grid = document.getElementById("wishlistGrid")
    const emptyState = document.getElementById("emptyWishlist")

    if (this.wishlistItems.length === 0) {
      grid.style.display = "none"
      emptyState.style.display = "block"
      return
    }

    emptyState.style.display = "none"
    grid.style.display = "grid"

    grid.innerHTML = this.wishlistItems.map((item) => this.createWishlistCard(item)).join("")

    // Add event listeners
    grid.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".remove-wishlist-btn")) {
          const productId = card.dataset.productId
          this.viewProduct(productId)
        }
      })
    })

    grid.querySelectorAll(".remove-wishlist-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const productId = btn.dataset.productId
        this.removeFromWishlist(productId)
      })
    })
  }

  createWishlistCard(item) {
    const images = JSON.parse(item.images || "[]")
    const imageUrl = images.length > 0 ? `http://localhost:5013/uploads/${images[0]}` : "/product-placeholder.png"

    return `
            <div class="product-card" data-product-id="${item.id}">
                <div class="product-image">
                    <img src="${imageUrl}" alt="${item.title}" onerror="this.src='/product-placeholder.png'">
                    <button class="wishlist-btn remove-wishlist-btn active" data-product-id="${item.id}">
                        💔
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${item.title}</h3>
                    <div class="product-price">$${Number.parseFloat(item.price).toFixed(2)}</div>
                    <div class="product-meta">
                        <span class="product-condition">${item.condition}</span>
                        <span class="product-location">📍 ${item.seller_location || item.location}</span>
                    </div>
                    <div class="eco-score">
                        <span>🌱</span>
                        <span>Eco Score: ${item.eco_score}</span>
                    </div>
                    <div style="margin-top: var(--spacing-sm);">
                        <small style="color: var(--muted-foreground);">Sold by @${item.seller_name}</small>
                    </div>
                </div>
            </div>
        `
  }

  async removeFromWishlist(productId) {
    try {
      const response = await fetch(`http://localhost:5013/api/wishlist/${productId}`, {
        method: "DELETE",
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        // Remove from local array
        this.wishlistItems = this.wishlistItems.filter((item) => item.id != productId)
        this.renderWishlist()
        this.showMessage("Removed from wishlist")
      } else {
        throw new Error("Failed to remove from wishlist")
      }
    } catch (error) {
      console.error("Error removing from wishlist:", error)
      this.showError("Failed to remove from wishlist")
    }
  }

  viewProduct(productId) {
    // Navigate to marketplace with product modal
    window.location.href = `marketplace.html?product=${productId}`
  }

  showLoading(show) {
    const spinner = document.getElementById("loadingSpinner")
    const grid = document.getElementById("wishlistGrid")

    if (show) {
      spinner.style.display = "block"
      grid.style.display = "none"
    } else {
      spinner.style.display = "none"
    }
  }

  showError(message) {
    alert(message)
  }

  showMessage(message) {
    const toast = document.createElement("div")
    toast.textContent = message
    toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary);
            color: var(--primary-foreground);
            padding: var(--spacing-md);
            border-radius: var(--radius);
            z-index: 1000;
        `
    document.body.appendChild(toast)

    setTimeout(() => {
      document.body.removeChild(toast)
    }, 3000)
  }

  showLoginPrompt() {
    const grid = document.getElementById("wishlistGrid")
    const emptyState = document.getElementById("emptyWishlist")

    grid.style.display = "none"
    emptyState.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Login Required</h3>
        <p>Please log in to view your wishlist</p>
        <a href="login.html" class="btn btn-primary">Login</a>
      </div>
    `
    emptyState.style.display = "block"
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.wishlistManager = new WishlistManager()
})
