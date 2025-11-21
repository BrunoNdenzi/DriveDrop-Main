/**
 * Payment routes for Stripe integration
 */
import express from 'express';
import { paymentsController } from '@controllers/payments.controller';
import { authenticate } from '@middlewares/auth.middleware';

const router = express.Router();

// Payment intent routes
router.post(
  '/create-intent',
  authenticate,
  paymentsController.createPaymentIntent
);

router.get(
  '/intent/:id',
  authenticate,
  paymentsController.getPaymentIntent
);

router.post(
  '/confirm/:id',
  authenticate,
  paymentsController.confirmPaymentIntent
);

// Notify payment success (trigger emails)
router.post(
  '/notify-payment-success',
  authenticate,
  paymentsController.notifyPaymentSuccess
);

// Customer routes
router.post(
  '/customer',
  authenticate,
  paymentsController.createCustomer
);

// Payment method routes
router.post(
  '/methods',
  authenticate,
  paymentsController.addPaymentMethod
);

router.get(
  '/methods/:customerId',
  authenticate,
  paymentsController.listPaymentMethods
);

router.delete(
  '/methods/:id',
  authenticate,
  paymentsController.removePaymentMethod
);

// Refund routes (admin only)
router.post(
  '/refund',
  authenticate,
  paymentsController.createRefund
);

// New split payment routes
router.get(
  '/:id/refund-eligibility',
  authenticate,
  paymentsController.checkRefundEligibility
);

router.post(
  '/:id/refund',
  authenticate,
  paymentsController.processRefund
);

router.post(
  '/:id/final-payment',
  authenticate,
  paymentsController.createFinalPayment
);

// Webhook endpoint (no authentication)
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentsController.handleWebhook
);

// Setup intent for future payments
router.post(
  '/setup-intent',
  authenticate,
  paymentsController.createSetupIntent
);

// Subscription routes
router.post(
  '/subscriptions',
  authenticate,
  paymentsController.createSubscription
);

router.post(
  '/subscriptions/:id/cancel',
  authenticate,
  paymentsController.cancelSubscription
);

// Transaction history
router.get(
  '/history/:customerId',
  authenticate,
  paymentsController.getTransactionHistory
);

// Analytics (admin only)
router.get(
  '/analytics',
  authenticate,
  paymentsController.getPaymentAnalytics
);

// Payment config - public endpoint for mobile app initialization
router.get(
  '/config',
  paymentsController.getConfig
);

// Diagnostic routes
router.get(
  '/stripe-status',
  authenticate,
  paymentsController.checkStripeStatus
);

router.get(
  '/status',
  authenticate,
  paymentsController.getPaymentStatus
);

export default router;
