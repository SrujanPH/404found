// Marketplace functionality
class MarketplaceManager {
  constructor() {
    this.products = []
    this.filteredProducts = []
    this.currentView = "grid"
    this.filters = {
      search: "",
      category: "",
      condition: "",
      minPrice: "",
      maxPrice: "",
      location: "",
      sortBy: "newest",
    }

    this.init()
  }

  async init() {
    this.setupEventListeners()
    await this.loadProducts()
    this.renderProducts()
  }

  setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById("searchInput")
    const searchBtn = document.getElementById("searchBtn")

    searchInput.addEventListener("input", (e) => {
      this.filters.search = e.target.value
      this.debounceFilter()
    })

    searchBtn.addEventListener("click", () => this.applyFilters())

    // Filter controls
    document.getElementById("categoryFilter").addEventListener("change", (e) => {
      this.filters.category = e.target.value
      this.applyFilters()
    })

    document.getElementById("conditionFilter").addEventListener("change", (e) => {
      this.filters.condition = e.target.value
      this.applyFilters()
    })

    document.getElementById("minPrice").addEventListener("input", (e) => {
      this.filters.minPrice = e.target.value
      this.debounceFilter()
    })

    document.getElementById("maxPrice").addEventListener("input", (e) => {
      this.filters.maxPrice = e.target.value
      this.debounceFilter()
    })

    document.getElementById("locationFilter").addEventListener("input", (e) => {
      this.filters.location = e.target.value
      this.debounceFilter()
    })

    document.getElementById("sortBy").addEventListener("change", (e) => {
      this.filters.sortBy = e.target.value
      this.applyFilters()
    })

    document.getElementById("clearFilters").addEventListener("click", () => {
      this.clearFilters()
    })

