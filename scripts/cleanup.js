/**
 * Cleanup Unused Files
 * Removes development files, cache, logs, and unused directories
 * Run with: node scripts/cleanup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

let deletedFiles = 0;
let deletedDirs = 0;
let totalSize = 0;

/**
 * Recursive directory removal
 */
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return true;
  }
  return false;
}

/**
 * Get directory size in bytes
 */
function getDirectorySize(dirPath) {
  let size = 0;
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        size += getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    });
  }
  return size;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Main cleanup function
 */
function cleanup() {
  console.log(`\n${colors.cyan}${'='.repeat(60)}`);
  console.log('CLEANUP: Removing Unused Files & Directories');
  console.log(`${'='.repeat(60)}${colors.reset}\n`);

  const basePath = path.join(__dirname, '..');

  // Directories to remove
  const dirsToRemove = [
    'node_modules/.cache',
    '.npm',
    '.next',
    'dist',
    'build',
    'coverage',
    '.nyc_output',
    'logs',
    '.log'
  ];

  console.log(`${colors.yellow}Removing cache and build directories...${colors.reset}`);
  dirsToRemove.forEach((dir) => {
    const fullPath = path.join(basePath, dir);
    const size = getDirectorySize(fullPath);
    if (removeDirectory(fullPath)) {
      console.log(`${colors.green}✓${colors.reset} Removed: ${dir} (${formatBytes(size)})`);
      totalSize += size;
      deletedDirs++;
    }
  });

  // Files to remove
  const filesToRemove = [
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    '*.pid',
    '.env.local',
    '.env.test'
  ];

  console.log(`\n${colors.yellow}Removing cache files...${colors.reset}`);
  filesToRemove.forEach((pattern) => {
    const isPattern = pattern.includes('*');
    if (isPattern) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const walk = (dir) => {
        try {
          fs.readdirSync(dir).forEach((file) => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (stats.isDirectory()) {
              walk(filePath);
            } else if (regex.test(file)) {
              const size = stats.size;
              fs.unlinkSync(filePath);
              console.log(`${colors.green}✓${colors.reset} Removed: ${filePath}`);
              totalSize += size;
              deletedFiles++;
            }
          });
        } catch (e) {
          // Ignore errors for permission denied, etc
        }
      };
      walk(basePath);
    } else {
      const fullPath = path.join(basePath, pattern);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          fs.unlinkSync(fullPath);
          console.log(`${colors.green}✓${colors.reset} Removed: ${pattern} (${formatBytes(stats.size)})`);
          totalSize += stats.size;
          deletedFiles++;
        }
      }
    }
  });

  // Optional: Clean npm cache
  console.log(`\n${colors.yellow}Cleaning npm cache...${colors.reset}`);
  try {
    execSync('npm cache clean --force', { stdio: 'pipe' });
    console.log(`${colors.green}✓${colors.reset} npm cache cleaned`);
  } catch (e) {
    console.log(`${colors.yellow}⚠${colors.reset} npm cache clean skipped`);
  }

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(60)}`);
  console.log('Cleanup Summary');
  console.log(`${'='.repeat(60)}${colors.reset}`);
  console.log(`Files removed: ${deletedFiles}`);
  console.log(`Directories removed: ${deletedDirs}`);
  console.log(`${colors.green}Space freed: ${formatBytes(totalSize)}${colors.reset}`);
  console.log(`${'='.repeat(60)}\n`);
}

// Run cleanup
if (require.main === module) {
  cleanup();
}

module.exports = { cleanup };
