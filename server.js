const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const multer = require("multer")
const path = require("path")
const http = require("http")
const socketIo = require("socket.io")
const cloudinary = require("cloudinary").v2
const nodemailer = require("nodemailer")
const stripe = require("stripe")
require("dotenv").config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

const PORT = 5013 // Force port to 5013 instead of using environment variable

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const stripeClient = process.env.STRIPE_SECRET_KEY ? stripe(process.env.STRIPE_SECRET_KEY) : null

app.use(cors())
app.use(express.json())
app.use("/uploads", express.static("uploads"))
app.use(express.static("../frontend"))

const sqlite3 = require("sqlite3").verbose()
const db = new sqlite3.Database("./database.db")

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: Number.parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

const uploadToCloudinary = async (buffer, folder = "eco-marketplace") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "auto",
          transformation: [{ width: 800, height: 600, crop: "limit" }, { quality: "auto" }, { fetch_format: "auto" }],
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        },
      )
      .end(buffer)
  })
}

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER) {
    console.log("Email not configured, skipping:", { to, subject })
    return
  }

  try {
    await emailTransporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    })
    console.log("Email sent successfully to:", to)
  } catch (error) {
    console.error("Failed to send email:", error)
  }
}

const sendWelcomeEmail = async (email, username) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #15803d;">Welcome to EcoMarket! 🌱</h2>
      <p>Hi ${username},</p>
      <p>Welcome to our sustainable marketplace! We're excited to have you join our community of eco-conscious buyers and sellers.</p>
      <p>Here's what you can do:</p>
      <ul>
        <li>Browse thousands of second-hand items</li>
        <li>List your own products for sale</li>
        <li>Track your environmental impact</li>
        <li>Earn eco-badges for sustainable actions</li>
      </ul>
      <p>Start making a difference today!</p>
      <p>Best regards,<br>The EcoMarket Team</p>
    </div>
  `
  await sendEmail(email, "Welcome to EcoMarket!", html)
}

const sendTransactionEmail = async (buyerEmail, sellerEmail, productTitle, amount) => {
  const buyerHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #15803d;">Purchase Confirmation 🎉</h2>
      <p>Your purchase of "${productTitle}" for $${amount} has been confirmed!</p>
      <p>The seller will contact you soon to arrange pickup or delivery.</p>
      <p>Thank you for choosing sustainable shopping!</p>
    </div>
  `

  const sellerHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #15803d;">Item Sold! 💰</h2>
      <p>Great news! Your item "${productTitle}" has been sold for $${amount}.</p>
      <p>Please contact the buyer to arrange pickup or delivery.</p>
      <p>Thanks for contributing to our sustainable marketplace!</p>
    </div>
  `

  await sendEmail(buyerEmail, "Purchase Confirmation - EcoMarket", buyerHtml)
  await sendEmail(sellerEmail, "Item Sold - EcoMarket", sellerHtml)
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token

  if (!token) {
    return next(new Error("Authentication error"))
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error("Authentication error"))
    }
    socket.userId = user.userId
    socket.username = user.username
    next()
  })
}

const activeUsers = new Map()

io.use(authenticateSocket)

io.on("connection", (socket) => {
  console.log(`User ${socket.username} connected`)

  activeUsers.set(socket.userId, socket.id)

  socket.join(`user_${socket.userId}`)

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation_${conversationId}`)
    console.log(`User ${socket.username} joined conversation ${conversationId}`)
  })

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation_${conversationId}`)
    console.log(`User ${socket.username} left conversation ${conversationId}`)
  })

  socket.on("send_message", async (data) => {
    try {
      const { conversationId, message } = data

      db.get(
        "SELECT * FROM conversations WHERE id = ? AND (buyer_id = ? OR seller_id = ?)",
        [conversationId, socket.userId, socket.userId],
        (err, conversation) => {
          if (err || !conversation) {
            socket.emit("error", { message: "Access denied" })
            return
          }

          db.run(
            "INSERT INTO messages (conversation_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)",
            [conversationId, socket.userId, message, new Date().toISOString()],
            function (err) {
              if (err) {
                socket.emit("error", { message: "Failed to send message" })
                return
              }

              const messageData = {
                id: this.lastID,
                conversation_id: conversationId,
                sender_id: socket.userId,
                sender_username: socket.username,
                message: message,
                created_at: new Date().toISOString(),
              }

              io.to(`conversation_${conversationId}`).emit("new_message", messageData)

              db.run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [
                new Date().toISOString(),
                conversationId,
              ])
            },
          )
        },
      )
    } catch (error) {
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  socket.on("typing_start", (conversationId) => {
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId: socket.userId,
      username: socket.username,
    })
  })

  socket.on("typing_stop", (conversationId) => {
    socket.to(`conversation_${conversationId}`).emit("user_stopped_typing", {
      userId: socket.userId,
    })
  })

  socket.on("disconnect", () => {
    console.log(`User ${socket.username} disconnected`)
    activeUsers.delete(socket.userId)
  })
})

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, fullName, location } = req.body

    db.get("SELECT * FROM users WHERE email = ? OR username = ?", [email, username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      if (user) {
        return res.status(400).json({ error: "User already exists" })
      }

      const hashedPassword = await bcrypt.hash(password, 10)

      db.run(
        "INSERT INTO users (username, email, password, full_name, location, eco_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, email, hashedPassword, fullName, location, 0, new Date().toISOString()],
        async function (err) {
          if (err) {
            return res.status(500).json({ error: "Failed to create user" })
          }

          const token = jwt.sign({ userId: this.lastID, username }, JWT_SECRET)

          await sendWelcomeEmail(email, username)

          res.status(201).json({
            message: "User created successfully",
            token,
            user: { id: this.lastID, username, email, fullName, location },
          })
        },
      )
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      if (!user) {
        return res.status(400).json({ error: "Invalid credentials" })
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return res.status(400).json({ error: "Invalid credentials" })
      }

      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET)
      res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          location: user.location,
          ecoScore: user.eco_score,
        },
      })
    })
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
})

app.get("/api/products", (req, res) => {
  const { category, minPrice, maxPrice, condition, location, search, sortBy } = req.query

  let query = `
    SELECT p.*, u.username as seller_name, u.location as seller_location 
    FROM products p 
    JOIN users u ON p.seller_id = u.id 
    WHERE p.status = 'active'
  `
  const params = []

  if (category) {
    query += " AND p.category = ?"
    params.push(category)
  }

  if (minPrice) {
    query += " AND p.price >= ?"
    params.push(minPrice)
  }

  if (maxPrice) {
    query += " AND p.price <= ?"
    params.push(maxPrice)
  }

  if (condition) {
    query += " AND p.condition = ?"
    params.push(condition)
  }

  if (location) {
    query += " AND u.location LIKE ?"
    params.push(`%${location}%`)
  }

  if (search) {
    query += " AND (p.title LIKE ? OR p.description LIKE ?)"
    params.push(`%${search}%`, `%${search}%`)
  }

  switch (sortBy) {
    case "price_low":
      query += " ORDER BY p.price ASC"
      break
    case "price_high":
      query += " ORDER BY p.price DESC"
      break
    case "eco_score":
      query += " ORDER BY p.eco_score DESC"
      break
    default:
      query += " ORDER BY p.created_at DESC"
  }

  db.all(query, params, (err, products) => {
    if (err) {
      return res.status(500).json({ error: "Database error" })
    }
    res.json(products)
  })
})

app.post("/api/products", authenticateToken, upload.array("images", 5), async (req, res) => {
  try {
    const { title, description, price, category, condition, location } = req.body
    const sellerId = req.user.userId

    let ecoScore = 50 // Base score
    if (condition === "excellent") ecoScore += 30
    else if (condition === "good") ecoScore += 20
    else if (condition === "fair") ecoScore += 10

    let imageUrls = []

    if (req.files && req.files.length > 0 && process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const uploadPromises = req.files.map((file) => uploadToCloudinary(file.buffer, "eco-marketplace/products"))
        const uploadResults = await Promise.all(uploadPromises)
        imageUrls = uploadResults.map((result) => result.secure_url)
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError)
        return res.status(500).json({ error: "Failed to upload images" })
      }
    } else if (req.files && req.files.length > 0) {
      const fs = require("fs")
      const uploadDir = "uploads"
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      imageUrls = req.files.map((file) => {
        const filename = Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)
        const filepath = path.join(uploadDir, filename)
        fs.writeFileSync(filepath, file.buffer)
        return filename
      })
    }

    db.run(
      `INSERT INTO products (seller_id, title, description, price, category, condition, location, images, eco_score, status, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        sellerId,
        title,
        description,
        price,
        category,
        condition,
        location,
        JSON.stringify(imageUrls),
        ecoScore,
        new Date().toISOString(),
      ],
      function (err) {
        if (err) {
          return res.status(500).json({ error: "Failed to create product" })
        }

        db.run("UPDATE users SET eco_score = eco_score + 10 WHERE id = ?", [sellerId])

        res.status(201).json({
          message: "Product created successfully",
          productId: this.lastID,
          images: imageUrls,
        })
      },
    )
  } catch (error) {
    console.error("Product creation error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

app.get("/api/wishlist", authenticateToken, (req, res) => {
  const userId = req.user.userId

  db.all(
    `SELECT p.*, u.username as seller_name 
     FROM wishlist w 
     JOIN products p ON w.product_id = p.id 
     JOIN users u ON p.seller_id = u.id 
     WHERE w.user_id = ?`,
    [userId],
    (err, items) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json(items)
    },
  )
})

app.post("/api/wishlist/:productId", authenticateToken, (req, res) => {
  const userId = req.user.userId
  const productId = req.params.productId

  db.run(
    "INSERT OR IGNORE INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, ?)",
    [userId, productId, new Date().toISOString()],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json({ message: "Added to wishlist" })
    },
  )
})

