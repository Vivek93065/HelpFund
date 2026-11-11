/**
 * server.js
 * 
 * HelpFund Application Entry Point
 * 
 * Usage:
 *   .\run.bat dev      (Development with nodemon auto-restart)
 *   .\run.bat start    (Production mode)
 */

const app = require('./src/app');
const config = require('./src/config/env');
const { resolvedDbPath } = require('./src/config/db');

const server = app.listen(config.port, () => {
  console.log('====================================================');
  console.log('           HelpFund Server Started Successfully     ');
  console.log('====================================================');
  console.log(`Port        : ${config.port}`);
  console.log(`Environment : ${config.nodeEnv}`);
  console.log(`URL         : http://localhost:${config.port}`);
  console.log(`Database    : ${resolvedDbPath}`);
  console.log(`Health Check: http://localhost:${config.port}/api/health`);
  console.log('====================================================\n');
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully closing HTTP server...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close if connections remain open after 5 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
