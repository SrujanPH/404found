# Eco-Friendly Marketplace Backend

A Node.js/Express backend API for a sustainable second-hand marketplace platform.

## Features

- JWT-based authentication
- Product listing and search with filters
- Messaging system between buyers and sellers
- Eco-friendly features (carbon footprint tracking, badges)
- Admin moderation tools
- File upload support
- SQLite database with comprehensive schema

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Set up environment variables:**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

3. **Initialize database:**
   \`\`\`bash
   npm run seed
   \`\`\`

4. **Start development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

The API will be available at `http://localhost:5013`

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Products
- `GET /api/products` - Get products with filters
- `POST /api/products` - Create new product (auth required)

### Wishlist
- `GET /api/wishlist` - Get user's wishlist (auth required)
- `POST /api/wishlist/:productId` - Add to wishlist (auth required)
- `DELETE /api/wishlist/:productId` - Remove from wishlist (auth required)

### Eco Features
- `GET /api/eco/impact` - Get community impact stats
- `GET /api/eco/badges/:userId` - Get user's eco badges

### Messaging
- `GET /api/messages/:conversationId` - Get conversation messages (auth required)

## Database Schema

The application uses SQLite with the following main tables:
- `users` - User accounts and profiles
- `products` - Product listings
- `wishlist` - User wishlists
- `conversations` & `messages` - Messaging system
- `transactions` - Purchase tracking for eco metrics
- `badges` & `user_badges` - Gamification system
- `reports` - Content moderation

## Deployment

### Render/Heroku
1. Create new app
2. Set environment variables
3. Deploy from Git repository
4. Run database seed command

### Environment Variables for Production
- `JWT_SECRET` - Strong secret key
- `NODE_ENV=production`
- `PORT` - Will be set by hosting platform
- External API keys as needed

## File Structure

\`\`\`
backend/
├── server.js              # Main Express server
├── database/
│   ├── schema.sql         # Database schema
│   └── seed.js           # Database seeding script
├── uploads/              # File upload directory
├── package.json
├── .env.example
└── README.md