app.delete("/api/wishlist/:productId", authenticateToken, (req, res) => {
  const userId = req.user.userId
  const productId = req.params.productId

  db.run("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", [userId, productId], (err) => {
    if (err) {
      return res.status(500).json({ error: "Database error" })
    }
    res.json({ message: "Removed from wishlist" })
  })
})

app.get("/api/eco/impact", (req, res) => {
  db.get(
    `SELECT 
       COUNT(*) as total_transactions,
       SUM(carbon_saved) as total_carbon_saved,
       SUM(water_saved) as total_water_saved,
       COUNT(DISTINCT buyer_id) as active_users
     FROM transactions WHERE status = 'completed'`,
    (err, impact) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json(impact || { total_transactions: 0, total_carbon_saved: 0, total_water_saved: 0, active_users: 0 })
    },
  )
})

app.get("/api/eco/community-stats", (req, res) => {
  db.all(
    `SELECT 
       COUNT(DISTINCT u.id) as total_users,
       COUNT(DISTINCT p.id) as total_products,
       COALESCE(SUM(t.carbon_saved), 0) as total_carbon_saved,
       COALESCE(SUM(t.water_saved), 0) as total_water_saved,
       COUNT(DISTINCT t.id) as completed_transactions,
       AVG(p.eco_score) as avg_eco_score
     FROM users u
     LEFT JOIN products p ON u.id = p.seller_id
     LEFT JOIN transactions t ON p.id = t.product_id AND t.status = 'completed'`,
    (err, stats) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      const result = stats[0] || {}
      res.json({
        total_users: result.total_users || 0,
        total_products: result.total_products || 0,
        total_carbon_saved: result.total_carbon_saved || 0,
        total_water_saved: result.total_water_saved || 0,
        completed_transactions: result.completed_transactions || 0,
        avg_eco_score: Math.round(result.avg_eco_score || 0),
      })
    },
  )
})

