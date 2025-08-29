/**
 * Stripe payment service
 */
import Stripe from 'stripe';
import config from '@config';
import { createError } from '@utils/error';
import { logger } from '@utils/logger';
import { supabase } from '@lib/supabase';
// import { Database } from '../lib/database.types';

// Initialize Stripe with API key and validate it's configured
let stripe: Stripe;
try {
  if (!config.stripe.secretKey) {
    logger.error('Stripe secret key is not configured');
    throw new Error('Stripe configuration is missing');
  }
  stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2025-06-30.basil',
  });
  logger.info('Stripe service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Stripe service', { error });
  // Don't throw here, let the service methods handle the error
  // when they try to use the uninitialized stripe client
}

export interface PaymentIntentData {
  amount: number; // Amount in cents
  currency: string;
  clientId: string;
  shipmentId?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethodData {
  customerId: string;
  paymentMethodId: string;
  isDefault?: boolean;
}

/**
 * Stripe service for handling payments
 */
export const stripeService = {
  /**
   * Create a payment intent for shipment payment
   */
  async createPaymentIntent(data: PaymentIntentData): Promise<Stripe.PaymentIntent> {
    try {
      // Validate Stripe API key is configured
      if (!stripe) {
        logger.error('Stripe is not initialized');
        throw new Error('Stripe service is not available');
      }

      // Validate required data
      if (!data.amount || data.amount <= 0) {
        logger.error('Invalid payment amount', { amount: data.amount });
        throw new Error('Payment amount must be greater than 0');
      }

      if (!data.clientId) {
        logger.error('Missing client ID for payment intent');
        throw new Error('Client ID is required for payment intent');
      }

      // Log request data (sanitized)
      logger.info('Creating payment intent', {
        amount: data.amount,
        currency: data.currency || 'usd',
        clientId: data.clientId,
        shipmentId: data.shipmentId,
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: data.amount,
        currency: data.currency || 'usd',
        metadata: {
          clientId: data.clientId,
          shipmentId: data.shipmentId || '',
          ...data.metadata,
        },
        description: data.description || 'DriveDrop shipment payment',
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      });

      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount: data.amount,
        clientId: data.clientId,
        status: paymentIntent.status,
      });

      return paymentIntent;
    } catch (error) {
      // Extract detailed error information from Stripe error
      const errorMessage = error instanceof Stripe.errors.StripeError
        ? `Stripe error: ${error.type} - ${error.message}`
        : error instanceof Error
          ? error.message
          : 'Unknown payment intent creation error';
      
      const errorCode = error instanceof Stripe.errors.StripeError
        ? error.code || error.type
        : 'PAYMENT_INTENT_FAILED';
        
      // Log detailed error for debugging
      logger.error('Error creating payment intent', { 
        error,
        errorMessage,
        errorCode,
        data,
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      throw createError(
        errorMessage,
        400,
        errorCode
      );
    }
  },

  /**
   * Retrieve a payment intent by ID
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error('Error retrieving payment intent', { error, paymentIntentId });
      throw createError(
        error instanceof Error ? error.message : 'Payment intent not found',
        404,
        'PAYMENT_INTENT_NOT_FOUND'
      );
    }
  },

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      logger.info('Payment intent confirmed', {
        paymentIntentId,
        status: paymentIntent.status,
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Error confirming payment intent', { error, paymentIntentId });
      throw createError(
        error instanceof Error ? error.message : 'Payment confirmation failed',
        400,
        'PAYMENT_CONFIRMATION_FAILED'
      );
    }
  },

  /**
   * Create a customer
   */
  async createCustomer(email: string, name?: string, phone?: string): Promise<Stripe.Customer> {
    try {
      // Create params object, handling optional fields properly
      const params: Stripe.CustomerCreateParams = {
        email,
        metadata: {
          source: 'drivedrop_app',
        },
      };
      
      // Only add optional fields if they are defined
      if (name) params.name = name;
      if (phone) params.phone = phone;

      const customer = await stripe.customers.create(params);

      logger.info('Stripe customer created', {
        customerId: customer.id,
        email,
      });

      return customer;
    } catch (error) {
      logger.error('Error creating Stripe customer', { error, email });
      throw createError(
        error instanceof Error ? error.message : 'Customer creation failed',
        400,
        'CUSTOMER_CREATION_FAILED'
      );
    }
  },

  /**
   * Create a refund
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      // Create params object, handling optional fields properly
      const params: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        metadata: {
          refunded_by: 'drivedrop_system',
        },
      };
      
      // Only add optional fields if they are defined
      if (amount !== undefined) params.amount = amount;
      if (reason) params.reason = reason as Stripe.RefundCreateParams.Reason;

      const refund = await stripe.refunds.create(params);

      logger.info('Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
      });

      return refund;
    } catch (error) {
      logger.error('Error creating refund', { error, paymentIntentId });
      throw createError(
        error instanceof Error ? error.message : 'Refund creation failed',
        400,
        'REFUND_CREATION_FAILED'
      );
    }
  },

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    endpointSecret: string
  ): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      throw createError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }
  },

  /**
   * Handle webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling webhook event', { error, eventType: event.type });
      throw error;
    }
  },

  /**
   * Handle successful payment
   */
  async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const { clientId, shipmentId } = paymentIntent.metadata;

      logger.info('Payment succeeded', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        clientId,
        shipmentId,
      });

