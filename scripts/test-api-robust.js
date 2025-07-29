// test-api-robust.js
// A more robust version of the API testing script that works across Node.js versions

// Load environment variables
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN; // Add a valid token to your .env file

async function makeRequest(url, options) {
  // Check Node.js version to determine which HTTP client to use
  const nodeVersion = process.versions.node;
  const majorVersion = parseInt(nodeVersion.split('.')[0], 10);

  console.log(`Using Node.js ${nodeVersion}`);

  try {
    // For Node.js 18+, use built-in fetch
    if (majorVersion >= 18) {
      console.log('Using built-in fetch API');
      return await fetch(url, options);
    } 
    // For older Node versions, try node-fetch or axios or http module
    else {
      try {
        // Try to use node-fetch (if installed)
        const nodeFetch = require('node-fetch');
        console.log('Using node-fetch module');
        return await nodeFetch(url, options);
      } catch (e) {
        try {
          // If node-fetch is not available, try axios (if installed)
          const axios = require('axios');
          console.log('Using axios module');
          
          // Convert fetch options to axios format
          const axiosOptions = {
            method: options.method,
            headers: options.headers,
            data: options.body,
          };
          
          const response = await axios(url, axiosOptions);
          
          // Create a fetch-like response object
          return {
            status: response.status,
            statusText: response.statusText,
            headers: {
              get: (name) => response.headers[name.toLowerCase()],
            },
            json: async () => response.data,
            text: async () => JSON.stringify(response.data),
          };
        } catch (axiosError) {
          // If neither is available, use built-in http/https module as last resort
          console.log('Using built-in http/https module');
          const isHttps = url.startsWith('https');
          const httpModule = isHttps ? require('https') : require('http');
          const { URL } = require('url');
          const parsedUrl = new URL(url);
          
          return new Promise((resolve, reject) => {
            const reqOptions = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || (isHttps ? 443 : 80),
              path: parsedUrl.pathname + parsedUrl.search,
              method: options.method,
              headers: options.headers,
            };
            
            const req = httpModule.request(reqOptions, (res) => {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              
              res.on('end', () => {
                resolve({
                  status: res.statusCode,
                  statusText: res.statusMessage,
                  headers: {
                    get: (name) => res.headers[name.toLowerCase()],
                  },
                  json: async () => JSON.parse(data),
                  text: async () => data,
                });
              });
            });
            
            req.on('error', (error) => {
              reject(error);
            });
            
            if (options.body) {
              req.write(options.body);
            }
            
            req.end();
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error making request: ${error.message}`);
    throw error;
  }
}

async function testDriverApplicationsEndpoint() {
  console.log(`Testing endpoint: ${API_URL}/api/v1/drivers/applications`);
  
  try {
    // Make request to applications endpoint
    const response = await makeRequest(`${API_URL}/api/v1/drivers/applications`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response status text:', response.statusText);
    
    // Try to parse response as JSON
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    try {
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));
      } else {
        const text = await response.text();
        console.log('Response text:', text);
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError.message);
    }
  } catch (error) {
    console.error('Error testing endpoint:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\nThe server appears to be down or not running at the specified address.');
      console.log('Make sure your backend server is running and the API_URL is correct.');
    }
  }
}

// Test health endpoint first
async function testHealthEndpoint() {
  console.log(`Testing health endpoint: ${API_URL}/api/health`);
  
  try {
    const response = await makeRequest(`${API_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Health endpoint status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ Health endpoint is working properly!');
      return true;
    } else {
      console.log('❌ Health endpoint returned non-200 status code');
      return false;
    }
  } catch (error) {
    console.error('Error testing health endpoint:', error.message);
    return false;
  }
}

// Main function
async function runTests() {
  console.log('=== API Testing Script ===');
  console.log(`API URL: ${API_URL}`);
  console.log('========================\n');
  
  // Test health endpoint first
  const healthOk = await testHealthEndpoint();
  console.log('\n------------------------\n');
  
  if (healthOk) {
    // If health endpoint is working, test the applications endpoint
    await testDriverApplicationsEndpoint();
  } else {
    console.log('❌ Health check failed. The API may not be running.');
    console.log('Please start the backend server and try again.');
  }
}

// Run the tests
runTests();
