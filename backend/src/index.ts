import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import 'module-alias/register';

// Config and utilities
import config, { validateConfig } from '@config';
import { logger } from '@utils/logger';
import { errorHandler } from '@middlewares/error.middleware';

// Routes
import apiRoutes from '@routes/index';
import healthRoutes from '@routes/health.routes';

// Load environment variables
dotenv.config();

// Validate required environment variables
try {
  validateConfig();
} catch (error) {
  if (error instanceof Error) {
    console.error(`❌ Environment validation failed: ${error.message}`);
  }
  process.exit(1);
}

// Initialize Express app
const app = express();
const PORT = config.server.port;

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.server.corsOrigin,
  methods: config.server.corsMethods,
  credentials: config.server.corsCredentials,
}));
app.use(morgan('combined'));

// Stripe webhook route MUST come before express.json() to receive raw body
// This route needs the raw body for signature verification
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));

// Apply JSON parsing to all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes); // Additional mounting for /api/health
app.use(`${config.server.apiPrefix}`, apiRoutes);

// Error handler
app.use(errorHandler);

// 404 handler - add this after all other routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found`,
    },
  });
});

// Start the server
const port = Number(PORT);
app.listen(port, '0.0.0.0', () => {
  logger.info(`🚀 DriveDrop API server running on port ${port}`);
  logger.info(`📱 Health check: http://localhost:${port}/health`);
  logger.info(`🔗 API: http://localhost:${port}${config.server.apiPrefix}`);
  logger.info(`🌐 Network: http://0.0.0.0:${port}${config.server.apiPrefix}`);
});
