// test-health-only.js
// Simple script to test just the health endpoint

const fetch = require('node-fetch');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

async function testHealthEndpoints() {
  console.log('DriveDrop Health Endpoint Test');
  console.log('=============================');
  console.log(`Testing server at: ${API_URL}`);
  console.log('');

  const endpoints = [
    '/health',
    '/api/health',
    '/health/db'
  ];

  for (const endpoint of endpoints) {
    const fullUrl = `${API_URL}${endpoint}`;
    console.log(`Testing: ${fullUrl}`);
    
    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`  Status: ${response.status} ${response.statusText}`);
      
      if (response.status === 200) {
        try {
          const data = await response.json();
          console.log(`  ✅ Success!`);
          console.log(`  Response:`, JSON.stringify(data, null, 4));
        } catch (parseError) {
          console.log(`  ✅ Success (non-JSON response)`);
          const text = await response.text();
          console.log(`  Response: ${text}`);
        }
      } else {
        console.log(`  ❌ Failed`);
        const text = await response.text();
        if (text) {
          console.log(`  Error: ${text}`);
        }
      }
    } catch (error) {
      console.log(`  ❌ Network Error: ${error.message}`);
      
      if (error.code === 'ECONNREFUSED') {
        console.log(`  💡 Server appears to be down. Start it with: cd backend && npm run dev`);
      }
    }
    
    console.log('');
  }

  console.log('Health endpoint testing complete.');
  console.log('');
  console.log('Next steps:');
  console.log('1. If all endpoints failed, make sure the backend server is running');
  console.log('2. If only /api/health failed, check that the route mounting is correct');
  console.log('3. If database endpoint failed, check Supabase connection');
}

testHealthEndpoints();
