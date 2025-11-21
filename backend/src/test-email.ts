/**
 * Quick email service test script
 * Run with: npx ts-node src/test-email.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { emailService } from './services/email.service';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testEmailService() {
  logger.info('🧪 Starting email service test...');
  
  try {
    // Test 1: Simple test email
    logger.info('Test 1: Sending simple test email...');
    const simpleResult = await emailService.sendEmail({
      to: 'infos@calkons.com', // Replace with your test email
      subject: 'DriveDrop - Email Service Test',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #14b8a6;">✅ Email Service Working!</h1>
          <p>This is a test email from DriveDrop backend.</p>
          <p>If you're seeing this, your email service is configured correctly.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Sent from DriveDrop Backend<br>
            Time: ${new Date().toLocaleString()}
          </p>
        </div>
      `,
      textContent: 'Email Service Test - If you see this, your email service is working!',
    });

    if (simpleResult) {
      logger.info('✅ Test 1 PASSED: Simple email sent successfully');
    } else {
      logger.error('❌ Test 1 FAILED: Could not send simple email');
      return;
    }

    // Test 2: Booking confirmation email simulation
    logger.info('Test 2: Sending booking confirmation email...');
    const bookingResult = await emailService.sendBookingConfirmationEmail({
      firstName: 'Test',
      email: 'infos@calkons.com', // Replace with your test email
      shipmentId: 'test-123',
      trackingUrl: 'https://drivedrop.us.com/dashboard/shipments/test-123',
      
      pickupAddress: '123 Main St, New York, NY 10001',
      deliveryAddress: '456 Oak Ave, Los Angeles, CA 90001',
      vehicleYear: '2020',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleType: 'sedan',
      estimatedDeliveryDate: 'Monday, December 1, 2025',
      
      distanceMiles: 2800,
      distanceBand: 'long',
      baseRate: 1.80,
      rawPrice: 5040,
      deliverySpeedMultiplier: 1.0,
      deliverySpeedType: 'standard',
      fuelAdjustmentPercent: 0,
      fuelPricePerGallon: 3.70,
      bulkDiscountPercent: 0,
      subtotal: 5040,
      totalPrice: 5040,
      
      upfrontAmount: 1008,
      remainingAmount: 4032,
      paymentMethod: '4242',
      chargedDate: 'November 21, 2025',
      receiptNumber: 'DD-test-123-01',
    });

    if (bookingResult) {
      logger.info('✅ Test 2 PASSED: Booking confirmation email sent successfully');
    } else {
      logger.error('❌ Test 2 FAILED: Could not send booking confirmation email');
    }

    logger.info('🎉 Email service test completed!');
    logger.info('📧 Check your email inbox (including spam folder)');
    
  } catch (error) {
    logger.error('❌ Email service test failed with error:', { error });
    throw error;
  }
}

// Run the test
testEmailService()
  .then(() => {
    logger.info('✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Test suite failed:', { error });
    process.exit(1);
  });
