require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const app = express();

// Connect DB
connectDB();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // Allow any localhost port (Flutter web dev server uses random ports)
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    // Allow configured client URL (supports comma-separated list for multiple origins,
    // e.g. "https://myapp.vercel.app,https://myapp.com")
    const allowed = (process.env.CLIENT_URL || '').split(',').map(u => u.trim());
    if (allowed.includes(origin)) return callback(null, true);
    // Allow any *.vercel.app subdomain (preview deployments)
    if (/^https:\/\/[^.]+\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
// General API limiter — generous, since many users at a school share one public
// IP and an active app makes lots of polling calls. (200 was far too low and
// caused legitimate requests, including login, to be blocked with 429.)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 3000 : 100000,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use('/api', limiter);

// Brute-force guard for auth — only FAILED attempts count (skipSuccessfulRequests),
// so genuine logins are never throttled, while password-guessing is limited.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many failed login attempts. Please try again in a few minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', require('./routes/index'));

// SMS Scheduler
const { startScheduler } = require('./utils/scheduler');
startScheduler();

// Billing scheduler (auto-expire + reminder emails) + seed default subscription plans
const { startBillingScheduler } = require('./utils/billingScheduler');
startBillingScheduler();
require('./controllers/superAdminController').seedDefaultPlans().catch(e => console.error('Plan seed error:', e.message));

// Serve React frontend in production (built by Railway before starting the server).
// Guard on the build actually existing so a frontend build hiccup can't crash the
// API server — the backend still boots and serves /api and /health.
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist));
    // Catch-all: send index.html for any non-API route (React Router)
    // Express 5 requires a named wildcard — '*' alone throws a PathError
    app.get('/{*path}', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  } else {
    console.warn('[startup] frontend/dist not found — serving API only.');
  }
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 School Management Server running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;
// Trigger restart
