// Location Map JavaScript
class LocationMap {
  constructor() {
    this.map = null
    this.markers = []
    this.userLocation = null
    this.nearbyItems = []
    this.init()
  }

  init() {
    this.checkAuth()
    this.setupEventListeners()
  }

  checkAuth() {
    const token = localStorage.getItem("token")
    if (!token) {
      window.location.href = "login.html"
      return
    }
  }

  setupEventListeners() {
    document.getElementById("radiusSelect")?.addEventListener("change", () => {
      if (this.userLocation) {
        this.loadNearbyItems()
      }
    })
  }

  async getCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser")
      return
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        })
      })

      this.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      }

      console.log("[v0] User location obtained:", this.userLocation)

      if (this.map) {
        this.map.setCenter(this.userLocation)
        this.addUserMarker()
      } else {
        this.initializeMap()
      }

      await this.loadNearbyItems()
    } catch (error) {
      console.error("Error getting location:", error)
      alert("Unable to get your location. Please enter your address manually.")
    }
  }

  async searchLocation() {
    const address = document.getElementById("locationInput")?.value
    if (!address) {
      alert("Please enter an address")
      return
    }

    // In a real implementation, you'd use Google Geocoding API
    // For demo purposes, we'll simulate coordinates
    this.userLocation = {
      lat: 40.7128 + (Math.random() - 0.5) * 0.1, // Simulate NYC area
      lng: -74.006 + (Math.random() - 0.5) * 0.1,
    }

    console.log("[v0] Location searched:", address, this.userLocation)

    if (this.map) {
      this.map.setCenter(this.userLocation)
      this.addUserMarker()
    } else {
      this.initializeMap()
    }

    await this.loadNearbyItems()
  }

  initializeMap() {
    const mapElement = document.getElementById("map")
    if (!mapElement) return

    // Replace placeholder with actual map
    mapElement.innerHTML = '<div id="googleMap" style="width: 100%; height: 100%;"></div>'

    // Initialize Google Map (if Google Maps is loaded)
    const google = window.google // Declare the google variable
    if (typeof google !== "undefined" && google.maps) {
      const center = this.userLocation || { lat: 40.7128, lng: -74.006 }

      this.map = new google.maps.Map(document.getElementById("googleMap"), {
        zoom: 12,
        center: center,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      })

      if (this.userLocation) {
        this.addUserMarker()
        this.loadNearbyItems()
      }
    } else {
      // Fallback for demo without Google Maps API
      mapElement.innerHTML = `
        <div class="map-fallback">
          <div class="fallback-content">
            <span class="fallback-icon">🗺️</span>
            <h4>Map View</h4>
            <p>Interactive map would appear here with Google Maps API</p>
            <div class="demo-locations">
              <h5>Demo Locations:</h5>
              <div class="location-item">📍 Central Park - 2.3 km</div>
              <div class="location-item">📍 Brooklyn Bridge - 4.1 km</div>
              <div class="location-item">📍 Times Square - 1.8 km</div>
            </div>
          </div>
        </div>
      `

      // Load nearby items anyway for demo
      this.loadNearbyItems()
    }
  }

  addUserMarker() {
    if (!this.map || !this.userLocation) return

    new window.google.maps.Marker({
      position: this.userLocation,
      map: this.map,
      title: "Your Location",
      icon: {
        url:
          "data:image/svg+xml;charset=UTF-8," +
          encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="8" fill="#15803d" stroke="#ffffff" stroke-width="3"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(32, 32),
      },
    })
  }

  async loadNearbyItems() {
    if (!this.userLocation) {
      console.log("[v0] No user location available")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const radius = document.getElementById("radiusSelect")?.value || 25

      console.log("[v0] Loading nearby items with radius:", radius)

      const response = await fetch(
        `/api/maps/nearby-users?lat=${this.userLocation.lat}&lng=${this.userLocation.lng}&radius=${radius}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (response.ok) {
        this.nearbyItems = await response.json()
        console.log("[v0] Loaded nearby items:", this.nearbyItems.length)
        this.renderNearbyItems()
        this.addItemMarkers()
      } else {
        console.error("Failed to load nearby items")
        // Show demo data for development
        this.showDemoItems()
      }
    } catch (error) {
      console.error("Error loading nearby items:", error)
      this.showDemoItems()
    }
  }

  showDemoItems() {
    // Demo data for development
    this.nearbyItems = [
      {
        id: 1,
        username: "EcoSeller123",
        location: "Manhattan, NY",
        product_id: 1,
        title: "Vintage Leather Jacket",
        price: 45,
        category: "clothing",
      },
      {
        id: 2,
        username: "GreenTrader",
        location: "Brooklyn, NY",
        product_id: 2,
        title: "MacBook Pro 2019",
        price: 800,
        category: "electronics",
      },
      {
        id: 3,
        username: "SustainableLiving",
        location: "Queens, NY",
        product_id: 3,
        title: "Wooden Coffee Table",
        price: 120,
        category: "furniture",
      },
    ]

    console.log("[v0] Showing demo items:", this.nearbyItems.length)
    this.renderNearbyItems()
  }

  renderNearbyItems() {
    const container = document.getElementById("nearbyList")
    if (!container) return

    if (this.nearbyItems.length === 0) {
      container.innerHTML = `
        <div class="empty-nearby">
          <div class="empty-icon">📍</div>
          <h4>No items nearby</h4>
          <p>Try increasing your search radius or check back later</p>
        </div>
      `
      return
    }

    container.innerHTML = this.nearbyItems
      .map(
        (item) => `
      <div class="nearby-item" onclick="viewProduct(${item.product_id})">
        <div class="item-info">
          <h4>${item.title}</h4>
          <p class="item-price">$${item.price}</p>
          <p class="item-seller">by ${item.username}</p>
          <p class="item-location">📍 ${item.location}</p>
        </div>
        <div class="item-actions">
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); contactSeller(${item.product_id})">
            Contact
          </button>
        </div>
      </div>
    `,
      )
      .join("")
  }

  addItemMarkers() {
    if (!this.map) return

    // Clear existing markers
    this.markers.forEach((marker) => marker.setMap(null))
    this.markers = []

    // Add markers for nearby items
    this.nearbyItems.forEach((item, index) => {
      // Simulate coordinates near user location
      const lat = this.userLocation.lat + (Math.random() - 0.5) * 0.05
      const lng = this.userLocation.lng + (Math.random() - 0.5) * 0.05

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map: this.map,
        title: item.title,
        icon: {
          url:
            "data:image/svg+xml;charset=UTF-8," +
            encodeURIComponent(`
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="#84cc16" stroke="#ffffff" stroke-width="2"/>
              <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">$</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(24, 24),
        },
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px; max-width: 200px;">
            <h4 style="margin: 0 0 5px 0;">${item.title}</h4>
            <p style="margin: 0; color: #15803d; font-weight: bold;">$${item.price}</p>
            <p style="margin: 5px 0; font-size: 0.9em;">by ${item.username}</p>
            <button onclick="contactSeller(${item.product_id})" style="margin-top: 10px; padding: 5px 10px; background: #15803d; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Contact Seller
            </button>
          </div>
        `,
      })

      marker.addListener("click", () => {
        infoWindow.open(this.map, marker)
      })

      this.markers.push(marker)
    })
  }
}

// Global functions
function getCurrentLocation() {
  locationMap.getCurrentLocation()
}

function searchLocation() {
  locationMap.searchLocation()
}

function initializeMap() {
  locationMap.initializeMap()
}

function initMap() {
  // Called by Google Maps API
  console.log("[v0] Google Maps API loaded")
}

function viewProduct(productId) {
  window.location.href = `marketplace.html?product=${productId}`
}

async function contactSeller(productId) {
  const message = prompt("Enter your message to the seller:")
  if (!message) return

  try {
    const token = localStorage.getItem("token")
    const response = await fetch("/api/notifications/contact-seller", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId,
        message,
      }),
    })

    if (response.ok) {
      alert("Message sent to seller!")
    } else {
      alert("Failed to send message")
    }
  } catch (error) {
    console.error("Error contacting seller:", error)
    alert("Failed to send message")
  }
}

// Initialize location map
const locationMap = new LocationMap()
