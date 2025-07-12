/**
 * Stripe payment controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { stripeService } from '@services/stripe.service';
import { logger } from '@utils/logger';
import config from '@config/index';
import Stripe from 'stripe';

/**
 * Create payment intent for shipment
 * @route POST /api/v1/payments/create-intent
 * @access Private
 */
export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const { amount, currency = 'usd', shipmentId, description } = req.body;

  if (!amount || amount <= 0) {
    throw createError('Invalid amount', 400, 'INVALID_AMOUNT');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const paymentIntent = await stripeService.createPaymentIntent({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    clientId: req.user.id,
    shipmentId,
    description,
    metadata: {
      userId: req.user.id,
      userEmail: req.user.email,
    },
  });

  res.status(201).json(successResponse({
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
  }));
});

/**
 * Get payment intent by ID
 * @route GET /api/v1/payments/intent/:id
 * @access Private
 */
export const getPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Payment intent ID is required', 400, 'MISSING_ID');
  }

  const paymentIntent = await stripeService.getPaymentIntent(id);

  // Verify ownership (only allow user who created the intent or admin)
  if (req.user?.role !== 'admin' && paymentIntent.metadata['clientId'] !== req.user?.id) {
    throw createError('Access denied', 403, 'FORBIDDEN');
  }

  res.status(200).json(successResponse({
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    created: paymentIntent.created,
    metadata: paymentIntent.metadata,
  }));
});

/**
 * Confirm payment intent
 * @route POST /api/v1/payments/confirm/:id
 * @access Private
 */
export const confirmPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { paymentMethodId } = req.body;

  if (!id) {
    throw createError('Payment intent ID is required', 400, 'MISSING_ID');
  }

  if (!paymentMethodId) {
    throw createError('Payment method ID is required', 400, 'MISSING_PAYMENT_METHOD');
  }

  const paymentIntent = await stripeService.confirmPaymentIntent(id, paymentMethodId);

  res.status(200).json(successResponse({
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  }));
});

/**
 * Create Stripe customer
 * @route POST /api/v1/payments/customer
 * @access Private
 */
export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone } = req.body;

  if (!req.user?.email) {
    throw createError('User email is required', 400, 'MISSING_EMAIL');
  }

  const customer = await stripeService.createCustomer(
    req.user.email,
    name || `${req.user.id}`,
    phone
  );

  res.status(201).json(successResponse({
    customerId: customer.id,
    email: customer.email,
    name: customer.name,
  }));
});

/**
 * Create refund
 * @route POST /api/v1/payments/refund
 * @access Private (Admin only)
 */
export const createRefund = asyncHandler(async (req: Request, res: Response) => {
  const { paymentIntentId, amount, reason } = req.body;

  if (!paymentIntentId) {
    throw createError('Payment intent ID is required', 400, 'MISSING_PAYMENT_INTENT');
  }

  // Only admins can create refunds
  if (req.user?.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const refund = await stripeService.createRefund(paymentIntentId, amount, reason);

  res.status(201).json(successResponse({
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    reason: refund.reason,
  }));
});

/**
 * Webhook endpoint for Stripe events
 * @route POST /api/v1/payments/webhook
 * @access Public (Stripe webhook)
 */
export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    throw createError('Missing Stripe signature', 400, 'MISSING_SIGNATURE');
  }

  if (!config.stripe.webhookSecret) {
    throw createError('Webhook secret not configured', 500, 'WEBHOOK_CONFIG_ERROR');
  }

  try {
    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(
      req.body,
      signature as string,
      config.stripe.webhookSecret
    );

    // Handle the event
    await stripeService.handleWebhookEvent(event);

    logger.info('Webhook processed successfully', {
      eventType: event.type,
      eventId: event.id,
    });

    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', { error });
    throw error;
  }
});

/**
 * Add payment method to customer
 * @route POST /api/v1/payments/methods
 * @access Private
 */
export const addPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { paymentMethodId, isDefault } = req.body;

  if (!paymentMethodId) {
    throw createError('Payment method ID is required', 400, 'MISSING_PAYMENT_METHOD');
  }

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Get the customer ID (assuming it's stored in the user's metadata or your database)
  // For demo purposes, we'll pass it directly
  const { customerId } = req.body;

  if (!customerId) {
    throw createError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
  }

  const paymentMethod = await stripeService.addPaymentMethod({
    customerId,
    paymentMethodId,
    isDefault,
  });

  res.status(201).json(successResponse({
    paymentMethodId: paymentMethod.id,
    type: paymentMethod.type,
    card: paymentMethod.card,
    added: true,
  }));
});

/**
 * List customer payment methods
 * @route GET /api/v1/payments/methods/:customerId
 * @access Private
 */
