# 🚀 Complete Setup Guide - Frontend + Backend

This guide will help you set up both the frontend and backend components of the Card Journey Tracker.

## 📁 Project Structure

```
card-journey-tracker/
├── backend/                    # Node.js API Server
│   ├── server.js
│   ├── config/
│   ├── models/
│   ├── services/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── package.json
├── frontend/                   # React Dashboard
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── context/
│   │   └── App.js
│   └── package.json
└── README.md
```

## 🛠️ Prerequisites

- **Node.js** v16.0.0 or higher
- **npm** v8.0.0 or higher
- **MongoDB Atlas** account (free tier available)
- **Git** for version control

## 📋 Step-by-Step Setup

### 1. Create Project Structure

```bash
# Create main project directory
mkdir card-journey-tracker
cd card-journey-tracker

# Create backend directory
mkdir backend
cd backend
```

### 2. Backend Setup

#### Copy Backend Files
Place all the backend files in the `backend/` directory:
- `server.js`
- `package.json`
- `config/database.js`
- `config/websocket.js`
- `models/CardJourney.js`
- `models/BottleneckAnalysis.js`
- `services/cardService.js`
- `services/analyticsService.js`
- `routes/index.js`
- `routes/cards.js`
- `routes/analytics.js`
- `middleware/index.js`
- `utils/encryption.js`
- `.env.example`
- `.gitignore`

#### Install Backend Dependencies
```bash
cd backend
npm install
```

#### Configure Backend Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your MongoDB Atlas connection
nano .env
```

**Required backend .env variables:**
```bash
NODE_ENV=development
PORT=3001
WS_PORT=8080
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/card_tracker
ENCRYPTION_KEY=your-32-character-secret-key
FRONTEND_URL=http://localhost:3000
```

### 3. MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free cluster
   - Create a database user
   - Whitelist IP address (0.0.0.0/0 for development)

2. **Get Connection String**
   - Click "Connect" → "Connect your application"
   - Copy the connection string
   - Replace `<username>`, `<password>`, and `<database>` with your values

### 4. Start Backend Server

```bash
cd backend
npm run dev
```

**Expected output:**
```
✅ MongoDB Atlas connected successfully
🚀 Server running on port 3001
📊 WebSocket server on port 8080
🌍 Environment: development
```

### 5. Frontend Setup

#### Create React App and Copy Files
```bash
# Go back to main directory
cd ..

# Create frontend directory
npx create-react-app frontend
cd frontend

# Install additional dependencies
npm install axios react-router-dom lucide-react recharts react-hot-toast socket.io-client date-fns react-query zustand
npm install -D tailwindcss autoprefixer postcss
```

#### Setup Tailwind CSS
```bash
npx tailwindcss init -p
```

**Update `tailwind.config.js`:**
```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Update `src/index.css`:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

#### Copy Frontend Files
Replace/create these files in `frontend/src/`:
- `App.js`
- `services/api.js`
- `context/WebSocketContext.js`
- `components/Layout/Layout.js`
- `components/Layout/NotificationPanel.js`
- `components/UI/LoadingSpinner.js` (and ErrorMessage.js)
- `pages/Dashboard.js`
- `pages/CardSearch.js`

#### Configure Frontend Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

**Frontend .env variables:**
```bash
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=ws://localhost:8080
```

### 6. Start Frontend Development Server

```bash
cd frontend
npm start
```

The frontend will open at `http://localhost:3000`

## 🔧 Running Both Services

### Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

### Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

## ✅ Verification Steps

### 1. Test Backend API
```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

### 2. Test Frontend
- Open `http://localhost:3000`
- Check that the dashboard loads
- Verify WebSocket connection (green indicator in header)

### 3. Test Full Integration

#### Create a Test Card:
```bash
curl -X POST http://localhost:3001/api/v1/cards \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "CRD001234",
    "customerId": "CUST789456", 
    "customerName": "Test User",
    "mobileNumber": "9876543210",
    "panMasked": "****-****-****-1234",
    "priority": "STANDARD",
    "address": "Mumbai, Maharashtra"
  }'
```

#### Search for the Card:
- Go to "Track Card" tab
- Search for "CRD001234"
- Verify card details appear

## 🚀 Production Deployment

### Backend Deployment Options:

#### Vercel:
```bash
cd backend
npm install -g vercel
vercel --prod
```

#### Railway:
```bash
npm install -g @railway/cli
railway deploy
```

#### Heroku:
```bash
git init
heroku create your-api-name
git add .
git commit -m "Initial commit"
git push heroku main
```

### Frontend Deployment Options:

#### Vercel:
```bash
cd frontend
vercel --prod
```

#### Netlify:
```bash
npm run build
# Upload build/ folder to Netlify
```

## 🔍 Troubleshooting

### Backend Issues:

#### MongoDB Connection Failed:
```bash
Error: MongoDB connection failed
```
**Solution:**
- Check MongoDB URI in `.env`
- Verify IP whitelist in MongoDB Atlas
- Ensure username/password are correct

#### Port Already in Use:
```bash
Error: listen EADDRINUSE :::3001
```
**Solution:**
```bash
# Kill process using port 3001
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

### Frontend Issues:

#### API Connection Failed:
**Solution:**
- Ensure backend is running on port 3001
- Check `REACT_APP_API_URL` in frontend `.env`
- Verify CORS settings in backend

#### WebSocket Connection Failed:
**Solution:**
- Ensure WebSocket server is running on port 8080
- Check `REACT_APP_WS_URL` in frontend `.env`
- Verify firewall settings

## 📊 Features Available

### ✅ Working Features:
- **Real-time Dashboard** with live metrics
- **Card Search** by multiple identifiers  
- **Journey Timeline** with status tracking
- **WebSocket Notifications** for live updates
- **Analytics Dashboard** with charts
- **Mobile-responsive** design

### 🔄 API Endpoints Available:
- `POST /api/v1/cards` - Create card
- `POST /api/v1/cards/:id/status` - Update status
- `GET /api/v1/cards/search` - Search cards
- `GET /api/v1/analytics/dashboard` - Dashboard data
- `GET /api/v1/analytics/bottlenecks` - Bottleneck analysis

## 🎯 Next Steps

1. **Test with Sample Data:**
   ```bash
   cd backend
   npm run seed
   ```

2. **Configure Webhooks:**
   - Set up external services to call your status update endpoints
   - Use the provided webhook examples

3. **Enable Production Security:**
   - Set strong `ENCRYPTION_KEY`
   - Configure proper `API_KEY`
   - Set up SSL certificates

4. **Monitor Performance:**
   - Use `/api/health` for health checks
   - Monitor `/api/metrics` for performance data

## 🆘 Getting Help

If you encounter issues:

1. Check the console logs in both frontend and backend
2. Verify all environment variables are set correctly
3. Ensure MongoDB Atlas is properly configured
4. Check that all ports (3000, 3001, 8080) are available

**Common URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Health Check: http://localhost:3001/api/health
- WebSocket: ws://localhost:8080
