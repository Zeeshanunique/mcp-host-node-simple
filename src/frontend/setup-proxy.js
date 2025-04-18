// Simple script to update the frontend proxy configuration
const fs = require('fs');
const path = require('path');

// Try to load dotenv if available
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (err) {
  console.log('Dotenv not available, using default port values');
}

// Get the backend port from environment or use default 3001
const backendPort = process.env.BACKEND_PORT || 3001;
const packageJsonPath = path.resolve(__dirname, 'package.json');

// Read the current package.json
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const proxyUrl = `http://localhost:${backendPort}`;
  
  // Update the proxy value
  packageJson.proxy = proxyUrl;
  
  // Write the updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`Updated frontend proxy to: ${proxyUrl}`);
} catch (error) {
  console.error('Error updating frontend proxy:', error);
  process.exit(1);
}

