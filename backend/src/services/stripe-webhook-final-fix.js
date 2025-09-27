/**
 * Enhanced Stripe webhook handler for payment_status updates
 * 
 * This is a production-ready implementation to solve the payment status update issues:
 * 1. Uses maybeSingle() to properly handle non-existent shipments
 * 2. Handles payment record creation with proper error handling
 * 3. Uses the security definer function as primary update method
 * 4. Has fallback mechanisms if the function call fails
 */

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    // Extract metadata from the payment intent
    const { metadata } = paymentIntent;
    const clientId = metadata?.clientId;
    const shipmentId = metadata?.shipmentId;

    logger.info('Payment succeeded webhook received', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata,
      clientId,
      shipmentId,
    });

    // Only proceed with shipment updates if there's a valid shipment ID
    if (shipmentId) {
      // First check if the shipment exists - use maybeSingle() instead of single()
      const { data: shipment, error: shipmentError } = await supabaseAdmin
        .from('shipments')
        .select('id, client_id, payment_status')
        .eq('id', shipmentId)
        .maybeSingle(); // This won't throw an error if no rows are returned

      // Handle case where shipment doesn't exist
      if (!shipment) {
        logger.error('Shipment not found for payment webhook', { 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
          error: shipmentError 
        });
        return; // Exit gracefully to acknowledge webhook
      }

      // Handle any other errors
      if (shipmentError) {
        logger.error('Error fetching shipment for payment webhook', { 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
          error: shipmentError 
        });
        return; // Exit gracefully to acknowledge webhook
      }

      // Log the shipment we found
      logger.info('Found shipment for payment intent', {
        shipmentId,
        paymentIntentId: paymentIntent.id,
        shipmentClientId: shipment.client_id,
        currentPaymentStatus: shipment.payment_status
      });

      // First check if a payment record already exists
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('payment_intent_id', paymentIntent.id)
        .maybeSingle(); // Use maybeSingle() instead of single()
      
      let paymentError;
      
      if (existingPayment) {
        // Update existing payment
        const { error } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPayment.id);
        
        paymentError = error;
      } else {
        // Create new payment record
        const { error } = await supabaseAdmin
          .from('payments')
          .insert({
            shipment_id: shipmentId,
            client_id: clientId || shipment.client_id, // Fall back to shipment client_id if missing in metadata
            amount: paymentIntent.amount,
            status: 'completed',
            payment_method: paymentIntent.payment_method_types?.[0] || 'card',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        
        paymentError = error;
      }

      if (paymentError) {
        logger.error('Error creating/updating payment record', { 
          error: paymentError, 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
          errorMessage: paymentError.message,
          errorDetails: paymentError.details
        });
        // Don't throw, try updating the shipment anyway
      }

      // Use the function that bypasses RLS to update the shipment status
      const { error: functionError } = await supabaseAdmin
        .rpc('update_shipment_payment_status', {
          p_shipment_id: shipmentId,
          p_payment_status: 'completed'
        });

      if (functionError) {
        logger.error('Error calling update_shipment_payment_status function', { 
          error: functionError, 
          shipmentId,
          paymentIntentId: paymentIntent.id
        });
        
        // Fall back to direct update if the function call fails
        const { error: shipmentUpdateError } = await supabaseAdmin
          .from('shipments')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipmentId);

        if (shipmentUpdateError) {
          logger.error('Error updating shipment payment status directly', { 
            error: shipmentUpdateError, 
            shipmentId,
            errorMessage: shipmentUpdateError.message,
            errorDetails: shipmentUpdateError.details
          });
        } else {
          logger.info('Successfully updated shipment payment status directly', {
            shipmentId,
            paymentIntentId: paymentIntent.id,
            newStatus: 'completed'
          });
        }
      } else {
        logger.info('Successfully updated shipment payment status via function', {
          shipmentId,
          paymentIntentId: paymentIntent.id,
          newStatus: 'completed'
        });
      }

      // Create a payment notification
      if (clientId) {
        try {
          await this.createPaymentNotification(
            clientId, 
            shipmentId, 
            'success', 
            paymentIntent.amount
          );
        } catch (notificationError) {
          logger.error('Error creating payment notification', { 
            error: notificationError, 
            clientId, 
            shipmentId 
          });
          // Don't throw - notification failure shouldn't fail the whole webhook
        }
      }
    } else {
      logger.warn('Payment intent succeeded without shipment ID', {
        paymentIntentId: paymentIntent.id,
        metadata
      });
    }
  } catch (error) {
    logger.error('Error handling payment success webhook', { 
      error, 
      paymentIntentId: paymentIntent.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't rethrow - we want to acknowledge the webhook even if processing fails
  }
}