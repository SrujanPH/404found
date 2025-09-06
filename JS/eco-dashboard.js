// Eco Dashboard functionality
class EcoDashboard {
  constructor() {
    this.userStats = {}
    this.communityStats = {}
    this.badges = []
    this.transactions = []

    this.init()
  }

  async init() {
    if (!window.auth || !window.auth.isAuthenticated()) {
      this.showLoginPrompt()
      return
    }

    this.setupEventListeners()
    await this.loadAllData()
    this.renderDashboard()
  }

  showLoginPrompt() {
    const mainContent = document.querySelector(".dashboard-content") || document.body
    mainContent.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: var(--spacing-xl);">
        <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🔒</div>
        <h2 style="margin-bottom: var(--spacing-md);">Login Required</h2>
        <p style="margin-bottom: var(--spacing-lg); color: var(--muted-foreground);">Please log in to view your eco dashboard</p>
        <a href="login.html" class="btn btn-primary">Login</a>
      </div>
    `
  }

  setupEventListeners() {
    // Calculator functionality
    document
      .getElementById("calculateBtn")
      .addEventListener("click", () => {
        this.calculateFootprint()
      })

    // Auto-calculate when inputs change
    ;["calcCategory", "calcCondition", "calcPrice"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        if (document.getElementById("calcPrice").value) {
          this.calculateFootprint()
        }
      })
    })
  }

  async loadAllData() {
    try {
      await Promise.all([
        this.loadUserStats(),
        this.loadCommunityStats(),
        this.loadBadges(),
        this.loadTransactions(),
        this.checkBadges(),
      ])
    } catch (error) {
      console.error("Error loading dashboard data:", error)
    }
  }

  async loadUserStats() {
    try {
      const response = await fetch("http://localhost:5013/api/transactions/user", {
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        this.transactions = await response.json()
        this.calculatePersonalStats()
      }
    } catch (error) {
      console.error("Error loading user stats:", error)
    }
  }

  calculatePersonalStats() {
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()

    const monthlyTransactions = this.transactions.filter((t) => {
      const transactionDate = new Date(t.created_at)
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
    })

    this.userStats = {
      carbonSaved: monthlyTransactions.reduce((sum, t) => sum + (t.carbon_saved || 0), 0),
      waterSaved: monthlyTransactions.reduce((sum, t) => sum + (t.water_saved || 0), 0),
      moneySaved: monthlyTransactions.reduce((sum, t) => sum + t.amount * 0.3, 0),
      ecoScore: window.auth.user.ecoScore || 0,
      transactionCount: monthlyTransactions.length,
    }
  }

  async loadCommunityStats() {
    try {
      const response = await fetch("http://localhost:5013/api/eco/community-stats")

      if (response.ok) {
        this.communityStats = await response.json()
      }
    } catch (error) {
      console.error("Error loading community stats:", error)
    }
  }

  async loadBadges() {
    try {
      const response = await fetch(`http://localhost:5013/api/eco/badges/${window.auth.user.id}`, {
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        this.badges = await response.json()
      }
    } catch (error) {
      console.error("Error loading badges:", error)
    }
  }

  async loadTransactions() {
    // Already loaded in loadUserStats
  }

  async checkBadges() {
    try {
      const response = await fetch("http://localhost:5013/api/eco/check-badges", {
        method: "POST",
        headers: window.auth.getAuthHeaders(),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.newBadges && result.newBadges.length > 0) {
          this.showNewBadges(result.newBadges)
        }
      }
    } catch (error) {
      console.error("Error checking badges:", error)
    }
  }

  renderDashboard() {
    this.renderPersonalImpact()
    this.renderBadges()
    this.renderCommunityStats()
    this.renderTransactions()
  }

  renderPersonalImpact() {
    // Carbon saved
    document.getElementById("personalCarbon").textContent = `${this.userStats.carbonSaved?.toFixed(1) || 0} kg`
    const treesEquivalent = Math.round((this.userStats.carbonSaved || 0) / 22) // 1 tree absorbs ~22kg CO2/year
    document.getElementById("treesEquivalent").textContent = treesEquivalent

    // Water saved
    const waterSaved = this.userStats.waterSaved || 0
    document.getElementById("personalWater").textContent = `${waterSaved.toLocaleString()} L`
    const showersEquivalent = Math.round(waterSaved / 150) // Average shower uses 150L
    document.getElementById("showersEquivalent").textContent = showersEquivalent

    // Money saved
    document.getElementById("personalMoney").textContent = `$${(this.userStats.moneySaved || 0).toFixed(2)}`

    // Eco score
    document.getElementById("ecoScore").textContent = this.userStats.ecoScore || 0
  }

  renderBadges() {
    const badgesGrid = document.getElementById("badgesGrid")
    const progressList = document.getElementById("progressList")

    // All available badges
    const allBadges = [
      {
        id: 1,
        name: "Eco Starter",
        description: "Complete your first transaction",
        icon: "🌱",
        requirement: 1,
        type: "transactions",
      },
      { id: 2, name: "Eco Saver", description: "Buy or sell 5 items", icon: "♻️", requirement: 5, type: "transactions" },
      {
        id: 3,
        name: "Green Champion",
        description: "Reach 100 eco score",
        icon: "🏆",
        requirement: 100,
        type: "eco_score",
      },
      {
        id: 4,
        name: "Carbon Crusher",
        description: "Save 50kg of CO₂",
        icon: "🌍",
        requirement: 50,
        type: "carbon_saved",
      },
      {
        id: 5,
        name: "Water Warrior",
        description: "Save 1000L of water",
        icon: "💧",
        requirement: 1000,
        type: "water_saved",
      },
    ]

    const earnedBadgeIds = this.badges.map((b) => b.badge_id)

    // Render badges
    badgesGrid.innerHTML = allBadges
      .map((badge) => {
        const isEarned = earnedBadgeIds.includes(badge.id)
        return `
                <div class="badge-item ${isEarned ? "earned" : ""}">
                    <div class="badge-icon">${badge.icon}</div>
                    <div class="badge-name">${badge.name}</div>
                    <div class="badge-description">${badge.description}</div>
                </div>
            `
      })
      .join("")

    // Render progress for unearned badges
    const unearnedBadges = allBadges.filter((badge) => !earnedBadgeIds.includes(badge.id))

    progressList.innerHTML = unearnedBadges
      .map((badge) => {
        let currentValue = 0
        let percentage = 0

        switch (badge.type) {
          case "transactions":
            currentValue = this.userStats.transactionCount || 0
            break
          case "eco_score":
            currentValue = this.userStats.ecoScore || 0
            break
          case "carbon_saved":
            currentValue = this.transactions.reduce((sum, t) => sum + (t.carbon_saved || 0), 0)
            break
          case "water_saved":
            currentValue = this.transactions.reduce((sum, t) => sum + (t.water_saved || 0), 0)
            break
        }

        percentage = Math.min((currentValue / badge.requirement) * 100, 100)

        return `
                <div class="progress-item">
                    <div class="progress-header">
                        <span class="progress-name">${badge.name}</span>
                        <span class="progress-percentage">${Math.round(percentage)}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `
      })
      .join("")
  }

  renderCommunityStats() {
    document.getElementById("totalUsers").textContent = (this.communityStats.total_users || 0).toLocaleString()
    document.getElementById("totalProducts").textContent = (this.communityStats.total_products || 0).toLocaleString()
    document.getElementById("totalCarbon").textContent =
      `${(this.communityStats.total_carbon_saved || 0).toLocaleString()} kg`
    document.getElementById("totalWater").textContent =
      `${(this.communityStats.total_water_saved || 0).toLocaleString()} L`
  }

  renderTransactions() {
    const transactionsList = document.getElementById("transactionsList")
    const emptyTransactions = document.getElementById("emptyTransactions")

    if (this.transactions.length === 0) {
      transactionsList.style.display = "none"
      emptyTransactions.style.display = "block"
      return
    }

    emptyTransactions.style.display = "none"
    transactionsList.style.display = "block"

    // Show only recent transactions (last 10)
    const recentTransactions = this.transactions.slice(0, 10)

    transactionsList.innerHTML = recentTransactions
      .map((transaction) => {
        const images = JSON.parse(transaction.product_images || "[]")
        const imageUrl = images.length > 0 ? `http://localhost:5013/uploads/${images[0]}` : "/product-placeholder.png"

        const transactionDate = new Date(transaction.created_at).toLocaleDateString()

        return `
                <div class="transaction-item">
                    <div class="transaction-image">
                        <img src="${imageUrl}" alt="${transaction.product_title}" onerror="this.src='/product-placeholder.png'">
                    </div>
                    <div class="transaction-content">
                        <div class="transaction-header">
                            <div class="transaction-title">${transaction.product_title}</div>
                            <div class="transaction-type ${transaction.transaction_type}">${transaction.transaction_type}</div>
                        </div>
                        <div class="transaction-meta">
                            <span>$${Number.parseFloat(transaction.amount).toFixed(2)}</span>
                            <span>${transactionDate}</span>
                            <span>${transaction.transaction_type === "purchase" ? "from" : "to"} @${transaction.transaction_type === "purchase" ? transaction.seller_username : transaction.buyer_username}</span>
                        </div>
                        <div class="transaction-impact">
                            <div class="impact-stat">
                                <span>🌍</span>
                                <span>${(transaction.carbon_saved || 0).toFixed(1)} kg CO₂</span>
                            </div>
                            <div class="impact-stat">
                                <span>💧</span>
                                <span>${(transaction.water_saved || 0).toLocaleString()} L</span>
                            </div>
                        </div>
                    </div>
                </div>
            `
      })
      .join("")
  }

  async calculateFootprint() {
    const category = document.getElementById("calcCategory").value
    const condition = document.getElementById("calcCondition").value
    const price = Number.parseFloat(document.getElementById("calcPrice").value)

    if (!price || price <= 0) {
      alert("Please enter a valid price")
      return
    }

    try {
      const response = await fetch("http://localhost:5013/api/eco/calculate-footprint", {
        method: "POST",
        headers: window.auth.getAuthHeaders(),
        body: JSON.stringify({ category, condition, price }),
      })

      if (response.ok) {
        const result = await response.json()
        this.displayCalculatorResults(result)
      } else {
        throw new Error("Failed to calculate footprint")
      }
    } catch (error) {
      console.error("Error calculating footprint:", error)
      alert("Failed to calculate environmental impact")
    }
  }

  displayCalculatorResults(result) {
    document.getElementById("calcCarbon").textContent = `${result.carbon_saved} kg`
    document.getElementById("calcWater").textContent = `${result.water_saved.toLocaleString()} L`
    document.getElementById("calcMoney").textContent = `$${result.money_saved}`

    document.getElementById("calculatorResults").style.display = "block"
  }

  showNewBadges(newBadges) {
    // Simple alert for new badges - could be enhanced with a modal
    const badgeNames = newBadges.map((b) => b.name).join(", ")
    alert(`Congratulations! You've earned new badges: ${badgeNames}`)

    // Reload badges to show the new ones
    this.loadBadges().then(() => {
      this.renderBadges()
    })
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M"
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K"
    }
    return num.toString()
  }
}

// Initialize dashboard when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.ecoDashboard = new EcoDashboard()
})
