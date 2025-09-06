const API_BASE = "http://localhost:5013/api"

// Profile management
class ProfileManager {
  constructor() {
    this.currentUser = null
    this.init()
  }

  async init() {
    await this.loadUserProfile()
    this.setupEventListeners()
    this.setupTabs()
  }

  async loadUserProfile() {
    try {
      const token = localStorage.getItem("authToken")
      console.log("[v0] Profile: AuthToken exists:", !!token) // Updated debug logging

      if (!token) {
        console.log("[v0] Profile: No authToken found, showing login prompt") // Updated debug logging
        this.showLoginPrompt()
        return
      }

      console.log("[v0] Profile: Making API call to load profile") // Updated debug logging
      const response = await fetch(`${API_BASE}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      console.log("[v0] Profile: API response status:", response.status) // Added debug logging

      if (response.ok) {
        this.currentUser = await response.json()
        console.log("[v0] Profile: User data loaded:", this.currentUser) // Added debug logging
        this.displayUserInfo()
        this.loadUserStats()
        this.loadUserListings()
        this.loadUserPurchases()
      } else {
        const errorText = await response.text()
        console.log("[v0] Profile: API error:", errorText) // Added debug logging
        throw new Error("Failed to load profile")
      }
    } catch (error) {
      console.error("[v0] Profile: Error loading profile:", error) // Enhanced error logging
  localStorage.removeItem("authToken")
      this.showLoginPrompt()
    }
  }

  displayUserInfo() {
    document.getElementById("userName").textContent = this.currentUser.full_name || "User"
    document.getElementById("userEmail").textContent = this.currentUser.email || ""
    document.getElementById("userLocation").textContent = this.currentUser.location || "Location not set"

    // Fill settings form
    document.getElementById("settingsName").value = this.currentUser.full_name || ""
    document.getElementById("settingsEmail").value = this.currentUser.email || ""
    document.getElementById("settingsLocation").value = this.currentUser.location || ""
    document.getElementById("settingsBio").value = this.currentUser.bio || ""
  }

  async loadUserStats() {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/users/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const stats = await response.json()
        document.getElementById("itemsSold").textContent = stats.items_sold || 0
        document.getElementById("itemsBought").textContent = stats.items_bought || 0
        document.getElementById("ecoScore").textContent = stats.eco_score || 0
      }
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  async loadUserListings() {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/products/my-listings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const listings = await response.json()
        this.displayListings(listings)
      }
    } catch (error) {
      console.error("Error loading listings:", error)
    }
  }

  async loadUserPurchases() {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/users/purchases`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const purchases = await response.json()
        this.displayPurchases(purchases)
      }
    } catch (error) {
      console.error("Error loading purchases:", error)
    }
  }

  displayListings(listings) {
    const container = document.getElementById("userListings")
    const emptyState = document.getElementById("emptyListings")

    if (listings.length === 0) {
      container.style.display = "none"
      emptyState.style.display = "block"
      return
    }

    container.style.display = "grid"
    emptyState.style.display = "none"

    container.innerHTML = listings
      .map(
        (item) => `
            <div class="listing-card">
                <div class="listing-image">
                    <img src="${item.image_url || "/placeholder.svg?height=200&width=200"}" alt="${item.title}">
                </div>
                <div class="listing-content">
                    <h4>${item.title}</h4>
                    <p class="listing-price">$${item.price}</p>
                    <p class="listing-status status-${item.status}">${item.status}</p>
                    <div class="listing-actions">
                        <button class="btn btn-sm btn-secondary" onclick="editListing(${item.id})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteListing(${item.id})">Delete</button>
                    </div>
                </div>
            </div>
        `,
      )
      .join("")
  }

  displayPurchases(purchases) {
    const container = document.getElementById("userPurchases")
    const emptyState = document.getElementById("emptyPurchases")

    if (purchases.length === 0) {
      container.style.display = "none"
      emptyState.style.display = "block"
      return
    }

    container.style.display = "block"
    emptyState.style.display = "none"

    container.innerHTML = purchases
      .map(
        (item) => `
            <div class="purchase-card">
                <div class="purchase-image">
                    <img src="${item.image_url || "/placeholder.svg?height=100&width=100"}" alt="${item.title}">
                </div>
                <div class="purchase-content">
                    <h4>${item.title}</h4>
                    <p class="purchase-price">$${item.price}</p>
                    <p class="purchase-date">Purchased: ${new Date(item.created_at).toLocaleDateString()}</p>
                    <p class="eco-impact">🌍 Saved ${item.carbon_saved || 0}kg CO₂</p>
                </div>
            </div>
        `,
      )
      .join("")
  }

  setupTabs() {
    const tabBtns = document.querySelectorAll(".tab-btn")
    const tabContents = document.querySelectorAll(".tab-content")

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab

        // Remove active class from all tabs and contents
        tabBtns.forEach((b) => b.classList.remove("active"))
        tabContents.forEach((c) => c.classList.remove("active"))

        // Add active class to clicked tab and corresponding content
        btn.classList.add("active")
        document.getElementById(`${targetTab}-tab`).classList.add("active")
      })
    })
  }

  setupEventListeners() {
    document.getElementById("saveSettingsBtn").addEventListener("click", () => this.saveSettings())
    document.getElementById("logoutBtn").addEventListener("click", () => this.logout())
  }

  async saveSettings() {
    try {
      const token = localStorage.getItem("token")
      const formData = {
        full_name: document.getElementById("settingsName").value,
        location: document.getElementById("settingsLocation").value,
        bio: document.getElementById("settingsBio").value,
      }

      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        alert("Profile updated successfully!")
        await this.loadUserProfile()
      } else {
        throw new Error("Failed to update profile")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      alert("Failed to update profile. Please try again.")
    }
  }

  logout() {
    localStorage.removeItem("token")
    window.location.href = "index.html"
  }

  showLoginPrompt() {
    const mainContent = document.querySelector(".profile-content") || document.body
    mainContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: var(--spacing-xl);">
        <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🔒</div>
        <h2 style="margin-bottom: var(--spacing-md);">Login Required</h2>
        <p style="margin-bottom: var(--spacing-lg); color: var(--muted-foreground);">Please log in to view your profile</p>
        <a href="login.html" class="btn btn-primary">Login</a>
      </div>
    `
  }
}

// Global functions for listing actions
async function editListing(id) {
  // Redirect to edit page or show modal
  window.location.href = `add-product.html?edit=${id}`
}

async function deleteListing(id) {
  if (confirm("Are you sure you want to delete this listing?")) {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_BASE}/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        alert("Listing deleted successfully!")
        profileManager.loadUserListings()
      } else {
        throw new Error("Failed to delete listing")
      }
    } catch (error) {
      console.error("Error deleting listing:", error)
      alert("Failed to delete listing. Please try again.")
    }
  }
}

// Initialize profile manager
const profileManager = new ProfileManager()
