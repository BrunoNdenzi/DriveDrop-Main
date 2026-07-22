/**
 * API routes index
 */
import { Router } from 'express';
import userRoutes from './user.routes';
import shipmentRoutes from './shipment.routes';
import authRoutes from './auth.routes';
import paymentsRoutes from './payments.routes';
import smsRoutes         from './sms.routes';
import smsWebhookRoutes  from './sms-webhook.routes';
import mapsRoutes from './maps.routes';
import applicationRoutes from './application.routes';
import driverRoutes from './driver.routes';
import messagesRoutes from './messages.routes';
import { diagnosticsRoutes } from './diagnostics.routes';
import pricingRoutes from './pricing.routes';
import adminRoutes from './admin.routes';
import emailRoutes from './email.routes';

import pickupVerificationRoutes from './pickupVerification.routes';
import { notificationsRoutes}  from './notifications.routes';

// Commercial Expansion Routes
import commercialRoutes from './commercial';
import integrationsRoutes from './integrations';
import bolRoutes from './bol';
import webhooksRoutes from './webhooks';

// AI-Powered Features
import aiRoutes from './ai.routes';
import routeOptimizationRoutes from './routeOptimization.routes';

// Benji V2 Orchestrator
import benjiRoutes from './benji.routes';

// Benji V3 — parallel LLM-agent implementation (runs alongside V2 during migration)
import benjiV3Router from '../benji-v3/benji.router';

// Lead Acquisition
import leadsRoutes from './leads.routes';

// Outreach
import outreachRoutes from './outreach.routes';

// Email Campaign System
import campaignsRoutes from './campaigns.routes';
import carriersRoutes from './carriers.routes';
import analyticsRoutes from './analytics.routes';
import emailWebhooksRoutes from './email-webhooks.routes';

// Voice Agent (Vapi)
import voiceAgentRoutes from './voice-agent.routes';
// Voice Agent (Retell)
import retellAgentRoutes from './retell-agent.routes';

// File Upload
import uploadRoutes from './upload.routes';

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
      emails: '/api/v1/emails',
      pickupVerification: '/api/v1/shipments (pickup verification endpoints)',
      // Commercial Expansion APIs
      commercial: '/api/v1/commercial',
      integrations: '/api/v1/integrations',
      bol: '/api/v1/bol',
      webhooks: '/api/v1/webhooks',
      ai:           '/api/v1/ai',
      benji:        '/api/v1/benji',
      'benji-v3':   '/api/v1/benji-v3',
      routeOptimization: '/api/v1/route-optimization',
      leads: '/api/v1/leads',
      outreach: '/api/v1/outreach',
      // Email Campaign System
      campaigns: '/api/v1/campaigns',
      carriers: '/api/v1/carriers',
      analytics: '/api/v1/analytics',
      emailWebhooks: '/api/v1/email-webhooks',
      // Voice Agents
      voice:   '/api/v1/voice',
      retell:  '/api/v1/retell',
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
router.use('/sms', smsWebhookRoutes);
router.use('/maps', mapsRoutes);
router.use('/applications', applicationRoutes);
router.use('/drivers', driverRoutes);
router.use('/messages', messagesRoutes);
router.use('/diagnostics', diagnosticsRoutes);
router.use('/pricing', pricingRoutes);
router.use('/admin', adminRoutes);
router.use('/emails', emailRoutes);
router.use('/notifications', notificationsRoutes);

// Commercial Expansion Routes
router.use('/commercial', commercialRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/bol', bolRoutes);
router.use('/webhooks', webhooksRoutes);

// AI-Powered Features
router.use('/ai', aiRoutes);
router.use('/benji', benjiRoutes);
router.use('/benji-v3', benjiV3Router);
router.use('/route-optimization', routeOptimizationRoutes);

// Lead Acquisition
router.use('/leads', leadsRoutes);

// Outreach
router.use('/outreach', outreachRoutes);

// Email Campaign System
router.use('/campaigns', campaignsRoutes);
router.use('/carriers', carriersRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/email-webhooks', emailWebhooksRoutes);

// Voice Agent (Vapi)
router.use('/voice', voiceAgentRoutes);
// Voice Agent (Retell)
router.use('/retell', retellAgentRoutes);

// File Upload
router.use('/upload', uploadRoutes);

export default router;