export const listPaymentMethods = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { type = 'card' } = req.query;

  if (!customerId) {
    throw createError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
  }

  // Verify ownership (only allow user who owns the customer or admin)
  // Implementation depends on how you store customerId <-> userId mapping
  
  const paymentMethods = await stripeService.listPaymentMethods(
    customerId, 
    type as Stripe.PaymentMethodListParams.Type
  );

  res.status(200).json(successResponse({
    paymentMethods: paymentMethods.data.map(method => ({
      id: method.id,
      type: method.type,
      card: method.type === 'card' ? {
        brand: method.card?.brand,
        last4: method.card?.last4,
        expMonth: method.card?.exp_month,
        expYear: method.card?.exp_year,
      } : undefined,
      created: method.created,
    })),
  }));
});

/**
 * Remove payment method
 * @route DELETE /api/v1/payments/methods/:id
 * @access Private
 */
export const removePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    throw createError('Payment method ID is required', 400, 'MISSING_ID');
  }

  // Verify ownership (only allow user who owns the payment method or admin)
  // Implementation depends on how you store payment method <-> user mapping

  const paymentMethod = await stripeService.removePaymentMethod(id);

  res.status(200).json(successResponse({
    paymentMethodId: paymentMethod.id,
    removed: true,
  }));
});

/**
 * Create subscription
 * @route POST /api/v1/payments/subscriptions
 * @access Private
 */
export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, priceId, paymentMethodId, metadata } = req.body;

  if (!customerId || !priceId) {
    throw createError('Customer ID and price ID are required', 400, 'MISSING_REQUIRED_FIELDS');
  }

  // Verify ownership (only allow user who owns the customer or admin)
  
  const subscription = await stripeService.createSubscription(
    customerId,
    priceId,
    paymentMethodId,
    metadata
  );

  const subscriptionData = subscription as unknown as {
    id: string;
    status: string;
    current_period_end: number;
    customer: string;
  };

  res.status(201).json(successResponse({
    subscriptionId: subscriptionData.id,
    status: subscriptionData.status,
    currentPeriodEnd: subscriptionData.current_period_end,
    customer: subscriptionData.customer,
  }));
});

/**
 * Cancel subscription
 * @route POST /api/v1/payments/subscriptions/:id/cancel
 * @access Private
 */
export const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cancelAtPeriodEnd = false } = req.body;

  if (!id) {
    throw createError('Subscription ID is required', 400, 'MISSING_ID');
  }

  // Verify ownership (only allow user who owns the subscription or admin)
  
  const subscription = await stripeService.cancelSubscription(id, cancelAtPeriodEnd);

  res.status(200).json(successResponse({
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd,
  }));
});

/**
 * Get customer transaction history
 * @route GET /api/v1/payments/history/:customerId
 * @access Private
 */
export const getTransactionHistory = asyncHandler(async (req: Request, res: Response) => {
  const { customerId } = req.params;
  const { limit = 25, startingAfter } = req.query;

  if (!customerId) {
    throw createError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
  }

  // Verify ownership (only allow user who owns the customer or admin)
  
  const history = await stripeService.getCustomerTransactionHistory(
    customerId,
    Number(limit),
    startingAfter as string
  );

  res.status(200).json(successResponse({
    transactions: history.data.map(intent => ({
      id: intent.id,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      created: intent.created,
      description: intent.description,
    })),
    hasMore: history.has_more,
  }));
});

/**
 * Get payment analytics
 * @route GET /api/v1/payments/analytics
 * @access Private (Admin only)
 */
export const getPaymentAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, limit = 100 } = req.query;

  if (!startDate || !endDate) {
    throw createError('Start date and end date are required', 400, 'MISSING_DATE_RANGE');
  }

  // Only admins can access analytics
  if (req.user?.role !== 'admin') {
    throw createError('Admin access required', 403, 'FORBIDDEN');
  }

  const analytics = await stripeService.getPaymentAnalytics(
    Number(startDate),
    Number(endDate),
    Number(limit)
  );

  res.status(200).json(successResponse({
    totalAmount: analytics.totalAmount,
    successfulPayments: analytics.successfulPayments,
    failedPayments: analytics.failedPayments,
    conversionRate: analytics.successfulPayments / 
      (analytics.successfulPayments + analytics.failedPayments || 1) * 100,
    transactions: analytics.paymentIntents.map(intent => ({
      id: intent.id,
      amount: intent.amount,
      status: intent.status,
      created: intent.created,
    })),
  }));
});

/**
 * Create setup intent for future payments
 * @route POST /api/v1/payments/setup-intent
 * @access Private
 */
export const createSetupIntent = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, metadata } = req.body;

  if (!customerId) {
    throw createError('Customer ID is required', 400, 'MISSING_CUSTOMER_ID');
  }

  // Verify ownership (only allow user who owns the customer or admin)
  
  const setupIntent = await stripeService.createSetupIntent(customerId, metadata);

  res.status(201).json(successResponse({
    setupIntentId: setupIntent.id,
    clientSecret: setupIntent.client_secret,
    status: setupIntent.status,
  }));
});
