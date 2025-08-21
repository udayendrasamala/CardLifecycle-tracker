# Card Journey Tracker API

> Complete end-to-end card lifecycle tracking and analytics system with MongoDB Atlas, WebSocket real-time updates, and AI-powered bottleneck detection.

## 🚀 Features

- **Complete Card Lifecycle Tracking** - From approval to delivery/destruction
- **Real-time Updates** - WebSocket-based live notifications
- **Multi-identifier Search** - Card ID, PAN, mobile number, customer name
- **AI-Powered Analytics** - Automated bottleneck detection and recommendations
- **Performance Monitoring** - SLA tracking, capacity analysis, and forecasting
- **Secure Data Handling** - Encrypted PII storage and secure API endpoints
- **Webhook Integration** - Ready for external service integration
- **Comprehensive APIs** - RESTful endpoints for all operations

## 📋 Prerequisites

- **Node.js** v16.0.0 or higher
- **npm** v8.0.0 or higher
- **MongoDB Atlas** account (free tier available)
- **Git** for version control

## 🛠️ Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd card-journey-tracker-api

# Install dependencies
npm install
```

### 2. Database Setup

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a free cluster
   - Create a database user
   - Whitelist your IP address

2. **Get Connection String**
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/card_tracker?retryWrites=true&w=majority
   ```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

**Required Environment Variables:**
```bash
NODE_ENV=development
PORT=3001
WS_PORT=8080
MONGODB_URI=your-mongodb-atlas-connection-string
ENCRYPTION_KEY=your-32-character-secret-key
FRONTEND_URL=http://localhost:3000
```

### 4. Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 5. Verify Installation

```bash
# Test API health
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api/v1
```

### Card Management

#### Create Card Journey
```bash
POST /api/v1/cards
Content-Type: application/json

{
  "cardId": "CRD001234",
  "customerId": "CUST789456",
  "customerName": "John Doe",
  "mobileNumber": "9876543210",
  "panMasked": "****-****-****-1234",
  "applicationId": "APP123456",
  "priority": "EXPRESS",
  "address": "Mumbai, Maharashtra"
}
```

#### Update Card Status (Webhook)
```bash
POST /api/v1/cards/CRD001234/status
X-API-Key: your-api-key
Content-Type: application/json

{
  "status": "IN_EMBOSSING",
  "source": "embossing_service",
  "location": "Mumbai Facility",
  "operatorId": "OP123",
  "batchId": "BATCH789"
}
```

#### Search Cards
```bash
# Search by Card ID
GET /api/v1/cards/search?q=CRD001234

# Search by PAN
GET /api/v1/cards/search?q=****-****-****-1234

# Search by Customer Name
GET /api/v1/cards/search?q=John
```

### Analytics

#### Dashboard Metrics
```bash
GET /api/v1/analytics/dashboard?timeRange=24h
```

#### Bottleneck Analysis
```bash
GET /api/v1/analytics/bottlenecks
```

#### Performance Trends
```bash
GET /api/v1/analytics/trends?days=30
```

#### Trigger Manual Analysis
```bash
POST /api/v1/analytics/analyze
```

## 🔌 WebSocket Integration

### Connect to Real-time Updates

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to Card Journey Tracker');
};

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  
  switch (update.type) {
    case 'card_created':
      console.log('New card created:', update.data);
      break;
    case 'status_updated':
      console.log('Card status updated:', update.data);
      break;
    case 'bottleneck_analysis_complete':
      console.log('New bottleneck analysis:', update.data);
      break;
  }
};
```

### WebSocket Events

- `connection_established` - Client connected successfully
- `card_created` - New card journey created
- `status_updated` - Card status changed
- `bottleneck_analysis_complete` - AI analysis finished
- `new_insights` - New recommendations available

## 🏗️ Architecture

```
├── server.js                 # Main application entry
├── config/
│   ├── database.js           # MongoDB Atlas connection
│   └── websocket.js          # WebSocket configuration
├── models/
│   ├── CardJourney.js        # Card data model
│   └── BottleneckAnalysis.js # Analytics model
├── services/
│   ├── cardService.js        # Business logic
│   └── analyticsService.js   # AI analytics
├── routes/
│   ├── cards.js              # Card management
│   └── analytics.js          # Analytics endpoints
├── middleware/
│   └── index.js              # Custom middleware
└── utils/
    └── encryption.js         # Data encryption
```

## 🔐 Security Features

- **Data Encryption** - PII fields encrypted at rest
- **API Key Authentication** - Webhook endpoint protection
- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Request validation and sanitization
- **Security Headers** - Helmet.js protection
- **CORS Configuration** - Cross-origin request handling

## 📊 Monitoring & Analytics

### Available Metrics
- **Card Volume** - Total cards processed
- **Status Distribution** - Cards by current status
- **Performance Trends** - Processing time analysis
- **Regional Performance** - Geographic success rates
- **SLA Compliance** - Delivery time adherence
- **Capacity Utilization** - Resource usage tracking

### AI-Powered Insights
- **Bottleneck Detection** - Automatic delay identification
- **Performance Optimization** - Process improvement suggestions
- **Capacity Planning** - Volume forecasting
- **Alert Generation** - Proactive issue notification
