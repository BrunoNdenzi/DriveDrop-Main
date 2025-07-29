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
import { diagnosticsRoutes } from './diagnostics.routes';

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
    },
  });
});

// Register routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/shipments', shipmentRoutes);
router.use('/payments', paymentsRoutes);
router.use('/sms', smsRoutes);
router.use('/maps', mapsRoutes);
router.use('/applications', applicationRoutes);
router.use('/drivers', driverRoutes);
router.use('/diagnostics', diagnosticsRoutes);

export default router;
