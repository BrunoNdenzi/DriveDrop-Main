/**
 * Stripe payment controller
 */
import { Request, Response } from 'express';
import { asyncHandler, createError } from '@utils/error';
import { successResponse } from '@utils/response';
import { stripeService } from '@services/stripe.service';
import { logger } from '@utils/logger';
import config from '@config';
import Stripe from 'stripe';
import { getConfig } from './payments.controller.getConfig';
import { supabase } from '@lib/supabase';

// All payment controller functions will be exported at the end of this file
// This prevents the "Block-scoped variable used before declaration" TypeScript error

/**
 * Create payment intent for shipment
 * @route POST /api/v1/payments/create-intent
 * @access Private
 */
export const createPaymentIntent = asyncHandler(async (req: Request, res: Response) => {
  const { amount, currency = 'usd', shipmentId } = req.body;

  logger.info('Received payment intent creation request', {
    amount,
    currency,
    shipmentId,
    user: req.user?.id
  });

  if (!amount || amount <= 0) {
    logger.warn('Invalid amount for payment intent', { amount });
    throw createError('Invalid amount', 400, 'INVALID_AMOUNT');
  }

  if (!req.user?.id) {
    logger.error('Authentication error in payment intent creation', {
      user: req.user,
      headers: req.headers,
    });
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: Math.round(amount * 0.20 * 100), // 20% initial payment in cents
      currency,
      clientId: req.user.id,
      shipmentId,
      description: `Initial 20% payment for DriveDrop shipment ${shipmentId}`,
      metadata: {
        userId: req.user.id,
        userEmail: req.user.email,
        isInitialPayment: 'true',
        totalAmount: Math.round(amount * 100).toString(),
        remainingAmount: Math.round(amount * 0.80 * 100).toString(),
      },
    });

    // Create payment record in database
    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        shipment_id: shipmentId,
        client_id: req.user.id, // Use client_id not user_id to match the database schema
        amount: Math.round(amount * 100), // Total amount in cents
        initial_amount: Math.round(amount * 0.20 * 100), // 20% in cents
        remaining_amount: Math.round(amount * 0.80 * 100), // 80% in cents
        payment_intent_id: paymentIntent.id,
        status: 'pending',
        booking_timestamp: new Date().toISOString(),
        refund_deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      });

    if (paymentError) {
      logger.error('Failed to create payment record', { error: paymentError, shipmentId });
      throw createError('Failed to record payment', 500, 'PAYMENT_RECORD_FAILED');
    }

    logger.info('Successfully created payment intent', {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      initialAmount: Math.round(amount * 0.20 * 100),
      totalAmount: Math.round(amount * 100),
    });

    res.status(201).json(successResponse({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
    }));
  } catch (error) {
    // Log the detailed error
    logger.error('Failed to create payment intent', {
      error,
      user: req.user?.id,
      amount,
      shipmentId,
    });
    
    // Re-throw with more details for better client-side debugging
    throw createError(
      error instanceof Error ? `Payment intent creation failed: ${error.message}` : 'Payment intent creation failed',
      400,
      'PAYMENT_INTENT_FAILED'
    );
  }
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

  logger.info('Payment intent confirmation request received', {
    paymentIntentId: id,
    paymentMethodId,
    userId: req.user?.id
  });

  if (!id) {
    logger.warn('Missing payment intent ID in confirmation request');
    throw createError('Payment intent ID is required', 400, 'MISSING_ID');
  }

  if (!paymentMethodId) {
    logger.warn('Missing payment method ID in confirmation request', { paymentIntentId: id });
    throw createError('Payment method ID is required', 400, 'MISSING_PAYMENT_METHOD');
  }

  const paymentIntent = await stripeService.confirmPaymentIntent(id, paymentMethodId);

  logger.info('Payment intent confirmation successful', {
    paymentIntentId: id,
    status: paymentIntent.status,
    userId: req.user?.id
  });

  res.status(200).json(successResponse({
    id: paymentIntent.id,
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

/**
 * Check Stripe service status
 * @route GET /api/v1/payments/stripe-status
 * @access Private
 */
export const checkStripeStatus = asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Try to connect to Stripe API
    const isConnected = await stripeService.verifyConnectivity();
    
    if (!isConnected) {
      throw createError('Stripe service is currently unavailable', 503, 'STRIPE_SERVICE_UNAVAILABLE');
    }
    
    res.status(200).json(successResponse({
      success: true,
      message: 'Stripe service is available',
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('Stripe status check failed', { error });
    throw createError(
      'Failed to verify Stripe service status',
      503,
      'STRIPE_STATUS_CHECK_FAILED'
    );
  }
});

/**
 * Get payment API status
 * @route GET /api/v1/payments/status
 * @access Private
 */
export const getPaymentStatus = asyncHandler(async (_req: Request, res: Response) => {
  // Return payment API status
  res.status(200).json(successResponse({
    success: true,
    message: 'Payment API is operational',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    endpoints: {
      paymentIntent: '/api/v1/payments/create-intent',
      webhook: '/api/v1/payments/webhook',
      customer: '/api/v1/payments/customer',
      stripeStatus: '/api/v1/payments/stripe-status',
    }
  }));
});

/**
 * Check refund eligibility
 * @route GET /api/v1/payments/:id/refund-eligibility
 * @access Private
 */
export const checkRefundEligibility = asyncHandler(async (req: Request, res: Response) => {
  const { id: paymentId } = req.params;

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Get payment details
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('client_id', req.user.id)
    .single();

  if (error || !payment) {
    throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  // Check eligibility using database function
  const { data: isEligible, error: eligibilityError } = await supabase
    .rpc('check_refund_eligibility', { payment_id: paymentId });

  if (eligibilityError) {
    logger.error('Error checking refund eligibility', { error: eligibilityError, paymentId });
    throw createError('Failed to check refund eligibility', 500, 'ELIGIBILITY_CHECK_FAILED');
  }

  const now = new Date();
  const refundDeadline = new Date(payment.refund_deadline);
  const timeRemaining = Math.max(0, refundDeadline.getTime() - now.getTime());

  res.status(200).json(successResponse({
    isEligible: !!isEligible,
    timeRemainingMs: timeRemaining,
    refundDeadline: payment.refund_deadline,
    paymentType: payment.payment_type,
    amount: payment.initial_amount || payment.amount,
    status: payment.status,
  }));
});

/**
 * Process refund for initial payment
 * @route POST /api/v1/payments/:id/refund
 * @access Private
 */
export const processRefund = asyncHandler(async (req: Request, res: Response) => {
  const { id: paymentId } = req.params;
  const { reason } = req.body;

  if (!req.user?.id) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  // Check refund eligibility
  const { data: isEligible, error: eligibilityError } = await supabase
    .rpc('check_refund_eligibility', { payment_id: paymentId });

  if (eligibilityError || !isEligible) {
    throw createError('Payment is not eligible for refund', 400, 'REFUND_NOT_ELIGIBLE');
  }

  // Get payment details
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('client_id', req.user.id)
    .single();

  if (paymentError || !payment) {
    throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  }

  try {
    // Process refund through Stripe
    const refund = await stripeService.createRefund(
      payment.payment_intent_id,
      payment.initial_amount || payment.amount,
      reason
    );

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        is_refundable: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      logger.error('Failed to update payment status after refund', { error: updateError, paymentId });
      throw createError('Failed to update payment status', 500, 'UPDATE_FAILED');
    }

    res.status(200).json(successResponse({
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status,
      message: 'Refund processed successfully',
    }));
  } catch (error) {
    logger.error('Refund processing failed', { error, paymentId });
    throw createError('Failed to process refund', 500, 'REFUND_FAILED');
  }
});

/**
 * Create final payment intent (80%)
 * @route POST /api/v1/payments/:id/final-payment
 * @access Private
 */
export const createFinalPayment = asyncHandler(async (req: Request, res: Response) => {
  const { id: parentPaymentId } = req.params;
  const { shipmentId } = req.body;

  if (!req.user?.id || !parentPaymentId) {
    throw createError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    // Get final payment details using database function
    const { data: paymentDetails, error: detailsError } = await supabase
      .rpc('create_final_payment', {
        p_shipment_id: shipmentId,
        p_user_id: req.user.id,
        p_parent_payment_id: parentPaymentId,
      });

    if (detailsError || !paymentDetails || paymentDetails.length === 0) {
      throw createError('Invalid parent payment or final payment already exists', 400, 'INVALID_PAYMENT');
    }

    const { payment_intent_amount, payment_intent_description } = paymentDetails[0];

    // Create final payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: payment_intent_amount,
      currency: 'usd',
      clientId: req.user.id,
      shipmentId,
      description: payment_intent_description,
      metadata: {
        userId: req.user.id,
        userEmail: req.user.email,
        isFinalPayment: 'true',
        parentPaymentId,
      },
    });

    // Create final payment record
    const { error: paymentRecordError } = await supabase
      .from('payments')
      .insert({
        shipment_id: shipmentId,
        client_id: req.user.id,
        amount: payment_intent_amount,
        payment_intent_id: paymentIntent.id,
        status: 'pending',
        payment_type: 'final',
        parent_payment_id: parentPaymentId,
        is_refundable: false,
      });

    if (paymentRecordError) {
      logger.error('Failed to create final payment record', { error: paymentRecordError, shipmentId });
      throw createError('Failed to record final payment', 500, 'PAYMENT_RECORD_FAILED');
    }

    res.status(201).json(successResponse({
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      type: 'final',
    }));
  } catch (error) {
    logger.error('Final payment creation failed', { error, parentPaymentId, shipmentId });
    throw error;
  }
});

// Export all payment controllers after they've been defined
// Export all controller functions

export const paymentsController = {
  createPaymentIntent,
  getPaymentIntent,
  confirmPaymentIntent,
  createCustomer,
  addPaymentMethod,
  removePaymentMethod,
  listPaymentMethods,
  createRefund,
  handleWebhook,
  getConfig,
  createSubscription,
  cancelSubscription,
  getTransactionHistory,
  getPaymentAnalytics,
  createSetupIntent,
  checkStripeStatus,
  getPaymentStatus,
  checkRefundEligibility,
  processRefund,
  createFinalPayment,
};