      if (shipmentId) {
        // Update the payment record in the database
        const { error: paymentError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('shipment_id', shipmentId)
          .select()
          .single();

        if (paymentError) {
          logger.error('Error updating payment record', { 
            error: paymentError, 
            shipmentId, 
            paymentIntentId: paymentIntent.id 
          });
          throw createError('Failed to update payment record', 500, 'PAYMENT_UPDATE_FAILED');
        }

        // Update the shipment status
        const { error: shipmentError } = await supabase
          .from('shipments')
          .update({
            payment_status: 'paid',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipmentId);

        if (shipmentError) {
          logger.error('Error updating shipment payment status', { 
            error: shipmentError, 
            shipmentId 
          });
          throw createError('Failed to update shipment status', 500, 'SHIPMENT_UPDATE_FAILED');
        }

        // Create a payment notification
        if (clientId) {
          await this.createPaymentNotification(clientId, shipmentId, 'success', paymentIntent.amount);
        }
      }
    } catch (error) {
      logger.error('Error handling payment success', { error, paymentIntentId: paymentIntent.id });
      throw error;
    }
  },

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const { clientId, shipmentId } = paymentIntent.metadata;

      logger.error('Payment failed', {
        paymentIntentId: paymentIntent.id,
        clientId,
        shipmentId,
        lastPaymentError: paymentIntent.last_payment_error,
      });

