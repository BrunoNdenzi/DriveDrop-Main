/**
 * Environment variables and configuration
 */
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
  // Server Configuration
  server: {
    port: process.env['PORT'] || 3000,
    nodeEnv: process.env['NODE_ENV'] || 'development',
    apiPrefix: '/api/v1',
    corsOrigin: process.env['CORS_ORIGIN'] ? process.env['CORS_ORIGIN'].split(',') : '*',
    corsMethods: process.env['CORS_METHODS'] || 'GET,POST,PUT,DELETE,PATCH',
    corsCredentials: process.env['CORS_CREDENTIALS'] === 'true',
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env['JWT_SECRET'] || 'your-jwt-secret-here',
    jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '1d',
    jwtRefreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '30d',
    accessTokenTtl: parseInt(process.env['ACCESS_TOKEN_TTL'] || '3600', 10),
  },

  // Supabase Configuration
  supabase: {
    url: process.env['SUPABASE_URL'] || '',
    anonKey: process.env['SUPABASE_ANON_KEY'] || '',
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'] || '',
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'] || '',
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] || '',
    publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] || '',
    priceIdBasic: process.env['STRIPE_PRICE_ID_BASIC'] || '',
    priceIdPremium: process.env['STRIPE_PRICE_ID_PREMIUM'] || '',
    webhookTolerance: parseInt(process.env['STRIPE_WEBHOOK_TOLERANCE'] || '300', 10),
  },

  // Twilio Configuration
  twilio: {
    accountSid: process.env['TWILIO_ACCOUNT_SID'] || '',
    authToken: process.env['TWILIO_AUTH_TOKEN'] || '',
    phoneNumber: process.env['TWILIO_PHONE_NUMBER'] || '',
    verifyServiceSid: process.env['TWILIO_VERIFY_SERVICE_SID'] || '',
  },

  // Google Maps API
  googleMaps: {
    apiKey: process.env['GOOGLE_MAPS_API_KEY'] || '',
  },

  // Logging Configuration
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
  },

  // Rate Limiting
  rateLimit: {
    maxLoginAttempts: parseInt(process.env['MAX_LOGIN_ATTEMPTS'] || '5', 10),
    loginCooldownTime: process.env['LOGIN_COOLDOWN_TIME'] || '15m',
  },
};

// Validate required environment variables
export const validateConfig = (): void => {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

export default config;
