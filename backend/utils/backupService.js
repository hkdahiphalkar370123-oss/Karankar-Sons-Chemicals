/**
 * Backup System - Database & File Backups
 * Scheduled daily backups for MongoDB and uploads folder
 * Backups are compressed and timestamped
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { CronJob } = require('cron');
const archiver = require('archiver');
const { Readable } = require('stream');

const execAsync = promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const UPLOADS_DIR = path.join(process.cwd(), 'backend', 'uploads');
const MAX_BACKUP_AGE_DAYS = 30; // Keep backups for 30 days
const BACKUP_HOUR = 2; // 2 AM daily
const BACKUP_MINUTE = 0;

// Ensure backup directory exists
const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
};

/**
 * Create timestamp for backup filename
 */
const getBackupTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').split('T')[0] + 
         '_' + 
         String(now.getHours()).padStart(2, '0') + 
         String(now.getMinutes()).padStart(2, '0');
};

/**
 * Backup MongoDB database using mongodump
 */
const backupDatabase = async () => {
  try {
    const timestamp = getBackupTimestamp();
    const dbBackupDir = path.join(BACKUP_DIR, `db_${timestamp}`);
    
    console.log(`📦 Starting database backup at ${new Date().toISOString()}`);
    
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/karankar_db';
    
    // Execute mongodump
    const { stdout, stderr } = await execAsync(
      `mongodump --uri="${mongoUri}" --out="${dbBackupDir}" --gzip`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large databases
    );

    console.log(`✅ Database backup created: ${dbBackupDir}`);
    
    // Compress the backup
    await compressBackup(dbBackupDir, `${dbBackupDir}.tar.gz`);
    
    // Remove uncompressed backup
    await removeDirectory(dbBackupDir);
    
    console.log(`✅ Database backup compressed: ${dbBackupDir}.tar.gz`);
    return true;
  } catch (error) {
    console.error('❌ Database backup failed:', error.message);
    return false;
  }
};

/**
 * Backup uploaded files
 */
const backupFiles = async () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log('ℹ️  No uploads directory found, skipping file backup');
      return true;
    }

    const timestamp = getBackupTimestamp();
    const fileBackupPath = path.join(BACKUP_DIR, `files_${timestamp}.tar.gz`);
    
    console.log(`📦 Starting file backup at ${new Date().toISOString()}`);
    
    // Compress uploads directory
    await compressDirectory(UPLOADS_DIR, fileBackupPath);
    
    console.log(`✅ File backup created: ${fileBackupPath}`);
    return true;
  } catch (error) {
    console.error('❌ File backup failed:', error.message);
    return false;
  }
};

/**
 * Compress a directory using archiver
 */
const compressDirectory = (sourceDir, outputPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true });

    output.on('close', () => {
      console.log(`📦 Compressed: ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
};

/**
 * Compress an existing backup directory
 */
const compressBackup = (sourceDir, outputPath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true });

    output.on('close', () => {
      console.log(`📦 Compressed: ${outputPath} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceDir, path.basename(sourceDir));
    archive.finalize();
  });
};

/**
 * Remove a directory and its contents
 */
const removeDirectory = (dirPath) => {
  return new Promise((resolve, reject) => {
    fs.rm(dirPath, { recursive: true, force: true }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * Clean up old backups (older than MAX_BACKUP_AGE_DAYS)
 */
const cleanupOldBackups = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return;
    }

    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const maxAge = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    files.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        if (fs.lstatSync(filePath).isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
        console.log(`🗑️  Deleted old backup: ${file}`);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      console.log(`🗑️  Cleanup complete: Removed ${deletedCount} old backup(s)`);
    }
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
};

/**
 * Get backup statistics
 */
const getBackupStats = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return { totalBackups: 0, totalSize: 0, backups: [] };
    }

    const files = fs.readdirSync(BACKUP_DIR);
    let totalSize = 0;
    const backups = [];

    files.forEach((file) => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const size = stats.size;
      totalSize += size;

      backups.push({
        name: file,
        size: size,
        sizeStr: formatBytes(size),
        created: stats.mtime,
        type: file.startsWith('db_') ? 'database' : file.startsWith('files_') ? 'files' : 'unknown'
      });
    });

    // Sort by creation date (newest first)
    backups.sort((a, b) => b.created - a.created);

    return {
      totalBackups: backups.length,
      totalSize: totalSize,
      totalSizeStr: formatBytes(totalSize),
      backups: backups
    };
  } catch (error) {
    console.error('❌ Failed to get backup stats:', error.message);
    return { totalBackups: 0, totalSize: 0, backups: [] };
  }
};

/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Execute full backup (database + files)
 */
const executeFullBackup = async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 BACKUP SYSTEM: Full Backup Started');
  console.log('='.repeat(60) + '\n');

  const startTime = Date.now();
  
  ensureBackupDir();
  cleanupOldBackups();

  const dbSuccess = await backupDatabase();
  const filesSuccess = await backupFiles();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const stats = getBackupStats();

  console.log('\n' + '='.repeat(60));
  console.log('✅ BACKUP SYSTEM: Backup Completed');
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📊 Total Backups: ${stats.totalBackups}`);
  console.log(`💾 Total Size: ${stats.totalSizeStr}`);
  console.log('='.repeat(60) + '\n');

  return dbSuccess && filesSuccess;
};

/**
 * Schedule automatic daily backups
 */
const scheduleBackups = () => {
  try {
    // Schedule for 2 AM daily (0 2 * * *)
    const cronExpression = `${BACKUP_MINUTE} ${BACKUP_HOUR} * * *`;
    
    const job = new CronJob(cronExpression, () => {
      console.log(`\n⏰ Scheduled backup triggered at ${new Date().toISOString()}`);
      executeFullBackup();
    }, null, true, 'UTC');

    console.log(`✅ Backup scheduler initialized (Daily at ${BACKUP_HOUR}:${String(BACKUP_MINUTE).padStart(2, '0')} AM UTC)`);
  } catch (error) {
    console.error('❌ Failed to initialize backup scheduler:', error.message);
  }
};

// Export functions
module.exports = {
  executeFullBackup,
  scheduleBackups,
  getBackupStats,
  backupDatabase,
  backupFiles,
  cleanupOldBackups,
  ensureBackupDir
};
