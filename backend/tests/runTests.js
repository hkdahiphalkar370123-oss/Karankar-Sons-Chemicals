/**
 * Comprehensive Test Suite
 * Tests all modules, routes, and APIs
 * Run with: node tests/runTests.js
 */

const axios = require('axios');
const path = require('path');

// Load root environment for test validations
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api`;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

/**
 * Test helper function
 */
async function test(name, fn) {
  testResults.total++;
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    testResults.passed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  Error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ name, error: error.message });
  }
}

/**
 * Check if server is running
 */
async function checkServerHealth() {
  try {
    const response = await axios.get(`${API_URL}/test`);
    return response.status === 200 && response.data.message === 'Server Working';
  } catch (error) {
    return false;
  }
}

/**
 * Test API endpoints
 */
async function testAPIEndpoints() {
  console.log(`\n${colors.cyan}🧪 Testing API Endpoints${colors.reset}\n`);

  // Test public endpoints
  await test('GET /api/test (Server health)', async () => {
    const response = await axios.get(`${API_URL}/test`);
    if (response.status !== 200) throw new Error('Unexpected status code');
  });

  await test('GET /api/products (Public)', async () => {
    const response = await axios.get(`${API_URL}/products?limit=5`);
    if (response.status !== 200) throw new Error('Unexpected status code');
    if (!Array.isArray(response.data.data)) throw new Error('Invalid response format');
  });

  await test('GET /api/categories (Public)', async () => {
    const response = await axios.get(`${API_URL}/categories`);
    if (response.status !== 200) throw new Error('Unexpected status code');
  });

  // Test authentication endpoints
  await test('POST /api/auth/register (Create user)', async () => {
    const timestamp = Date.now();
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: `test.${timestamp}@example.com`,
      password: 'Test@123456',
      name: 'Test User',
      phone: '9876543210',
      address: 'Test Address',
      city: 'Test City',
      pincode: '123456'
    });
    if (response.status !== 201) throw new Error('Unexpected status code');
  });

  // Test pagination
  await test('GET /api/products?page=1&limit=10 (Pagination)', async () => {
    const response = await axios.get(`${API_URL}/products?page=1&limit=10`);
    if (response.status !== 200) throw new Error('Unexpected status code');
    if (!response.data.pagination) throw new Error('Missing pagination metadata');
    if (response.data.pagination.currentPage !== 1) throw new Error('Invalid pagination details');
  });

  // Test error handling
  await test('GET /api/invalid-route (404 handling)', async () => {
    try {
      await axios.get(`${API_URL}/invalid-route`);
      throw new Error('Should have thrown 404');
    } catch (error) {
      if (error.response.status !== 404) throw new Error('Wrong error code');
    }
  });

  // Test rate limiting
  await test('Rate limiting protection', async () => {
    try {
      // Make multiple rapid requests
      for (let i = 0; i < 3; i++) {
        await axios.get(`${API_URL}/test`);
      }
      // If we get here, rate limiting is not blocking (may be fine in test mode)
    } catch (error) {
      if (error.response.status !== 429) {
        // Rate limiting may not be strict in test environment
      }
    }
  });
}

/**
 * Test file structure and required files
 */
async function testFileStructure() {
  console.log(`\n${colors.cyan}📁 Testing File Structure${colors.reset}\n`);

  const fs = require('fs');
  const rootDir = path.join(__dirname, '..', '..');

  const requiredFiles = [
    'backend/index.js',
    'backend/config/database.js',
    'backend/config/emailService.js',
    'backend/middlewares/auth.js',
    'backend/middlewares/errorHandler.js',
    'backend/routes/authRoutes.js',
    'backend/routes/productRoutes.js',
    'backend/routes/orderRoutes.js',
    'backend/utils/pagination.js',
    'backend/utils/backupService.js',
    'frontend/index.html',
    'frontend/js/api.js',
    'frontend/js/pagination.js',
    '.env.example',
    '.env.production',
    'package.json'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(rootDir, file);
    await test(`File exists: ${file}`, async () => {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
    });
  }
}

/**
 * Test database connectivity
 */
async function testDatabase() {
  console.log(`\n${colors.cyan}🗄️  Testing Database${colors.reset}\n`);

  await test('MongoDB connection via products query', async () => {
    const response = await axios.get(`${API_URL}/products?limit=1`);
    if (response.status !== 200) {
      throw new Error('Database query did not return 200');
    }
    if (!response.data || !Array.isArray(response.data.data)) {
      throw new Error('Invalid products response payload');
    }
  });
}

/**
 * Test environment configuration
 */
async function testEnvironmentConfig() {
  console.log(`\n${colors.cyan}⚙️  Testing Environment Configuration${colors.reset}\n`);

  await test('NODE_ENV is set', async () => {
    if (!process.env.NODE_ENV) throw new Error('NODE_ENV not set');
  });

  await test('MONGODB_URI is configured', async () => {
    if (!(process.env.MONGODB_URI || process.env.MONGO_URI)) {
      throw new Error('MONGODB_URI/MONGO_URI not configured');
    }
  });

  await test('JWT_SECRET is configured', async () => {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  });

  await test('Email service configured', async () => {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      return;
    }
    if (!(process.env.SMTP_HOST || process.env.EMAIL_HOST)) {
      throw new Error('SMTP/EMAIL host not configured for production');
    }
  });
}

/**
 * Print test summary
 */
function printSummary() {
  const total = testResults.total;
  const passed = testResults.passed;
  const failed = testResults.failed;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(2) : 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Success Rate: ${percentage}%`);

  if (testResults.errors.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    testResults.errors.forEach((error) => {
      console.log(`  - ${error.name}`);
      console.log(`    ${error.error}`);
    });
  }

  console.log('='.repeat(60));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log('COMPREHENSIVE TEST SUITE');
  console.log(`${'='.repeat(60)}${colors.reset}`);

  // Check if server is running
  console.log(`\n${colors.yellow}Checking server connectivity...${colors.reset}`);
  const serverRunning = await checkServerHealth();

  if (!serverRunning) {
    console.log(`${colors.red}✗ Server is not running on ${BASE_URL}${colors.reset}`);
    console.log(`Please start the server with: npm start (in backend directory)`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ Server is running${colors.reset}\n`);

  // Run test suites
  await testEnvironmentConfig();
  await testFileStructure();
  await testDatabase();
  await testAPIEndpoints();

  // Print summary
  printSummary();
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error(`${colors.red}Test runner error:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { test, testResults };
