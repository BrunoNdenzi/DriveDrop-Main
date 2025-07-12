/**
 * Payment routes (Stripe)
 */
import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import {
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentIntent,
  createCustomer,
  createRefund,
  handleWebhook,
  addPaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
  createSubscription,
  cancelSubscription,
  getTransactionHistory,
  getPaymentAnalytics,
  createSetupIntent,
} from '@controllers/payments.controller';

const router = Router();

/**
 * @route POST /api/v1/payments/create-intent
 * @desc Create a payment intent for shipment payment
 * @access Private
 */
router.post('/create-intent', authenticate, createPaymentIntent);

/**
 * @route GET /api/v1/payments/intent/:id
 * @desc Get payment intent by ID
 * @access Private
 */
router.get('/intent/:id', authenticate, getPaymentIntent);

/**
 * @route POST /api/v1/payments/confirm/:id
 * @desc Confirm a payment intent
 * @access Private
 */
router.post('/confirm/:id', authenticate, confirmPaymentIntent);

/**
 * @route POST /api/v1/payments/customer
 * @desc Create a Stripe customer
 * @access Private
 */
router.post('/customer', authenticate, createCustomer);

/**
 * @route POST /api/v1/payments/refund
 * @desc Create a refund (Admin only)
 * @access Private (Admin)
 */
router.post('/refund', authenticate, authorize(['admin']), createRefund);

/**
 * @route POST /api/v1/payments/webhook
 * @desc Stripe webhook endpoint
 * @access Public (Stripe webhook)
 */
router.post('/webhook', handleWebhook);

/**
 * @route POST /api/v1/payments/methods
 * @desc Add a payment method to customer
 * @access Private
 */
router.post('/methods', authenticate, addPaymentMethod);

/**
 * @route GET /api/v1/payments/methods/:customerId
 * @desc List customer payment methods
 * @access Private
 */
router.get('/methods/:customerId', authenticate, listPaymentMethods);

/**
 * @route DELETE /api/v1/payments/methods/:id
 * @desc Remove a payment method
 * @access Private
 */
router.delete('/methods/:id', authenticate, removePaymentMethod);

/**
 * @route POST /api/v1/payments/subscriptions
 * @desc Create a subscription
 * @access Private
 */
router.post('/subscriptions', authenticate, createSubscription);

/**
 * @route POST /api/v1/payments/subscriptions/:id/cancel
 * @desc Cancel a subscription
 * @access Private
 */
router.post('/subscriptions/:id/cancel', authenticate, cancelSubscription);

/**
 * @route GET /api/v1/payments/history/:customerId
 * @desc Get customer transaction history
 * @access Private
 */
router.get('/history/:customerId', authenticate, getTransactionHistory);

/**
 * @route GET /api/v1/payments/analytics
 * @desc Get payment analytics (Admin only)
 * @access Private (Admin)
 */
router.get('/analytics', authenticate, authorize(['admin']), getPaymentAnalytics);

/**
 * @route POST /api/v1/payments/setup-intent
 * @desc Create a setup intent for future payments
 * @access Private
 */
router.post('/setup-intent', authenticate, createSetupIntent);

export default router;
