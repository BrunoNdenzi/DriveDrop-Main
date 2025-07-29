/**
 * Integration tests for Driver Application API endpoints
 * 
 * Prerequisites:
 * 1. Database with proper schema and stored procedures installed
 * 2. Test environment configuration
 * 3. Test users created (admin, driver, client)
 */

import request from 'supertest';
// If you install supertest with npm, use: npm install supertest --legacy-peer-deps
import { app } from '../src/index';
import { supabase } from '../src/lib/supabase';

// Test configuration
const TEST_CONFIG = {
  admin: {
    email: 'admin@test.com',
    password: 'testpass123',
    token: '', // Will be set during login
  },
  driver: {
    email: 'driver@test.com', 
    password: 'testpass123',
    token: '', // Will be set during login
    id: '', // Will be set during login
  },
  client: {
    email: 'client@test.com',
    password: 'testpass123',
    token: '', // Will be set during login
    id: '', // Will be set during login
  },
  shipment: {
    id: '', // Will be created during test
  },
  application: {
    id: '', // Will be created during test
  }
};

describe('Driver Application API Integration Tests', () => {
  
  beforeAll(async () => {
    // Login and get tokens for all test users
    await loginTestUsers();
    
    // Create a test shipment
    await createTestShipment();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  describe('POST /api/v1/shipments/:id/apply', () => {
    
    test('should allow driver to apply for shipment successfully', async () => {
      const response = await request(app)
        .post(`/api/v1/shipments/${TEST_CONFIG.shipment.id}/apply`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          notes: 'I am available and have experience with similar deliveries'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        shipment_id: TEST_CONFIG.shipment.id,
        driver_id: TEST_CONFIG.driver.id,
        status: 'pending',
        notes: 'I am available and have experience with similar deliveries',
        is_new_application: true
      });

      // Store application ID for later tests
      TEST_CONFIG.application.id = response.body.data.id;
    });

    test('should prevent duplicate applications', async () => {
      await request(app)
        .post(`/api/v1/shipments/${TEST_CONFIG.shipment.id}/apply`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          notes: 'Trying to apply again'
        })
        .expect(200); // Should return existing application, not create new one

      // Verify only one application exists
      const { data: applications } = await supabase
        .from('job_applications')
        .select('*')
        .eq('shipment_id', TEST_CONFIG.shipment.id)
        .eq('driver_id', TEST_CONFIG.driver.id);

      expect(applications).toHaveLength(1);
    });

    test('should reject non-driver users', async () => {
      await request(app)
        .post(`/api/v1/shipments/${TEST_CONFIG.shipment.id}/apply`)
        .set('Authorization', `Bearer ${TEST_CONFIG.client.token}`)
        .send({
          notes: 'Client trying to apply'
        })
        .expect(403);
    });

    test('should reject unauthenticated requests', async () => {
      await request(app)
        .post(`/api/v1/shipments/${TEST_CONFIG.shipment.id}/apply`)
        .send({
          notes: 'Unauthenticated application'
        })
        .expect(401);
    });

    test('should reject invalid shipment ID', async () => {
      await request(app)
        .post('/api/v1/shipments/invalid-uuid/apply')
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          notes: 'Invalid shipment ID'
        })
        .expect(400);
    });

    test('should reject non-existent shipment', async () => {
      const fakeShipmentId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .post(`/api/v1/shipments/${fakeShipmentId}/apply`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          notes: 'Non-existent shipment'
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/drivers/applications', () => {
    
    test('should return driver applications successfully', async () => {
      const response = await request(app)
        .get('/api/v1/drivers/applications')
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const application = response.body.data[0];
      expect(application).toHaveProperty('id');
      expect(application).toHaveProperty('shipment_id');
      expect(application).toHaveProperty('driver_id', TEST_CONFIG.driver.id);
      expect(application).toHaveProperty('status');
      expect(application).toHaveProperty('applied_at');
    });

    test('should filter applications by status', async () => {
      const response = await request(app)
        .get('/api/v1/drivers/applications?status=pending')
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      
      if (response.body.data.length > 0) {
        response.body.data.forEach((app: any) => {
          expect(app.status).toBe('pending');
        });
      }
    });

    test('should reject non-driver users', async () => {
      await request(app)
        .get('/api/v1/drivers/applications')
        .set('Authorization', `Bearer ${TEST_CONFIG.client.token}`)
        .expect(403);
    });

    test('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/v1/drivers/applications')
        .expect(401);
    });

    test('should reject invalid status filter', async () => {
      await request(app)
        .get('/api/v1/drivers/applications?status=invalid_status')
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .expect(400);
    });
  });

  describe('PUT /api/v1/applications/:id/status', () => {
    
    test('should allow admin to accept application', async () => {
      const response = await request(app)
        .put(`/api/v1/applications/${TEST_CONFIG.application.id}/status`)
        .set('Authorization', `Bearer ${TEST_CONFIG.admin.token}`)
        .send({
          status: 'accepted',
          notes: 'Driver has excellent ratings'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('accepted');
      expect(response.body.data.notes).toBe('Driver has excellent ratings');

      // Verify shipment was automatically assigned
      const { data: shipment } = await supabase
        .from('shipments')
        .select('status, driver_id')
        .eq('id', TEST_CONFIG.shipment.id)
        .single();

      expect(shipment.status).toBe('assigned');
      expect(shipment.driver_id).toBe(TEST_CONFIG.driver.id);
    });

    test('should allow driver to cancel own application', async () => {
      // Create another test shipment and application first
      const { data: newShipment } = await supabase
        .from('shipments')
        .insert({
          client_id: TEST_CONFIG.client.id,
          title: 'Test Shipment for Cancellation',
          pickup_address: '123 Test St',
          delivery_address: '456 Test Ave',
          pickup_location: { type: 'Point', coordinates: [0, 0] },
          delivery_location: { type: 'Point', coordinates: [1, 1] },
          estimated_price: 100,
          status: 'pending'
        })
        .select('id')
        .single();

      const { data: newApplication } = await supabase.rpc('apply_for_shipment', {
        p_shipment_id: newShipment.id,
        p_driver_id: TEST_CONFIG.driver.id,
        p_notes: 'Application to be cancelled'
      });

      const response = await request(app)
        .put(`/api/v1/applications/${newApplication.id}/status`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          status: 'cancelled',
          notes: 'No longer available'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    test('should prevent driver from accepting applications', async () => {
      await request(app)
        .put(`/api/v1/applications/${TEST_CONFIG.application.id}/status`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          status: 'accepted',
          notes: 'Driver trying to accept'
        })
        .expect(403);
    });

    test('should prevent driver from updating other driver applications', async () => {
      // This test would need another driver and application
      // For now, just test with a fake application ID
      const fakeApplicationId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .put(`/api/v1/applications/${fakeApplicationId}/status`)
        .set('Authorization', `Bearer ${TEST_CONFIG.driver.token}`)
        .send({
          status: 'cancelled',
          notes: 'Trying to cancel someone else\'s application'
        })
        .expect(404);
    });

    test('should reject invalid status values', async () => {
      await request(app)
        .put(`/api/v1/applications/${TEST_CONFIG.application.id}/status`)
        .set('Authorization', `Bearer ${TEST_CONFIG.admin.token}`)
        .send({
          status: 'invalid_status',
          notes: 'Invalid status test'
        })
        .expect(400);
    });

    test('should reject unauthenticated requests', async () => {
      await request(app)
        .put(`/api/v1/applications/${TEST_CONFIG.application.id}/status`)
        .send({
          status: 'accepted',
          notes: 'Unauthenticated update'
        })
        .expect(401);
    });
  });
});

// Helper functions

async function loginTestUsers() {
  // Login admin
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_CONFIG.admin.email,
      password: TEST_CONFIG.admin.password
    });
  TEST_CONFIG.admin.token = adminLogin.body.data.token;

  // Login driver
  const driverLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_CONFIG.driver.email,
      password: TEST_CONFIG.driver.password
    });
  TEST_CONFIG.driver.token = driverLogin.body.data.token;
  TEST_CONFIG.driver.id = driverLogin.body.data.user.id;

  // Login client
  const clientLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: TEST_CONFIG.client.email,
      password: TEST_CONFIG.client.password
    });
  TEST_CONFIG.client.token = clientLogin.body.data.token;
  TEST_CONFIG.client.id = clientLogin.body.data.user.id;
}

async function createTestShipment() {
  const { data: shipment } = await supabase
    .from('shipments')
    .insert({
      client_id: TEST_CONFIG.client.id,
      title: 'Test Shipment for Applications',
      pickup_address: '123 Pickup St',
      delivery_address: '456 Delivery Ave',
      pickup_location: { type: 'Point', coordinates: [0, 0] },
      delivery_location: { type: 'Point', coordinates: [1, 1] },
      estimated_price: 150,
      status: 'pending'
    })
    .select('id')
    .single();

  TEST_CONFIG.shipment.id = shipment.id;
}

async function cleanupTestData() {
  // Delete test applications
  await supabase
    .from('job_applications')
    .delete()
    .eq('driver_id', TEST_CONFIG.driver.id);

  // Delete test shipments
  await supabase
    .from('shipments')
    .delete()
    .eq('client_id', TEST_CONFIG.client.id);
}

export default TEST_CONFIG;
