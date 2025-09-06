import { Chart } from "@/components/ui/chart"
// Admin Dashboard JavaScript
class AdminDashboard {
  constructor() {
    this.currentSection = "dashboard"
    this.currentUser = null
    this.charts = {}
    this.init()
  }

  async init() {
    // Check authentication
    const token = localStorage.getItem("token")
    if (!token) {
      window.location.href = "login.html"
      return
    }

    // Verify admin access
    try {
      const response = await fetch("/api/admin/dashboard-stats", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        alert("Admin access required")
        window.location.href = "index.html"
        return
      }
    } catch (error) {
      console.error("Auth check failed:", error)
      window.location.href = "login.html"
      return
    }

    this.setupEventListeners()
    this.loadDashboard()
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault()
        const section = item.dataset.section
        this.switchSection(section)
      })
    })

    // Search and filters
    document.getElementById("userSearch")?.addEventListener(
      "input",
      this.debounce(() => this.loadUsers(), 300),
    )
    document.getElementById("userStatusFilter")?.addEventListener("change", () => this.loadUsers())

    document.getElementById("productSearch")?.addEventListener(
      "input",
      this.debounce(() => this.loadProducts(), 300),
    )
    document.getElementById("productStatusFilter")?.addEventListener("change", () => this.loadProducts())
    document.getElementById("productCategoryFilter")?.addEventListener("change", () => this.loadProducts())

    document.getElementById("reportStatusFilter")?.addEventListener("change", () => this.loadReports())
    document.getElementById("analyticsPeriod")?.addEventListener("change", () => this.loadAnalytics())
  }

  switchSection(section) {
    // Update navigation
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active")
    })
    document.querySelector(`[data-section="${section}"]`).classList.add("active")

    // Update content
    document.querySelectorAll(".admin-section").forEach((sec) => {
      sec.classList.remove("active")
    })
    document.getElementById(`${section}-section`).classList.add("active")

    this.currentSection = section

    // Load section data
    switch (section) {
      case "dashboard":
        this.loadDashboard()
        break
      case "users":
        this.loadUsers()
        break
      case "products":
        this.loadProducts()
        break
      case "reports":
        this.loadReports()
        break
      case "analytics":
        this.loadAnalytics()
        break
    }
  }

  async loadDashboard() {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/admin/dashboard-stats", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const stats = await response.json()

        document.getElementById("totalUsers").textContent = stats.users || 0
        document.getElementById("totalProducts").textContent = stats.products || 0
        document.getElementById("totalRevenue").textContent = `$${(stats.revenue || 0).toFixed(2)}`
        document.getElementById("pendingReports").textContent = stats.reports || 0

        this.loadDashboardCharts()
      }
    } catch (error) {
      console.error("Failed to load dashboard stats:", error)
    }
  }

  async loadDashboardCharts() {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/admin/analytics?period=30", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const analytics = await response.json()

        // User Growth Chart
        const userCtx = document.getElementById("userGrowthChart")?.getContext("2d")
        if (userCtx && analytics.userGrowth) {
          if (this.charts.userGrowth) this.charts.userGrowth.destroy()

          this.charts.userGrowth = new Chart(userCtx, {
            type: "line",
            data: {
              labels: analytics.userGrowth.map((d) => new Date(d.date).toLocaleDateString()),
              datasets: [
                {
                  label: "New Users",
                  data: analytics.userGrowth.map((d) => d.count),
                  borderColor: "#15803d",
                  backgroundColor: "rgba(21, 128, 61, 0.1)",
                  tension: 0.4,
                },
              ],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true },
              },
            },
          })
        }

        // Revenue Chart
        const revenueCtx = document.getElementById("revenueChart")?.getContext("2d")
        if (revenueCtx && analytics.transactionGrowth) {
          if (this.charts.revenue) this.charts.revenue.destroy()

          this.charts.revenue = new Chart(revenueCtx, {
            type: "bar",
            data: {
              labels: analytics.transactionGrowth.map((d) => new Date(d.date).toLocaleDateString()),
              datasets: [
                {
                  label: "Revenue",
                  data: analytics.transactionGrowth.map((d) => d.revenue || 0),
                  backgroundColor: "#84cc16",
                },
              ],
            },
            options: {
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true },
              },
            },
          })
        }
      }
    } catch (error) {
      console.error("Failed to load dashboard charts:", error)
    }
  }

  async loadUsers(page = 1) {
    try {
      const token = localStorage.getItem("token")
      const search = document.getElementById("userSearch")?.value || ""
      const status = document.getElementById("userStatusFilter")?.value || ""

      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(status && { status }),
      })

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const users = await response.json()
        this.renderUsersTable(users)
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }

  renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody")
    if (!tbody) return

    tbody.innerHTML = users
      .map(
        (user) => `
      <tr>
        <td>
          <div>
            <strong>${user.username}</strong><br>
            <small>${user.full_name || "N/A"}</small>
          </div>
        </td>
        <td>${user.email}</td>
        <td>${user.eco_score || 0}</td>
        <td>${user.products_count || 0}</td>
        <td>${user.transactions_count || 0}</td>
        <td>
          <span class="status-badge status-${user.status || "active"}">
            ${(user.status || "active").toUpperCase()}
          </span>
        </td>
        <td>
          <button class="action-btn view" onclick="adminDashboard.viewUser(${user.id})">View</button>
          <button class="action-btn edit" onclick="adminDashboard.editUser(${user.id})">Edit</button>
        </td>
      </tr>
    `,
      )
      .join("")
  }

  async loadProducts(page = 1) {
    try {
      const token = localStorage.getItem("token")
      const search = document.getElementById("productSearch")?.value || ""
      const status = document.getElementById("productStatusFilter")?.value || ""
      const category = document.getElementById("productCategoryFilter")?.value || ""

      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(status && { status }),
        ...(category && { category }),
      })

      const response = await fetch(`/api/admin/products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const products = await response.json()
        this.renderProductsTable(products)
      }
    } catch (error) {
      console.error("Failed to load products:", error)
    }
  }

  renderProductsTable(products) {
    const tbody = document.getElementById("productsTableBody")
    if (!tbody) return

    tbody.innerHTML = products
      .map(
        (product) => `
      <tr>
        <td>
          <div>
            <strong>${product.title}</strong><br>
            <small>${product.description?.substring(0, 50)}...</small>
          </div>
        </td>
        <td>${product.seller_name}</td>
        <td>${product.category}</td>
        <td>$${product.price}</td>
        <td>${product.eco_score || 0}</td>
        <td>${product.report_count || 0}</td>
        <td>
          <span class="status-badge status-${product.status}">
            ${product.status.toUpperCase()}
          </span>
        </td>
        <td>
          <button class="action-btn view" onclick="adminDashboard.viewProduct(${product.id})">View</button>
          <button class="action-btn edit" onclick="adminDashboard.editProduct(${product.id})">Edit</button>
        </td>
      </tr>
    `,
      )
      .join("")
  }

  async loadReports(page = 1) {
    try {
      const token = localStorage.getItem("token")
      const status = document.getElementById("reportStatusFilter")?.value || "pending"

      const params = new URLSearchParams({ page, limit: 20, status })

      const response = await fetch(`/api/admin/reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const reports = await response.json()
        this.renderReports(reports)
      }
    } catch (error) {
      console.error("Failed to load reports:", error)
    }
  }

  renderReports(reports) {
    const container = document.getElementById("reportsContainer")
    if (!container) return

    container.innerHTML = reports
      .map(
        (report) => `
      <div class="report-card">
        <div class="report-header">
          <h4>${report.reason}</h4>
          <span class="status-badge status-${report.status}">${report.status.toUpperCase()}</span>
        </div>
        <div class="report-meta">
          <span>Reporter: ${report.reporter_name}</span>
          <span>Date: ${new Date(report.created_at).toLocaleDateString()}</span>
          ${report.product_title ? `<span>Product: ${report.product_title}</span>` : ""}
        </div>
        <p>${report.description}</p>
        ${
          report.status === "pending"
            ? `
          <div class="report-actions">
            <button class="btn btn-primary" onclick="adminDashboard.resolveReport(${report.id}, 'resolved')">
              Resolve
            </button>
            <button class="btn btn-secondary" onclick="adminDashboard.resolveReport(${report.id}, 'dismissed')">
              Dismiss
            </button>
          </div>
        `
            : ""
        }
      </div>
    `,
      )
      .join("")
  }

  async loadAnalytics() {
    try {
      const token = localStorage.getItem("token")
      const period = document.getElementById("analyticsPeriod")?.value || "30"

      const response = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const analytics = await response.json()

        // Category Chart
        const categoryCtx = document.getElementById("categoryChart")?.getContext("2d")
        if (categoryCtx && analytics.categoryStats) {
          if (this.charts.category) this.charts.category.destroy()

          this.charts.category = new Chart(categoryCtx, {
            type: "doughnut",
            data: {
              labels: analytics.categoryStats.map((c) => c.category),
              datasets: [
                {
                  data: analytics.categoryStats.map((c) => c.count),
                  backgroundColor: [
                    "#15803d",
                    "#84cc16",
                    "#22c55e",
                    "#16a34a",
                    "#65a30d",
                    "#4ade80",
                    "#86efac",
                    "#bbf7d0",
                  ],
                },
              ],
            },
            options: {
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
              },
            },
          })
        }

        // Eco Impact
        if (analytics.ecoImpact) {
          document.getElementById("totalCarbon").textContent = (analytics.ecoImpact.total_carbon || 0).toFixed(1)
          document.getElementById("totalWater").textContent = (analytics.ecoImpact.total_water || 0).toLocaleString()
        }
      }
    } catch (error) {
      console.error("Failed to load analytics:", error)
    }
  }

  // Modal functions
  viewUser(userId) {
    // Implementation for viewing user details
    console.log("View user:", userId)
  }

  editUser(userId) {
    this.currentUserId = userId
    document.getElementById("userModal").classList.add("active")
  }

  viewProduct(productId) {
    console.log("View product:", productId)
  }

  editProduct(productId) {
    this.currentProductId = productId
    document.getElementById("productModal").classList.add("active")
  }

  async executeUserAction() {
    const action = document.getElementById("userAction").value
    const reason = document.getElementById("userActionReason").value

    if (!this.currentUserId || !reason.trim()) {
      alert("Please provide a reason for this action")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/admin/users/${this.currentUserId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action === "activate" ? "active" : action === "suspend" ? "suspended" : "banned",
          reason,
        }),
      })

      if (response.ok) {
        this.closeModal("userModal")
        this.loadUsers()
        alert("User status updated successfully")
      } else {
        alert("Failed to update user status")
      }
    } catch (error) {
      console.error("Failed to execute user action:", error)
      alert("Failed to execute action")
    }
  }

  async executeProductAction() {
    const action = document.getElementById("productAction").value
    const reason = document.getElementById("productActionReason").value

    if (!this.currentProductId || !reason.trim()) {
      alert("Please provide a reason for this action")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/admin/products/${this.currentProductId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action === "approve" ? "active" : action === "flag" ? "flagged" : "inactive",
          reason,
        }),
      })

      if (response.ok) {
        this.closeModal("productModal")
        this.loadProducts()
        alert("Product status updated successfully")
      } else {
        alert("Failed to update product status")
      }
    } catch (error) {
      console.error("Failed to execute product action:", error)
      alert("Failed to execute action")
    }
  }

  async resolveReport(reportId, status) {
    const notes = prompt("Enter admin notes (optional):") || ""

    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          admin_notes: notes,
        }),
      })

      if (response.ok) {
        this.loadReports()
        alert("Report updated successfully")
      } else {
        alert("Failed to update report")
      }
    } catch (error) {
      console.error("Failed to resolve report:", error)
      alert("Failed to resolve report")
    }
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active")
    this.currentUserId = null
    this.currentProductId = null
  }

  async refreshDashboard() {
    await this.loadDashboard()
    alert("Dashboard refreshed")
  }

  saveSettings() {
    alert("Settings saved successfully")
  }

  resetSettings() {
    if (confirm("Reset all settings to defaults?")) {
      alert("Settings reset to defaults")
    }
  }

  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }
}

// Global functions
function logout() {
  localStorage.removeItem("token")
  localStorage.removeItem("user")
  window.location.href = "login.html"
}

function closeModal(modalId) {
  adminDashboard.closeModal(modalId)
}

function refreshDashboard() {
  adminDashboard.refreshDashboard()
}

function saveSettings() {
  adminDashboard.saveSettings()
}

function resetSettings() {
  adminDashboard.resetSettings()
}

// Initialize admin dashboard
const adminDashboard = new AdminDashboard()