      if (shipmentId) {
        // Update the payment record in the database
        const { error: paymentError } = await supabase
          .from('payments')
          .update({
            status: 'failed',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('shipment_id', shipmentId);

        if (paymentError) {
          logger.error('Error updating payment record for failed payment', { 
            error: paymentError, 
            shipmentId, 
            paymentIntentId: paymentIntent.id 
          });
          throw createError('Failed to update payment record', 500, 'PAYMENT_UPDATE_FAILED');
        }

        // Update the shipment status
        const { error: shipmentError } = await supabase
          .from('shipments')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipmentId);

        if (shipmentError) {
          logger.error('Error updating shipment payment status for failed payment', { 
            error: shipmentError, 
            shipmentId 
          });
          throw createError('Failed to update shipment status', 500, 'SHIPMENT_UPDATE_FAILED');
        }

        // Create a payment notification
        if (clientId) {
          await this.createPaymentNotification(clientId, shipmentId, 'failure', paymentIntent.amount);
        }
      }
    } catch (error) {
      logger.error('Error handling payment failure', { error, paymentIntentId: paymentIntent.id });
      throw error;
    }
  },

  /**
   * Create a payment notification in the database
   */
  async createPaymentNotification(
    userId: string,
    shipmentId: string,
    type: 'success' | 'failure' | 'refund',
    amount: number
  ): Promise<void> {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'payment',
        title: type === 'success' ? 'Payment Successful' : type === 'failure' ? 'Payment Failed' : 'Refund Processed',
        message: type === 'success' 
          ? `Your payment of $${(amount / 100).toFixed(2)} for shipment was successful.` 
          : type === 'failure'
          ? `Your payment of $${(amount / 100).toFixed(2)} for shipment failed. Please try again.`
          : `A refund of $${(amount / 100).toFixed(2)} has been processed for your shipment.`,
        data: { 
          shipmentId,
          amount,
          type
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        logger.error('Error creating payment notification', { error, userId, shipmentId, type });
      }
    } catch (error) {
      logger.error('Error creating payment notification', { error, userId, shipmentId, type });
    }
  },

  /**
   * Handle canceled payment
   */
  async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      const { clientId, shipmentId } = paymentIntent.metadata;

      logger.info('Payment canceled', {
        paymentIntentId: paymentIntent.id,
        clientId,
        shipmentId,
      });

      if (shipmentId) {
        // Update the payment record in the database
        const { error: paymentError } = await supabase
          .from('payments')
          .update({
            status: 'canceled',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('shipment_id', shipmentId);

        if (paymentError) {
          logger.error('Error updating payment record for canceled payment', { 
            error: paymentError, 
            shipmentId, 
            paymentIntentId: paymentIntent.id 
          });
          throw createError('Failed to update payment record', 500, 'PAYMENT_UPDATE_FAILED');
        }

        // Update the shipment status
        const { error: shipmentError } = await supabase
          .from('shipments')
          .update({
            payment_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipmentId);

        if (shipmentError) {
          logger.error('Error updating shipment payment status for canceled payment', { 
            error: shipmentError, 
            shipmentId 
          });
          throw createError('Failed to update shipment status', 500, 'SHIPMENT_UPDATE_FAILED');
        }

        // Create a payment notification
        if (clientId) {
          await this.createPaymentNotification(clientId, shipmentId, 'failure', paymentIntent.amount);
        }
      }
    } catch (error) {
      logger.error('Error handling payment cancellation', { error, paymentIntentId: paymentIntent.id });
      throw error;
    }
  },

  /**
   * Handle subscription created event
   */
  async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    try {
      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
      });

      // Here you would update the user's subscription status in your database
      // Example: await userService.updateSubscriptionStatus(customerId, subscriptionId, 'active');
    } catch (error) {
      logger.error('Error handling subscription creation', { error, subscriptionId: subscription.id });
      throw error;
    }
  },

  /**
   * Handle subscription updated event
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      logger.info('Subscription updated', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
      });

      // Here you would update the user's subscription status in your database
      // Example: await userService.updateSubscriptionStatus(customerId, subscriptionId, subscription.status);
    } catch (error) {
      logger.error('Error handling subscription update', { error, subscriptionId: subscription.id });
      throw error;
    }
  },

  /**
   * Handle subscription canceled event
   */
  async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    try {
      logger.info('Subscription canceled', {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
        status: subscription.status,
      });

      // Here you would update the user's subscription status in your database
      // Example: await userService.updateSubscriptionStatus(customerId, subscriptionId, 'canceled');
    } catch (error) {
      logger.error('Error handling subscription cancellation', { error, subscriptionId: subscription.id });
      throw error;
    }
  },

  /**
   * Handle invoice payment succeeded event
   */
  async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      // Using type assertion to access properties that might not be in the type definitions
  const invoiceWithSub = invoice as Stripe.Invoice & { subscription?: string | null };
  const subscriptionId = typeof invoiceWithSub.subscription === 'string' ? invoiceWithSub.subscription : null;
        
      logger.info('Invoice payment succeeded', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId,
        amount: invoice.amount_paid,
      });

      // Here you would update the user's payment records in your database
      // Example: await paymentService.recordSuccessfulPayment(customerId, invoiceId, amount);
    } catch (error) {
      logger.error('Error handling invoice payment success', { error, invoiceId: invoice.id });
      throw error;
    }
  },

  /**
   * Handle invoice payment failed event
   */
  async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    try {
      // Using type assertion to access properties that might not be in the type definitions
  const invoiceWithSub = invoice as Stripe.Invoice & { subscription?: string | null };
  const subscriptionId = typeof invoiceWithSub.subscription === 'string' ? invoiceWithSub.subscription : null;
        
      logger.info('Invoice payment failed', {
        invoiceId: invoice.id,
        customerId: invoice.customer,
        subscriptionId,
        amount: invoice.amount_due,
      });

      // Here you would handle the failed payment in your database
      // Example: await paymentService.recordFailedPayment(customerId, invoiceId, amount);
      // Example: await notificationService.sendPaymentFailureNotification(customerId);
    } catch (error) {
      logger.error('Error handling invoice payment failure', { error, invoiceId: invoice.id });
      throw error;
    }
  },

  /**
   * Add payment method to customer
   */
  async addPaymentMethod(data: PaymentMethodData): Promise<Stripe.PaymentMethod> {
    try {
      // Attach payment method to customer
      const paymentMethod = await stripe.paymentMethods.attach(data.paymentMethodId, {
        customer: data.customerId,
      });

      // Set as default payment method if requested
      if (data.isDefault) {
        await stripe.customers.update(data.customerId, {
          invoice_settings: {
            default_payment_method: data.paymentMethodId,
          },
        });
      }

      logger.info('Payment method added to customer', {
        customerId: data.customerId,
        paymentMethodId: data.paymentMethodId,
        isDefault: data.isDefault,
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Error adding payment method to customer', { error, data });
      throw createError(
        error instanceof Error ? error.message : 'Failed to add payment method',
        400,
        'PAYMENT_METHOD_FAILED'
      );
    }
  },

  /**
   * List customer payment methods
   */
  async listPaymentMethods(customerId: string, type: Stripe.PaymentMethodListParams.Type = 'card'): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    try {
      const paymentMethods = await stripe.customers.listPaymentMethods(
        customerId,
        { type }
      );

      return paymentMethods;
    } catch (error) {
      logger.error('Error listing payment methods', { error, customerId });
      throw createError(
        error instanceof Error ? error.message : 'Failed to list payment methods',
        400,
        'LIST_PAYMENT_METHODS_FAILED'
      );
    }
  },

  /**
   * Remove payment method from customer
   */
  async removePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Payment method removed', {
        paymentMethodId: paymentMethod.id,
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Error removing payment method', { error, paymentMethodId });
      throw createError(
        error instanceof Error ? error.message : 'Failed to remove payment method',
        400,
        'REMOVE_PAYMENT_METHOD_FAILED'
      );
    }
  },

  /**
   * Create a subscription for premium services
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    try {
      const subscriptionParams: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        metadata: {
          source: 'drivedrop_app',
          ...metadata,
        },
        expand: ['latest_invoice.payment_intent'],
      };

      // Add payment method if provided
      if (paymentMethodId) {
        subscriptionParams.default_payment_method = paymentMethodId;
      }

      const subscription = await stripe.subscriptions.create(subscriptionParams);

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        customerId,
        priceId,
      });

      return subscription;
    } catch (error) {
      logger.error('Error creating subscription', { error, customerId, priceId });
      throw createError(
        error instanceof Error ? error.message : 'Subscription creation failed',
        400,
        'SUBSCRIPTION_CREATION_FAILED'
      );
    }
  },

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false
  ): Promise<Stripe.Subscription> {
    try {
      let subscription;

      if (cancelAtPeriodEnd) {
        // Cancel at the end of the billing period
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        // Cancel immediately
        subscription = await stripe.subscriptions.cancel(subscriptionId);
      }

      logger.info('Subscription canceled', {
        subscriptionId,
        cancelAtPeriodEnd,
      });

      return subscription;
    } catch (error) {
      logger.error('Error canceling subscription', { error, subscriptionId });
      throw createError(
        error instanceof Error ? error.message : 'Subscription cancellation failed',
        400,
        'SUBSCRIPTION_CANCELLATION_FAILED'
      );
    }
  },

  /**
   * Update a subscription
   */
  async updateSubscription(
    subscriptionId: string,
    params: Partial<Stripe.SubscriptionUpdateParams>
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, params);

      logger.info('Subscription updated', {
        subscriptionId,
        updateParams: Object.keys(params).join(', '),
      });

      return subscription;
    } catch (error) {
      logger.error('Error updating subscription', { error, subscriptionId });
      throw createError(
        error instanceof Error ? error.message : 'Subscription update failed',
        400,
        'SUBSCRIPTION_UPDATE_FAILED'
      );
    }
  },

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.ApiList<Stripe.Subscription>> {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        expand: ['data.default_payment_method'],
      });

      return subscriptions;
    } catch (error) {
      logger.error('Error getting customer subscriptions', { error, customerId });
      throw createError(
        error instanceof Error ? error.message : 'Failed to get subscriptions',
        400,
        'GET_SUBSCRIPTIONS_FAILED'
      );
    }
  },

  /**
   * Get payment transaction history for a customer
   */
  async getCustomerTransactionHistory(
    customerId: string,
    limit: number = 25,
    startingAfter?: string
  ): Promise<Stripe.ApiList<Stripe.PaymentIntent>> {
    try {
      const params: Stripe.PaymentIntentListParams = {
        customer: customerId,
        limit,
      };

      if (startingAfter) {
        params.starting_after = startingAfter;
      }

      const paymentIntents = await stripe.paymentIntents.list(params);

      logger.info('Retrieved customer transaction history', {
        customerId,
        count: paymentIntents.data.length,
      });

      return paymentIntents;
    } catch (error) {
      logger.error('Error retrieving customer transaction history', { error, customerId });
      throw createError(
        error instanceof Error ? error.message : 'Failed to retrieve transaction history',
        400,
        'TRANSACTION_HISTORY_FAILED'
      );
    }
  },

  /**
   * Get payment analytics for a date range
   */
  async getPaymentAnalytics(
    startDate: number, // Unix timestamp
    endDate: number, // Unix timestamp
    limit: number = 100
  ): Promise<{ 
    totalAmount: number; 
    successfulPayments: number; 
    failedPayments: number; 
    paymentIntents: Stripe.PaymentIntent[];
  }> {
    try {
      const paymentIntents = await stripe.paymentIntents.list({
        created: {
          gte: startDate,
          lte: endDate,
        },
        limit,
      });

      let totalAmount = 0;
      let successfulPayments = 0;
      let failedPayments = 0;

      paymentIntents.data.forEach(intent => {
        if (intent.status === 'succeeded') {
          successfulPayments++;
          totalAmount += intent.amount;
        } else if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
          failedPayments++;
        }
      });

      logger.info('Payment analytics retrieved', {
        startDate: new Date(startDate * 1000).toISOString(),
        endDate: new Date(endDate * 1000).toISOString(),
        totalAmount,
        successfulPayments,
        failedPayments,
      });

      return {
        totalAmount,
        successfulPayments,
        failedPayments,
        paymentIntents: paymentIntents.data,
      };
    } catch (error) {
      logger.error('Error retrieving payment analytics', { error, startDate, endDate });
      throw createError(
        error instanceof Error ? error.message : 'Failed to retrieve payment analytics',
        400,
        'PAYMENT_ANALYTICS_FAILED'
      );
    }
  },

  /**
   * Create a setup intent for future payments
   */
  async createSetupIntent(
    customerId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        metadata: {
          source: 'drivedrop_app',
          ...metadata,
        },
        usage: 'off_session', // Allow charging the customer in the future
      });

      logger.info('Setup intent created', {
        setupIntentId: setupIntent.id,
        customerId,
      });

      return setupIntent;
    } catch (error) {
      logger.error('Error creating setup intent', { error, customerId });
      throw createError(
        error instanceof Error ? error.message : 'Setup intent creation failed',
        400,
        'SETUP_INTENT_FAILED'
      );
    }
  },
  
  /**
   * Verify Stripe connectivity
   * Use this to check if Stripe API is reachable
   */
  async verifyConnectivity(): Promise<boolean> {
    try {
      if (!stripe) {
        logger.error('Cannot verify Stripe connectivity - service not initialized');
        return false;
      }
      
      // Make a simple API call that doesn't affect any resources
      // Using countrySpecs.list as it's a lightweight call
      await stripe.countrySpecs.list({ limit: 1 });
      logger.info('Stripe API connectivity verified successfully');
      return true;
    } catch (error) {
      logger.error('Stripe API connectivity check failed', { 
        error, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
      return false;
    }
  },
};
