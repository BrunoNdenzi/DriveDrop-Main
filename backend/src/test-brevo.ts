import 'dotenv/config';
import brevoService from './services/BrevoService';

/**
 * Test Brevo Email Integration
 * Run: npx ts-node src/test-brevo.ts
 */

async function testBrevoEmails() {
  console.log('🧪 Testing Brevo Email Integration...\n');

  // Test 1: Welcome Email
  console.log('📧 Test 1: Sending Client Welcome Email...');
  const welcomeResult = await brevoService.sendWelcomeEmail(
    { email: 'bruno@drivedrop.us.com', name: 'Test User' },
    'client',
    {
      firstName: 'Test',
      dashboardUrl: 'https://drivedrop.us.com/dashboard/client'
    }
  );
  console.log(welcomeResult ? '✅ Welcome email sent!' : '❌ Welcome email failed\n');

  // Test 2: Shipment Created
  console.log('\n📧 Test 2: Sending Shipment Created Email...');
  const shipmentResult = await brevoService.sendShipmentNotification(
    { email: 'bruno@drivedrop.us.com', name: 'Test Customer' },
    'shipment_created',
    {
      firstName: 'Test',
      shipmentId: 'SH-TEST-001',
      vehicleYear: '2024',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      pickupCity: 'Austin',
      pickupState: 'TX',
      deliveryCity: 'Houston',
      deliveryState: 'TX',
      pickupDate: 'February 10, 2026',
      status: 'PENDING'
    }
  );
  console.log(shipmentResult ? '✅ Shipment email sent!' : '❌ Shipment email failed\n');

  // Test 3: Load Available (Driver)
  console.log('\n📧 Test 3: Sending Load Available Email to Driver...');
  const loadResult = await brevoService.sendLoadNotification(
    { email: 'bruno@drivedrop.us.com', name: 'Test Driver' },
    'load_available',
    {
      firstName: 'Test',
      loadId: 'LD-TEST-001',
      pickupCity: 'Dallas',
      pickupState: 'TX',
      deliveryCity: 'San Antonio',
      deliveryState: 'TX',
      distance: '274',
      pickupDate: 'February 15, 2026',
      vehicleYear: '2024',
      vehicleMake: 'Honda',
      vehicleModel: 'Accord',
      rate: '$420',
      route: 'Dallas, TX → San Antonio, TX'
    }
  );
  console.log(loadResult ? '✅ Load email sent!' : '❌ Load email failed\n');

  // Test 4: Password Reset
  console.log('\n📧 Test 4: Sending Password Reset Email...');
  const resetResult = await brevoService.sendPasswordReset(
    { email: 'bruno@drivedrop.us.com', name: 'Test User' },
    'test-reset-token-12345'
  );
  console.log(resetResult ? '✅ Password reset email sent!' : '❌ Password reset failed\n');

  // Get Email Stats
  console.log('\n📊 Email Statistics (Last 30 days):');
  const stats = await brevoService.getEmailStats();
  console.log(stats);

  console.log('\n🎉 All tests completed!');
  console.log('📬 Check your email inbox: bruno@drivedrop.us.com');
}

// Run tests
testBrevoEmails()
  .then(() => {
    console.log('\n✅ Test script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
