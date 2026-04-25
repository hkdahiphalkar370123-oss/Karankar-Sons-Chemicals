#!/usr/bin/env node

/**
 * Production Readiness Checklist
 * Verifies all systems are configured and ready
 * Run with: npm run prechecks OR node scripts/prechecks.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

function pass(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
  checks.passed++;
}

function fail(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
  checks.failed++;
  checks.errors.push(msg);
}

function warn(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
  checks.warnings++;
}

function info(msg) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
}

async function runChecks() {
  console.log(`\n${colors.blue}${'='.repeat(60)}`);
  console.log('PRE-DEPLOYMENT CHECKLIST');
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  // 1. File Structure Checks
  console.log(`${colors.cyan}📁 File Structure${colors.reset}`);
  const requiredFiles = [
    'backend/index.js',
    'backend/config/database.js',
    'backend/utils/backupService.js',
    'backend/utils/pagination.js',
    'backend/tests/runTests.js',
    'frontend/index.html',
    'frontend/js/api.js',
    'backend/package.json',
    'scripts/cleanup.js',
    'scripts/deploy.sh',
    'scripts/deploy.bat',
    '.env.example',
    '.env.production'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      pass(`${file}`);
    } else {
      fail(`${file} - NOT FOUND`);
    }
  }

  // 2. Configuration Checks
  console.log(`\n${colors.cyan}⚙️  Environment Configuration${colors.reset}`);

  if (process.env.NODE_ENV) {
    pass(`NODE_ENV=${process.env.NODE_ENV}`);
  } else {
    warn('NODE_ENV not set - will default to development');
  }

  if (process.env.MONGODB_URI) {
    pass('MONGODB_URI configured');
  } else {
    warn('MONGODB_URI not configured - update .env.production');
  }

  if (process.env.JWT_SECRET) {
    pass('JWT_SECRET configured');
  } else {
    warn('JWT_SECRET not configured - will use default');
  }

  if (process.env.EMAIL_HOST || process.env.SMTP_HOST) {
    pass('Email host configured');
  } else {
    warn('EMAIL_HOST/SMTP_HOST not configured - email may not work');
  }

  // 3. Dependencies Checks
  console.log(`\n${colors.cyan}📦 Dependencies${colors.reset}`);

  const requiredPackages = [
    'express',
    'mongoose',
    'bcryptjs',
    'jsonwebtoken',
    'axios',
    'cors',
    'body-parser',
    'morgan',
    'compression',
    'cron',
    'archiver',
    'multer'
  ];

  try {
    const packageJson = require('../package.json');
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const pkg of requiredPackages) {
      if (allDeps[pkg]) {
        pass(`${pkg} (${allDeps[pkg]})`);
      } else {
        fail(`${pkg} - NOT INSTALLED`);
      }
    }
  } catch (e) {
    fail('Cannot read package.json');
  }

  // 4. Scripts Checks
  console.log(`\n${colors.cyan}📝 NPM Scripts${colors.reset}`);

  const requiredScripts = [
    'start',
    'start:prod',
    'start:dev',
    'test',
    'cleanup',
    'backup'
  ];

  try {
    const packageJson = require('../package.json');
    for (const script of requiredScripts) {
      if (packageJson.scripts[script]) {
        pass(`npm run ${script}`);
      } else {
        warn(`npm run ${script} - NOT CONFIGURED`);
      }
    }
  } catch (e) {
    fail('Cannot read package.json scripts');
  }

  // 5. System Requirements
  console.log(`\n${colors.cyan}🖥️  System Requirements${colors.reset}`);

  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
  if (majorVersion >= 18) {
    pass(`Node.js ${nodeVersion}`);
  } else {
    fail(`Node.js ${nodeVersion} - requires v18 or higher`);
  }

  try {
    require('mongoose');
    pass('MongoDB driver installed');
  } catch (e) {
    fail('MongoDB driver not installed');
  }

  // 6. API Route Files
  console.log(`\n${colors.cyan}🛣️  API Routes${colors.reset}`);

  const routeDir = path.join(__dirname, '..', 'backend', 'routes');
  try {
    const routes = fs.readdirSync(routeDir).filter(f => f.endsWith('Routes.js'));
    if (routes.length >= 10) {
      pass(`${routes.length} API route files`);
    } else {
      warn(`Only ${routes.length} route files (expect 15+)`);
    }
  } catch (e) {
    fail('Cannot read routes directory');
  }

  // 7. Controller Files
  console.log(`\n${colors.cyan}🎮 Controllers${colors.reset}`);

  const ctrlDir = path.join(__dirname, '..', 'backend', 'controllers');
  try {
    const ctrls = fs.readdirSync(ctrlDir).filter(f => f.endsWith('Controller.js'));
    if (ctrls.length >= 10) {
      pass(`${ctrls.length} controller files`);
    } else {
      warn(`Only ${ctrls.length} controller files (expect 15+)`);
    }
  } catch (e) {
    fail('Cannot read controllers directory');
  }

  // 8. Database Models
  console.log(`\n${colors.cyan}🗄️  Database Models${colors.reset}`);

  const modelsDir = path.join(__dirname, '..', 'database', 'models');
  try {
    const models = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
    if (models.length >= 14) {
      pass(`${models.length} database models`);
    } else {
      warn(`Only ${models.length} models (expect 14+)`);
    }
  } catch (e) {
    fail('Cannot read models directory');
  }

  // 9. Frontend Files
  console.log(`\n${colors.cyan}🎨 Frontend${colors.reset}`);

  const htmlFiles = [
    'index.html',
    'products.html',
    'product-detail.html',
    'checkout.html',
    'login.html',
    'admin-dashboard.html',
    'user-dashboard.html'
  ];

  const frontendDir = path.join(__dirname, '..', 'frontend');
  for (const file of htmlFiles) {
    const filePath = path.join(frontendDir, file);
    if (fs.existsSync(filePath)) {
      pass(`${file}`);
    } else {
      fail(`${file} - NOT FOUND`);
    }
  }

  // 10. Security Checks
  console.log(`\n${colors.cyan}🔒 Security${colors.reset}`);

  const envPath = path.join(__dirname, '..', '.env');
  const gitignorePath = path.join(__dirname, '..', '.gitignore');

  if (!fs.existsSync(envPath)) {
    pass('.env file not in repository (good!)');
  } else {
    warn('.env file in repository (move to .gitignore)');
  }

  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    if (gitignore.includes('.env')) {
      pass('.env files in .gitignore');
    } else {
      warn('.env files may not be in .gitignore');
    }
  }

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}${colors.reset}`);

  const total = checks.passed + checks.failed;
  const percentage = total > 0 ? ((checks.passed / total) * 100).toFixed(2) : 0;

  console.log(`${colors.green}Passed: ${checks.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${checks.failed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${checks.warnings}${colors.reset}`);
  console.log(`Success Rate: ${percentage}%`);

  if (checks.failed > 0) {
    console.log(`\n${colors.red}Failed Checks:${colors.reset}`);
    checks.errors.forEach((err) => {
      console.log(`  - ${err}`);
    });
  }

  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);

  if (checks.failed === 0) {
    console.log(`\n${colors.green}✅ PRE-DEPLOYMENT CHECKS PASSED!${colors.reset}`);
    console.log(`${colors.green}System is ready for production deployment.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}❌ SOME CHECKS FAILED${colors.reset}`);
    console.log(`${colors.yellow}Please fix issues before deployment.${colors.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  runChecks().catch((error) => {
    console.error(`${colors.red}Error running checks:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { runChecks };
