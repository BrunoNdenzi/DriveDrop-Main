// check-driver-api.js
// Script to check if the driver applications API endpoint is properly defined

const fs = require('fs');
const path = require('path');

// Paths to check
const driverRoutesPath = path.join(
  __dirname,
  '..',
  'src',
  'routes',
  'driver.routes.ts'
);
const appControllerPath = path.join(
  __dirname,
  '..',
  'src',
  'controllers',
  'application.controller.ts'
);
const supabaseFunctionsPath = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations'
);

console.log('Checking driver API endpoint configuration...\n');

// Check if driver routes file exists
if (fs.existsSync(driverRoutesPath)) {
  console.log('✅ Driver routes file exists:', driverRoutesPath);

  // Read the file content
  const routesContent = fs.readFileSync(driverRoutesPath, 'utf8');
  if (routesContent.includes('/applications')) {
    console.log('✅ Applications endpoint is defined in routes');
  } else {
    console.log('❌ Applications endpoint is NOT defined in routes');
  }
} else {
  console.log('❌ Driver routes file NOT found:', driverRoutesPath);
}

// Check if application controller exists and has the handler function
if (fs.existsSync(appControllerPath)) {
  console.log('✅ Application controller file exists:', appControllerPath);

  // Read the file content
  const controllerContent = fs.readFileSync(appControllerPath, 'utf8');
  if (controllerContent.includes('getDriverApplications')) {
    console.log('✅ getDriverApplications function is defined in controller');

    // Check if it's using an RPC function
    if (controllerContent.includes('get_driver_applications')) {
      console.log(
        'ℹ️ Controller is using "get_driver_applications" database function'
      );

      // Search for the database function in migration files
      let foundDbFunction = false;

      if (fs.existsSync(supabaseFunctionsPath)) {
        console.log('✅ Supabase migrations directory exists');

        const migrationFiles = fs.readdirSync(supabaseFunctionsPath);
        for (const file of migrationFiles) {
          if (file.endsWith('.sql')) {
            const content = fs.readFileSync(
              path.join(supabaseFunctionsPath, file),
              'utf8'
            );
            if (content.includes('get_driver_applications')) {
              console.log(
                `✅ Found get_driver_applications in migration file: ${file}`
              );
              foundDbFunction = true;
              break;
            }
          }
        }

        if (!foundDbFunction) {
          console.log(
            '❌ get_driver_applications database function NOT found in any migration file'
          );
        }
      } else {
        console.log('❌ Supabase migrations directory NOT found');
      }
    }
  } else {
    console.log(
      '❌ getDriverApplications function is NOT defined in controller'
    );
  }
} else {
  console.log('❌ Application controller file NOT found:', appControllerPath);
}

console.log('\nNext steps:');
console.log('1. Run the backend server');
console.log('2. Test the API endpoint using the test-api-endpoint.js script');
console.log(
  '3. Make sure environment variables are correctly set in the mobile app'
);
console.log(
  "4. If using a SQL function, ensure it's properly deployed to the database"
);