app.post("/api/eco/calculate-footprint", authenticateToken, (req, res) => {
  const { category, condition, price } = req.body

  const carbonFactors = {
    clothing: { base: 22, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    electronics: { base: 300, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.5 },
    furniture: { base: 150, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    books: { base: 8, excellent: 0.95, good: 0.9, fair: 0.85, poor: 0.8 },
    sports: { base: 45, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    home: { base: 80, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
    toys: { base: 35, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    other: { base: 50, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
  }

  const waterFactors = {
    clothing: { base: 2700, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    electronics: { base: 1500, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.5 },
    furniture: { base: 800, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    books: { base: 300, excellent: 0.95, good: 0.9, fair: 0.85, poor: 0.8 },
    sports: { base: 600, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    home: { base: 1000, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
    toys: { base: 400, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
    other: { base: 500, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
  }

  const categoryKey = category || "other"
  const conditionKey = condition || "good"

  const carbonBase = carbonFactors[categoryKey]?.base || carbonFactors.other.base
  const carbonMultiplier = carbonFactors[categoryKey]?.[conditionKey] || carbonFactors.other.good
  const carbonSaved = Math.round(carbonBase * carbonMultiplier * 100) / 100

  const waterBase = waterFactors[categoryKey]?.base || waterFactors.other.base
  const waterMultiplier = waterFactors[categoryKey]?.[conditionKey] || waterFactors.other.good
  const waterSaved = Math.round(waterBase * waterMultiplier)

  const moneySaved = Math.round(price * 0.3 * 100) / 100

  res.json({
    carbon_saved: carbonSaved,
    water_saved: waterSaved,
    money_saved: moneySaved,
    category: categoryKey,
    condition: conditionKey,
  })
})

app.get("/api/eco/badges/:userId", (req, res) => {
  const userId = req.params.userId

  db.all(
    "SELECT * FROM user_badges ub JOIN badges b ON ub.badge_id = b.id WHERE ub.user_id = ? ORDER BY ub.earned_at DESC",
    [userId],
    (err, badges) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json(badges)
    },
  )
})

app.post("/api/eco/check-badges", authenticateToken, (req, res) => {
  const userId = req.user.userId

  db.get(
    `SELECT 
       u.eco_score,
       COUNT(DISTINCT p.id) as products_listed,
       COUNT(DISTINCT t.id) as transactions_completed,
       COALESCE(SUM(t.carbon_saved), 0) as total_carbon_saved,
       COALESCE(SUM(t.water_saved), 0) as total_water_saved
     FROM users u
     LEFT JOIN products p ON u.id = p.seller_id
     LEFT JOIN transactions t ON (u.id = t.buyer_id OR u.id = t.seller_id) AND t.status = 'completed'
     WHERE u.id = ?`,
    [userId],
    (err, userStats) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      const badgeChecks = [
        { id: 1, requirement: userStats.transactions_completed >= 1 },
        { id: 2, requirement: userStats.transactions_completed >= 5 },
        { id: 3, requirement: userStats.eco_score >= 100 },
        { id: 4, requirement: userStats.total_carbon_saved >= 50 },
        { id: 5, requirement: userStats.total_water_saved >= 1000 },
      ]

      const newBadges = []

      badgeChecks.forEach((check) => {
        db.get(
          "SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?",
          [userId, check.id],
          (err, existingBadge) => {
            if (!err && !existingBadge) {
              db.run(
                "INSERT INTO user_badges (user_id, badge_id, earned_at) VALUES (?, ?, ?)",
                [userId, check.id, new Date().toISOString()],
                (err) => {
                  if (!err) {
                    db.get("SELECT * FROM badges WHERE id = ?", [check.id], (err, badge) => {
                      if (!err && badge) {
                        newBadges.push(badge)
                      }
                    })
                  }
                },
              )
            }
          },
        )
      })

      setTimeout(() => {
        res.json({ newBadges, userStats })
      }, 100)
    },
  )
})

app.post("/api/transactions", authenticateToken, async (req, res) => {
  const { productId, sellerId } = req.body
  const buyerId = req.user.userId

  if (buyerId === sellerId) {
    return res.status(400).json({ error: "Cannot buy your own product" })
  }

  db.get("SELECT * FROM products WHERE id = ? AND status = 'active'", [productId], async (err, product) => {
    if (err || !product) {
      return res.status(404).json({ error: "Product not found" })
    }

    const carbonFactors = {
      clothing: { base: 22, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      electronics: { base: 300, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.5 },
      furniture: { base: 150, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      books: { base: 8, excellent: 0.95, good: 0.9, fair: 0.85, poor: 0.8 },
      sports: { base: 45, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      home: { base: 80, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
      toys: { base: 400, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      other: { base: 500, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
    }

    const waterFactors = {
      clothing: { base: 2700, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      electronics: { base: 1500, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.5 },
      furniture: { base: 800, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      books: { base: 300, excellent: 0.95, good: 0.9, fair: 0.85, poor: 0.8 },
      sports: { base: 600, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      home: { base: 1000, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
      toys: { base: 400, excellent: 0.9, good: 0.8, fair: 0.7, poor: 0.6 },
      other: { base: 500, excellent: 0.85, good: 0.75, fair: 0.65, poor: 0.55 },
    }

    const categoryKey = product.category || "other"
    const conditionKey = product.condition || "good"

    const carbonBase = carbonFactors[categoryKey]?.base || carbonFactors.other.base
    const carbonMultiplier = carbonFactors[categoryKey]?.[conditionKey] || carbonFactors.other.good
    const carbonSaved = Math.round(carbonBase * carbonMultiplier * 100) / 100

    const waterBase = waterFactors[categoryKey]?.base || waterFactors.other.base
    const waterMultiplier = waterFactors[categoryKey]?.[conditionKey] || waterFactors.other.good
    const waterSaved = Math.round(waterBase * waterMultiplier)

    db.get("SELECT email FROM users WHERE id = ?", [buyerId], (err, buyer) => {
      if (err) return res.status(500).json({ error: "Database error" })

      db.get("SELECT email FROM users WHERE id = ?", [sellerId], async (err, seller) => {
        if (err) return res.status(500).json({ error: "Database error" })

        db.run(
          `INSERT INTO transactions (buyer_id, seller_id, product_id, amount, carbon_saved, water_saved, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
          [buyerId, sellerId, productId, product.price, carbonSaved, waterSaved, new Date().toISOString()],
          async function (err) {
            if (err) {
              return res.status(500).json({ error: "Failed to create transaction" })
            }

            db.run("UPDATE products SET status = 'sold' WHERE id = ?", [productId])

            db.run("UPDATE users SET eco_score = eco_score + 15 WHERE id = ?", [buyerId])
            db.run("UPDATE users SET eco_score = eco_score + 20 WHERE id = ?", [sellerId])

            if (buyer && seller) {
              await sendTransactionEmail(buyer.email, seller.email, product.title, product.price)
            }

            res.status(201).json({
              transactionId: this.lastID,
              carbonSaved,
              waterSaved,
              message: "Transaction completed successfully",
            })
          },
        )
      })
    })
  })
})

app.get("/api/transactions/user", authenticateToken, (req, res) => {
  const userId = req.user.userId

  db.all(
    `SELECT 
       t.*,
       p.title as product_title,
       p.images as product_images,
       p.category,
       buyer.username as buyer_username,
       seller.username as seller_username,
       CASE 
         WHEN t.buyer_id = ? THEN 'purchase'
         ELSE 'sale'
       END as transaction_type
     FROM transactions t
     JOIN products p ON t.product_id = p.id
     JOIN users buyer ON t.buyer_id = buyer.id
     JOIN users seller ON t.seller_id = seller.id
     WHERE t.buyer_id = ? OR t.seller_id = ?
     ORDER BY t.created_at DESC`,
    [userId, userId, userId],
    (err, transactions) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json(transactions)
    },
  )
})

const authenticateAdmin = (req, res, next) => {
  authenticateToken(req, res, () => {
    db.get("SELECT role FROM users WHERE id = ?", [req.user.userId], (err, user) => {
      if (err || !user || user.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" })
      }
      next()
    })
  })
}

app.get("/api/admin/dashboard-stats", authenticateAdmin, (req, res) => {
  const queries = {
    users: "SELECT COUNT(*) as count FROM users",
    products: "SELECT COUNT(*) as count FROM products",
    transactions: "SELECT COUNT(*) as count FROM transactions",
    reports: "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'",
    revenue: "SELECT SUM(amount) as total FROM transactions WHERE status = 'completed'",
    activeUsers:
      "SELECT COUNT(DISTINCT buyer_id) + COUNT(DISTINCT seller_id) as count FROM transactions WHERE created_at > datetime('now', '-30 days')",
  }

  const stats = {}
  let completed = 0
  const total = Object.keys(queries).length

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, (err, result) => {
      if (!err) {
        stats[key] = result.count || result.total || 0
      }
      completed++
      if (completed === total) {
        res.json(stats)
      }
    })
  })
})

app.get("/api/admin/users", authenticateAdmin, (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query
  const offset = (page - 1) * limit

  let query = `
    SELECT u.*, 
           COUNT(DISTINCT p.id) as products_count,
           COUNT(DISTINCT t.id) as transactions_count,
           COALESCE(SUM(CASE WHEN t.buyer_id = u.id THEN t.amount ELSE 0 END), 0) as total_spent,
           COALESCE(SUM(CASE WHEN t.seller_id = u.id THEN t.amount ELSE 0 END), 0) as total_earned
    FROM users u
    LEFT JOIN products p ON u.id = p.seller_id
    LEFT JOIN transactions t ON (u.id = t.buyer_id OR u.id = t.seller_id)
    WHERE 1=1
  `
  const params = []

  if (search) {
    query += " AND (u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)"
    params.push(`%${search}%`, `%${search}%`, `%${search}%`)
  }

  if (status) {
    query += " AND u.status = ?"
    params.push(status)
  }

  query += " GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ error: "Database error" })
    }
    res.json(users)
  })
})

app.get("/api/admin/products", authenticateAdmin, (req, res) => {
  const { page = 1, limit = 20, status, category, search } = req.query
  const offset = (page - 1) * limit

  let query = `
    SELECT p.*, u.username as seller_name, u.email as seller_email,
           COUNT(r.id) as report_count
    FROM products p
    JOIN users u ON p.seller_id = u.id
    LEFT JOIN reports r ON p.id = r.product_id AND r.status = 'pending'
    WHERE 1=1
  `
  const params = []

  if (status) {
    query += " AND p.status = ?"
    params.push(status)
  }

  if (category) {
    query += " AND p.category = ?"
    params.push(category)
  }

  if (search) {
    query += " AND (p.title LIKE ? OR p.description LIKE ?)"
    params.push(`%${search}%`, `%${search}%`)
  }

  query += " GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  db.all(query, params, (err, products) => {
    if (err) {
      return res.status(500).json({ error: "Database error" })
    }
    res.json(products)
  })
})

app.get("/api/admin/reports", authenticateAdmin, (req, res) => {
  const { page = 1, limit = 20, status = "pending" } = req.query
  const offset = (page - 1) * limit

  db.all(
    `SELECT r.*, 
            p.title as product_title,
            p.images as product_images,
            reporter.username as reporter_name,
            reported_user.username as reported_user_name
     FROM reports r
     LEFT JOIN products p ON r.product_id = p.id
     LEFT JOIN users reporter ON r.reporter_id = reporter.id
     LEFT JOIN users reported_user ON r.reported_user_id = reported_user.id
     WHERE r.status = ?
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [status, limit, offset],
    (err, reports) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json(reports)
    },
  )
})

app.put("/api/admin/reports/:reportId", authenticateAdmin, (req, res) => {
  const { reportId } = req.params
  const { status, admin_notes } = req.body

  db.run(
    "UPDATE reports SET status = ?, admin_notes = ?, resolved_at = ? WHERE id = ?",
    [status, admin_notes, new Date().toISOString(), reportId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json({ message: "Report updated successfully" })
    },
  )
})

app.put("/api/admin/users/:userId/status", authenticateAdmin, (req, res) => {
  const { userId } = req.params
  const { status, reason } = req.body

  db.run(
    "UPDATE users SET status = ?, status_reason = ?, updated_at = ? WHERE id = ?",
    [status, reason, new Date().toISOString(), userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      if (status === "suspended") {
        db.run("UPDATE products SET status = 'inactive' WHERE seller_id = ?", [userId])
      }

      res.json({ message: "User status updated successfully" })
    },
  )
})

app.put("/api/admin/products/:productId/status", authenticateAdmin, (req, res) => {
  const { productId } = req.params
  const { status, reason } = req.body

  db.run(
    "UPDATE products SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?",
    [status, reason, new Date().toISOString(), productId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }
      res.json({ message: "Product status updated successfully" })
    },
  )
})

app.get("/api/admin/analytics", authenticateAdmin, (req, res) => {
  const { period = "30" } = req.query

  const queries = {
    userGrowth: `
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM users 
      WHERE created_at > datetime('now', '-${period} days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    productGrowth: `
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM products 
      WHERE created_at > datetime('now', '-${period} days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
    transactionGrowth: `
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(amount) as revenue
      FROM transactions 
      WHERE created_at > datetime('now', '-${period} days')
    `,
    categoryStats: `
      SELECT category, COUNT(*) as count, AVG(price) as avg_price
      FROM products 
      WHERE created_at > datetime('now', '-${period} days')
      GROUP BY category
      ORDER BY count DESC
    `,
    ecoImpact: `
      SELECT 
        SUM(carbon_saved) as total_carbon,
        SUM(water_saved) as total_water,
        COUNT(*) as transactions
      FROM transactions 
      WHERE created_at > datetime('now', '-${period} days')
    `,
  }

  const analytics = {}
  let completed = 0
  const total = Object.keys(queries).length

  Object.entries(queries).forEach(([key, query]) => {
    db.all(query, (err, result) => {
      if (!err) {
        analytics[key] = result
      }
      completed++
      if (completed === total) {
        res.json(analytics)
      }
    })
  })
})

app.get("/api/maps/nearby-users", authenticateToken, (req, res) => {
  const { lat, lng, radius = 50 } = req.query

  if (!lat || !lng) {
    return res.status(400).json({ error: "Latitude and longitude required" })
  }

  db.all(
    `SELECT u.id, u.username, u.location, p.id as product_id, p.title, p.price, p.category
     FROM users u
     JOIN products p ON u.id = p.seller_id
     WHERE p.status = 'active' AND u.id != ?
     ORDER BY u.created_at DESC
     LIMIT 50`,
    [req.user.userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: "Database error" })
      }

      res.json(results)
    },
  )
})

app.post("/api/payments/create-intent", authenticateToken, async (req, res) => {
  if (!stripeClient) {
    return res.status(400).json({ error: "Payment processing not configured" })
  }

  try {
    const { amount, productId } = req.body

    db.get("SELECT * FROM products WHERE id = ? AND status = 'active'", [productId], async (err, product) => {
      if (err || !product) {
        return res.status(404).json({ error: "Product not found" })
      }

      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        metadata: {
          productId: productId.toString(),
          buyerId: req.user.userId.toString(),
          sellerId: product.seller_id.toString(),
        },
      })

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      })
    })
  } catch (error) {
    console.error("Payment intent creation failed:", error)
    res.status(500).json({ error: "Failed to create payment intent" })
  }
})

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!stripeClient || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Webhook not configured" })
  }

  const sig = req.headers["stripe-signature"]
  let event

  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object
    const { productId, buyerId, sellerId } = paymentIntent.metadata

    db.run(
      `INSERT INTO transactions (buyer_id, seller_id, product_id, amount, status, payment_intent_id, created_at) 
       VALUES (?, ?, ?, ?, 'completed', ?, ?)`,
      [buyerId, sellerId, productId, paymentIntent.amount / 100, paymentIntent.id, new Date().toISOString()],
      (err) => {
        if (!err) {
          db.run("UPDATE products SET status = 'sold' WHERE id = ?", [productId])

          db.run("UPDATE users SET eco_score = eco_score + 15 WHERE id = ?", [buyerId])
          db.run("UPDATE users SET eco_score = eco_score + 20 WHERE id = ?", [sellerId])
        }
      },
    )
  }

  res.json({ received: true })
})

app.post("/api/notifications/contact-seller", authenticateToken, async (req, res) => {
  const { productId, message } = req.body

  db.get(
    `SELECT p.title, u.email, u.username 
     FROM products p 
     JOIN users u ON p.seller_id = u.id 
     WHERE p.id = ?`,
    [productId],
    async (err, result) => {
      if (err || !result) {
        return res.status(404).json({ error: "Product not found" })
      }

      db.get("SELECT username, email FROM users WHERE id = ?", [req.user.userId], async (err, buyer) => {
        if (err || !buyer) {
          return res.status(500).json({ error: "User not found" })
        }

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #15803d;">Interest in Your Product: ${result.title}</h2>
            <p>Hi ${result.username},</p>
            <p>Someone is interested in your product "${result.title}"!</p>
            <p><strong>Message from ${buyer.username}:</strong></p>
            <blockquote style="background: #f0fdf4; padding: 15px; border-left: 4px solid #15803d; margin: 15px 0;">
              ${message}
            </blockquote>
            <p>You can reply directly to this email to contact the buyer.</p>
            <p>Best regards,<br>The EcoMarket Team</p>
          </div>
        `

        await sendEmail(result.email, `Interest in Your Product: ${result.title}`, html)
        res.json({ message: "Notification sent successfully" })
      })
    },
  )
})

app.post("/api/images/optimize", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image provided" })
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return res.status(400).json({ error: "Image optimization not configured" })
  }

  try {
    const result = await uploadToCloudinary(req.file.buffer, "eco-marketplace/optimized")
    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    })
  } catch (error) {
    console.error("Image optimization failed:", error)
    res.status(500).json({ error: "Failed to optimize image" })
  }
})

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Frontend available at: http://localhost:${PORT}`)
})

module.exports = app
