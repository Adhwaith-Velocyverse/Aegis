import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pool from './db/connection';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import mfaRoutes from './routes/mfa';
import forgotPasswordRoutes from './routes/forgot-password';
import assessmentRoutes from './routes/assessments';
import tenantRoutes from './routes/tenants';
import adminRoutes from './routes/admin';
import assessorRoutes from './routes/assessor';
import reportRoutes from './routes/reports';
import billingRoutes from './routes/billing';
import organizationRoutes from './routes/organizations';
import notificationRoutes from './routes/notifications';
import controlsRoutes from './routes/controls';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter, assessmentLimiter } from './middleware/rateLimiter';
import {
  requestId,
  validateContentType,
  requestSizeLimit,
  preventSQLInjection,
  preventNoSQLInjection,
  preventPathTraversal,
  preventCommandInjection,
  sanitizeInput,
  preventPollution,
  securityHeaders,
  ipBlocking,
  validateOrigin,
  cacheControl,
  maskSensitiveData,
  csrfProtection,
} from './middleware/security';
import { auditMiddleware, auditLog } from './middleware/audit';
import { validateEncryptionKey } from './services/encryption';
import worker from './services/worker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Validate encryption key on startup
if (!validateEncryptionKey()) {
  console.warn('WARNING: ENCRYPTION_KEY environment variable is not set. Data encryption at rest is disabled.');
}

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Request logging
app.use(morgan('combined'));

// Request ID
app.use(requestId);

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use(securityHeaders);

// Input validation and sanitization
app.use(validateContentType);
app.use(requestSizeLimit);
app.use(preventSQLInjection);
app.use(preventNoSQLInjection);
app.use(preventPathTraversal);
app.use(preventCommandInjection);
app.use(sanitizeInput);
app.use(preventPollution);

  // IP blocking removed - unlimited login attempts

  // CSRF protection for state-changing requests
app.use(csrfProtection);

// Cache control for sensitive endpoints
app.use(cacheControl);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply rate limiting
  // apiLimiter removed - unlimited requests
  // app.use('/api/', apiLimiter);
  // authLimiter removed - unlimited login attempts
  app.use('/api/assessments/', assessmentLimiter);

// Apply audit logging
app.use(auditMiddleware);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/forgot-password', forgotPasswordRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assessor', assessorRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/controls', controlsRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Test DB connection
    const connection = await pool.getConnection();
    console.log('Database connected successfully');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Aegis backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

// Start BullMQ worker for background assessment processing
worker.on('completed', (job) => {
  console.log(`Assessment job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Assessment job ${job?.id} failed:`, err);
});

console.log('Assessment worker started');

export default app;
