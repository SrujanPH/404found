// Add Product functionality
class ProductUploader {
  constructor() {
    this.selectedImages = []
    this.maxImages = 5
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.updateEcoScore()
  }

  setupEventListeners() {
    // Form submission
    document.getElementById("productForm").addEventListener("submit", (e) => {
      this.handleSubmit(e)
    })

    // Image upload
    const imageInput = document.getElementById("images")
    const uploadArea = document.getElementById("uploadArea")

    imageInput.addEventListener("change", (e) => {
      this.handleImageSelect(e.target.files)
    })

    // Drag and drop
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault()
      uploadArea.classList.add("dragover")
    })

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover")
    })

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault()
      uploadArea.classList.remove("dragover")
      this.handleImageSelect(e.dataTransfer.files)
    })

    uploadArea.addEventListener("click", () => {
      imageInput.click()
    })

    // Eco score calculation
    document.getElementById("condition").addEventListener("change", () => {
      this.updateEcoScore()
    })

    document.getElementById("category").addEventListener("change", () => {
      this.updateEcoScore()
    })
  }

  handleImageSelect(files) {
    const fileArray = Array.from(files)

    // Check if adding these files would exceed the limit
    if (this.selectedImages.length + fileArray.length > this.maxImages) {
      alert(`You can only upload up to ${this.maxImages} images`)
      return
    }

    fileArray.forEach((file) => {
      if (file.type.startsWith("image/")) {
        this.selectedImages.push(file)
      }
    })

    this.renderImagePreview()
  }

  renderImagePreview() {
    const preview = document.getElementById("imagePreview")

    preview.innerHTML = this.selectedImages
      .map((file, index) => {
        const url = URL.createObjectURL(file)
        return `
                <div class="preview-item">
                    <img src="${url}" alt="Preview ${index + 1}">
                    <button type="button" class="remove-image" onclick="productUploader.removeImage(${index})">×</button>
                </div>
            `
      })
      .join("")

    // Update upload area visibility
    const uploadArea = document.getElementById("uploadArea")
    if (this.selectedImages.length >= this.maxImages) {
      uploadArea.style.display = "none"
    } else {
      uploadArea.style.display = "block"
    }
  }

  removeImage(index) {
    // Revoke the object URL to free memory
    const file = this.selectedImages[index]
    if (file) {
      URL.revokeObjectURL(URL.createObjectURL(file))
    }

    this.selectedImages.splice(index, 1)
    this.renderImagePreview()
  }

  updateEcoScore() {
    const condition = document.getElementById("condition").value
    const category = document.getElementById("category").value

    let score = 50 // Base score

    // Condition bonus
    switch (condition) {
      case "excellent":
        score += 30
        break
      case "good":
        score += 20
        break
      case "fair":
        score += 10
        break
      case "poor":
        score += 5
        break
    }

    // Category bonus (some categories have higher environmental impact when reused)
    switch (category) {
      case "electronics":
        score += 15
        break
      case "furniture":
        score += 10
        break
      case "clothing":
        score += 8
        break
      default:
        score += 5
        break
    }

    document.getElementById("ecoScorePreview").textContent = Math.min(score, 100)
  }

  async handleSubmit(event) {
    event.preventDefault()

    if (!window.auth || !window.auth.isAuthenticated()) {
      alert("Please log in to list items")
      window.location.href = "login.html"
      return
    }

    const form = event.target
    const formData = new FormData()

    // Add form fields
    formData.append("title", form.title.value)
    formData.append("description", form.description.value)
    formData.append("price", form.price.value)
    formData.append("category", form.category.value)
    formData.append("condition", form.condition.value)
    formData.append("location", form.location.value)

    // Add images
    this.selectedImages.forEach((image) => {
      formData.append("images", image)
    })

    this.showLoading(true)

    try {
      const response = await fetch("http://localhost:5013/api/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.auth.token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        alert("Item listed successfully!")
        window.location.href = "my-listings.html"
      } else {
        throw new Error(result.error || "Failed to list item")
      }
    } catch (error) {
      console.error("Error listing product:", error)
      this.showError(error.message)
    } finally {
      this.showLoading(false)
    }
  }

  showLoading(show) {
    const submitBtn = document.getElementById("submitBtn")
    const btnText = submitBtn.querySelector(".btn-text")
    const btnLoader = submitBtn.querySelector(".btn-loader")

    if (show) {
      btnText.style.display = "none"
      btnLoader.style.display = "inline-block"
      submitBtn.disabled = true
    } else {
      btnText.style.display = "inline-block"
      btnLoader.style.display = "none"
      submitBtn.disabled = false
    }
  }

  showError(message) {
    const errorElement = document.getElementById("errorMessage")
    errorElement.textContent = message
    errorElement.style.display = "block"

    setTimeout(() => {
      errorElement.style.display = "none"
    }, 5000)
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Check authentication
  if (!window.auth || !window.auth.isAuthenticated()) {
    showLoginPrompt()
    return
  }

  window.productUploader = new ProductUploader()
})

function showLoginPrompt() {
  const mainContent = document.querySelector(".add-product-content") || document.body
  mainContent.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; padding: var(--spacing-xl);">
      <div style="font-size: 3rem; margin-bottom: var(--spacing-lg);">🔒</div>
      <h2 style="margin-bottom: var(--spacing-md);">Login Required</h2>
      <p style="margin-bottom: var(--spacing-lg); color: var(--muted-foreground);">Please log in to list items for sale</p>
      <a href="login.html" class="btn btn-primary">Login</a>
    </div>
  `
}