    // View toggle
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const view = e.target.dataset.view
        this.setView(view)
      })
    })

    // Modal functionality
    document.getElementById("closeModal").addEventListener("click", () => {
      this.closeModal()
    })

    document.getElementById("productModal").addEventListener("click", (e) => {
      if (e.target.id === "productModal") {
        this.closeModal()
      }
    })
  }

  debounceFilter() {
    clearTimeout(this.filterTimeout)
    this.filterTimeout = setTimeout(() => {
      this.applyFilters()
    }, 300)
  }

  async loadProducts() {
    try {
      this.showLoading(true)

      const queryParams = new URLSearchParams()
      Object.entries(this.filters).forEach(([key, value]) => {
        if (value) {
          if (key === "search") queryParams.append("search", value)
          else if (key === "sortBy") queryParams.append("sortBy", value)
          else queryParams.append(key, value)
        }
      })

      const response = await fetch(`http://localhost:5013/api/products?${queryParams}`)
      const products = await response.json()

      this.products = products
      this.filteredProducts = products
    } catch (error) {
      console.error("Error loading products:", error)
      this.showError("Failed to load products. Please try again.")
    } finally {
      this.showLoading(false)
    }
  }

  applyFilters() {
    this.loadProducts().then(() => {
      this.renderProducts()
    })
  }

  clearFilters() {
    // Reset all filter inputs
    document.getElementById("searchInput").value = ""
    document.getElementById("categoryFilter").value = ""
    document.getElementById("conditionFilter").value = ""
    document.getElementById("minPrice").value = ""
    document.getElementById("maxPrice").value = ""
    document.getElementById("locationFilter").value = ""
    document.getElementById("sortBy").value = "newest"

    // Reset filter object
    this.filters = {
      search: "",
      category: "",
      condition: "",
      minPrice: "",
      maxPrice: "",
      location: "",
      sortBy: "newest",
    }

    this.applyFilters()
  }

  setView(view) {
    this.currentView = view

    // Update button states
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-view="${view}"]`).classList.add("active")

    // Update grid class
    const grid = document.getElementById("productsGrid")
    if (view === "list") {
      grid.classList.add("list-view")
    } else {
      grid.classList.remove("list-view")
    }
  }

  renderProducts() {
    const grid = document.getElementById("productsGrid")
    const resultsCount = document.getElementById("resultsCount")
    const noResults = document.getElementById("noResults")

    // Update results count
    resultsCount.textContent = `${this.filteredProducts.length} items found`

    if (this.filteredProducts.length === 0) {
      grid.innerHTML = ""
      noResults.style.display = "block"
      return
    }

    noResults.style.display = "none"

    grid.innerHTML = this.filteredProducts.map((product) => this.createProductCard(product)).join("")

    // Add event listeners to product cards
    grid.querySelectorAll(".product-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (!e.target.closest(".wishlist-btn")) {
          const productId = card.dataset.productId
          this.showProductModal(productId)
        }
      })
    })

    // Add event listeners to wishlist buttons
    grid.querySelectorAll(".wishlist-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation()
        const productId = btn.dataset.productId
        this.toggleWishlist(productId, btn)
      })
    })
  }

  createProductCard(product) {
    const images = JSON.parse(product.images || "[]")
    const imageUrl = images.length > 0 ? `http://localhost:5013/uploads/${images[0]}` : "/product-placeholder.png"

    return `
            <div class="product-card" data-product-id="${product.id}">
                <div class="product-image">
                    <img src="${imageUrl}" alt="${product.title}" onerror="this.src='/product-placeholder.png'">
                    <button class="wishlist-btn" data-product-id="${product.id}">
                        💚
                    </button>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <div class="product-price">$${Number.parseFloat(product.price).toFixed(2)}</div>
                    <div class="product-meta">
                        <span class="product-condition">${product.condition}</span>
                        <span class="product-location">📍 ${product.seller_location || product.location}</span>
                    </div>
                    <div class="eco-score">
                        <span>🌱</span>
                        <span>Eco Score: ${product.eco_score}</span>
                    </div>
                </div>
            </div>
        `
  }

  async showProductModal(productId) {
    const product = this.filteredProducts.find((p) => p.id == productId)
    if (!product) return

    const modal = document.getElementById("productModal")
    const modalBody = document.getElementById("modalBody")

    const images = JSON.parse(product.images || "[]")
    const imageGallery =
      images.length > 0
        ? images
            .map(
              (img) =>
                `<img src="http://localhost:5013/uploads/${img}" alt="${product.title}" style="width: 100%; max-width: 400px; border-radius: var(--radius); margin-bottom: var(--spacing-md);">`,
            )
            .join("")
        : `<img src="/placeholder-n25op.png" alt="${product.title}" style="width: 100%; max-width: 400px; border-radius: var(--radius); margin-bottom: var(--spacing-md);">`

    modalBody.innerHTML = `
            <div style="display: flex; gap: var(--spacing-xl); flex-wrap: wrap;">
                <div style="flex: 1; min-width: 300px;">
                    ${imageGallery}
                </div>
                <div style="flex: 1; min-width: 300px;">
                    <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--spacing-md);">${product.title}</h2>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: var(--spacing-md);">$${Number.parseFloat(product.price).toFixed(2)}</div>
                    
                    <div style="display: flex; gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
                        <span class="product-condition">${product.condition}</span>
                        <span style="color: var(--muted-foreground);">📍 ${product.seller_location || product.location}</span>
                        <span style="color: var(--primary);">🌱 Eco Score: ${product.eco_score}</span>
                    </div>
                    
                    <div style="margin-bottom: var(--spacing-lg);">
                        <h3 style="font-weight: 600; margin-bottom: var(--spacing-sm);">Description</h3>
                        <p style="color: var(--muted-foreground); line-height: 1.6;">${product.description}</p>
                    </div>
                    
                    <div style="margin-bottom: var(--spacing-lg);">
                        <h3 style="font-weight: 600; margin-bottom: var(--spacing-sm);">Seller</h3>
                        <p style="color: var(--muted-foreground);">@${product.seller_name}</p>
                    </div>
                    
                    <div style="display: flex; gap: var(--spacing-md);">
                        <button class="btn btn-primary" onclick="marketplace.contactSeller(${product.id})">Contact Seller</button>
                        <button class="btn btn-secondary" onclick="marketplace.toggleWishlist(${product.id})">Add to Wishlist</button>
                    </div>
                </div>
            </div>
        `

    modal.style.display = "flex"
  }

  closeModal() {
    document.getElementById("productModal").style.display = "none"
  }

  async toggleWishlist(productId, buttonElement) {
    if (!window.auth || !window.auth.isAuthenticated()) {
      alert("Please log in to add items to your wishlist")
      window.location.href = "login.html"
      return
    }

    try {
      const response = await fetch(`http://localhost:5013/api/wishlist/${productId}`, {
        method: "POST",
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        if (buttonElement) {
          buttonElement.classList.toggle("active")
        }
        // Show success message
        this.showMessage("Added to wishlist!")
      }
    } catch (error) {
      console.error("Error toggling wishlist:", error)
      this.showError("Failed to update wishlist")
    }
  }

  contactSeller(productId) {
    if (!window.auth || !window.auth.isAuthenticated()) {
      alert("Please log in to contact sellers")
      window.location.href = "login.html"
      return
    }

    const product = this.filteredProducts.find((p) => p.id == productId)
    if (product) {
      window.startConversation(productId, product.seller_id)
    }
  }

  showLoading(show) {
    const spinner = document.getElementById("loadingSpinner")
    const grid = document.getElementById("productsGrid")

    if (show) {
      spinner.style.display = "block"
      grid.style.display = "none"
    } else {
      spinner.style.display = "none"
      grid.style.display = "grid"
    }
  }

  showError(message) {
    // Simple error display - could be enhanced with a toast system
    alert(message)
  }

  showMessage(message) {
    // Simple message display - could be enhanced with a toast system
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
}

// Global functions
function clearAllFilters() {
  if (window.marketplace) {
    window.marketplace.clearFilters()
  }
}

// Initialize marketplace when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.marketplace = new MarketplaceManager()
})
