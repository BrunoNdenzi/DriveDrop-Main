/**
 * API routes index
 */
import { Router } from 'express';
import userRoutes from './user.routes';
import shipmentRoutes from './shipment.routes';
import authRoutes from './auth.routes';
import paymentsRoutes from './payments.routes';
import smsRoutes from './sms.routes';
import mapsRoutes from './maps.routes';
import applicationRoutes from './application.routes';
import driverRoutes from './driver.routes';
import messagesRoutes from './messages.routes';
import { diagnosticsRoutes } from './diagnostics.routes';
import pricingRoutes from './pricing.routes';
import adminRoutes from './admin.routes';

import pickupVerificationRoutes from './pickupVerification.routes';
import { notificationsRoutes}  from './notifications.routes';

// Commercial Expansion Routes
import commercialRoutes from './commercial';
import integrationsRoutes from './integrations';
import bolRoutes from './bol';
import dispatcherRoutes from './dispatcher';
import webhooksRoutes from './webhooks';

// AI-Powered Features
import aiRoutes from './ai.routes';

const router = Router();

// API welcome message
router.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to DriveDrop API',
    version: '1.0.0',
    documentation: '/api/v1/docs', // Future Swagger documentation endpoint
    services: {
      authentication: '/api/v1/auth',
      users: '/api/v1/users',
      shipments: '/api/v1/shipments',
      payments: '/api/v1/payments',
      sms: '/api/v1/sms',
      maps: '/api/v1/maps',
      applications: '/api/v1/applications',
      drivers: '/api/v1/drivers',
      messages: '/api/v1/messages',
      admin: '/api/v1/admin',
      notifications: '/api/v1/notifications',
      pickupVerification: '/api/v1/shipments (pickup verification endpoints)',
      // Commercial Expansion APIs
      commercial: '/api/v1/commercial',
      integrations: '/api/v1/integrations',
      bol: '/api/v1/bol',
      dispatcher: '/api/v1/dispatcher',
      webhooks: '/api/v1/webhooks',
      ai: '/api/v1/ai',
    },
  });
});

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/shipments', pickupVerificationRoutes); // Pickup verification routes (must be before shipmentRoutes)
router.use('/shipments', shipmentRoutes);
router.use('/payments', paymentsRoutes);
router.use('/sms', smsRoutes);
router.use('/maps', mapsRoutes);
router.use('/applications', applicationRoutes);
router.use('/drivers', driverRoutes);
router.use('/messages', messagesRoutes);
router.use('/diagnostics', diagnosticsRoutes);
router.use('/pricing', pricingRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationsRoutes);

// Commercial Expansion Routes
router.use('/commercial', commercialRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/bol', bolRoutes);
router.use('/dispatcher', dispatcherRoutes);
router.use('/webhooks', webhooksRoutes);

// AI-Powered Features
router.use('/ai', aiRoutes);

export default router;
