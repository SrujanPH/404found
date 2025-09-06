const sqlite3 = require("sqlite3").verbose()
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")

const db = new sqlite3.Database("./database.db")

async function seedDatabase() {
  try {
    // Read and execute schema
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8")
    const statements = schema.split(";").filter((stmt) => stmt.trim())

    for (const statement of statements) {
      if (statement.trim()) {
        await new Promise((resolve, reject) => {
          db.run(statement, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    }

    console.log("Database schema created successfully")

    // Seed badges
    const badges = [
      {
        name: "Eco Starter",
        description: "Complete your first transaction",
        requirement_type: "transactions",
        requirement_value: 1,
        icon: "🌱",
      },
      {
        name: "Eco Saver",
        description: "Buy or sell 5 items",
        requirement_type: "transactions",
        requirement_value: 5,
        icon: "♻️",
      },
      {
        name: "Green Champion",
        description: "Reach 100 eco score",
        requirement_type: "eco_score",
        requirement_value: 100,
        icon: "🏆",
      },
      {
        name: "Carbon Crusher",
        description: "Save 50kg of CO2",
        requirement_type: "carbon_saved",
        requirement_value: 50,
        icon: "🌍",
      },
      {
        name: "Water Warrior",
        description: "Save 1000L of water",
        requirement_type: "water_saved",
        requirement_value: 1000,
        icon: "💧",
      },
    ]

    for (const badge of badges) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT OR IGNORE INTO badges (name, description, requirement_type, requirement_value, icon) VALUES (?, ?, ?, ?, ?)",
          [badge.name, badge.description, badge.requirement_type, badge.requirement_value, badge.icon],
          (err) => {
            if (err) reject(err)
            else resolve()
          },
        )
      })
    }

    // Seed demo users
    const hashedPassword = await bcrypt.hash("demo123", 10)

    const demoUsers = [
      { username: "alice_green", email: "alice@example.com", full_name: "Alice Green", location: "San Francisco, CA" },
      { username: "bob_eco", email: "bob@example.com", full_name: "Bob Eco", location: "Portland, OR" },
      { username: "carol_sustain", email: "carol@example.com", full_name: "Carol Sustain", location: "Seattle, WA" },
    ]

    for (const user of demoUsers) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT OR IGNORE INTO users (username, email, password, full_name, location, eco_score) VALUES (?, ?, ?, ?, ?, ?)",
          [user.username, user.email, hashedPassword, user.full_name, user.location, Math.floor(Math.random() * 100)],
          (err) => {
            if (err) reject(err)
            else resolve()
          },
        )
      })
    }

    // Seed demo products
    const demoProducts = [
      {
        seller_id: 1,
        title: "Vintage Leather Jacket",
        description: "Beautiful vintage leather jacket in excellent condition. Perfect for sustainable fashion lovers.",
        price: 85.0,
        category: "clothing",
        condition: "excellent",
        location: "San Francisco, CA",
        eco_score: 80,
      },
      {
        seller_id: 2,
        title: "iPhone 12 - Unlocked",
        description: "iPhone 12 in good condition, battery health 89%. Comes with original charger.",
        price: 450.0,
        category: "electronics",
        condition: "good",
        location: "Portland, OR",
        eco_score: 70,
      },
      {
        seller_id: 3,
        title: "Wooden Coffee Table",
        description: "Handcrafted wooden coffee table. Minor scratches but very sturdy.",
        price: 120.0,
        category: "furniture",
        condition: "good",
        location: "Seattle, WA",
        eco_score: 75,
      },
    ]

    for (const product of demoProducts) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO products (seller_id, title, description, price, category, condition, location, eco_score, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            product.seller_id,
            product.title,
            product.description,
            product.price,
            product.category,
            product.condition,
            product.location,
            product.eco_score,
            "[]",
          ],
          (err) => {
            if (err) reject(err)
            else resolve()
          },
        )
      })
    }

    console.log("Database seeded successfully")
  } catch (error) {
    console.error("Error seeding database:", error)
  } finally {
    db.close()
  }
}

seedDatabase()
