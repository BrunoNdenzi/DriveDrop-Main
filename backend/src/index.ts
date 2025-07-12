import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Config and utilities
import config, { validateConfig } from '@config/index';
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
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
app.listen(PORT, () => {
  logger.info(`🚀 DriveDrop API server running on port ${PORT}`);
  logger.info(`📱 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔗 API: http://localhost:${PORT}${config.server.apiPrefix}`);
});
