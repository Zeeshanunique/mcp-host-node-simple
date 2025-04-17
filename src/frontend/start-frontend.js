const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { spawn } = require('child_process');

// Load the root .env file
const rootEnvPath = path.resolve(__dirname, '../../.env');
let frontendPort = 3002; // Default to match the .env default

if (fs.existsSync(rootEnvPath)) {
  // Parse the root .env file
  const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath));
  frontendPort = envConfig.FRONTEND_PORT || 3002;
  console.log(`Starting frontend on port ${frontendPort} from root .env file`);
} else {
  console.log('Root .env file not found, using default port 3002');
}

// Set the PORT environment variable for the React app
process.env.PORT = frontendPort;

// Start the React app with the specified port
require('react-scripts/scripts/start');