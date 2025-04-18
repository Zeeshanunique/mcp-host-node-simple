const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load the root .env file
const rootEnvPath = path.resolve(__dirname, '../../.env');
let frontendPort = 3002; // Default fallback
let backendPort = 6754;  // Default fallback
let backendUrl = 'http://localhost:6754';

if (fs.existsSync(rootEnvPath)) {
  // Parse the root .env file
  const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath));
  frontendPort = envConfig.FRONTEND_PORT || frontendPort;
  backendPort = envConfig.BACKEND_PORT || backendPort;
  backendUrl = `http://localhost:${backendPort}`;
  
  console.log(`Starting frontend on port ${frontendPort} from root .env file`);
  console.log(`Backend API URL: ${backendUrl}`);
  
  // Create a .env.local file for the React app to use for API URL
  const reactEnvPath = path.resolve(__dirname, '.env.local');
  fs.writeFileSync(reactEnvPath, `REACT_APP_API_URL=${backendUrl}\n`);
  console.log(`Created .env.local with REACT_APP_API_URL=${backendUrl}`);
} else {
  console.log('Root .env file not found, using default ports');
  fs.writeFileSync(path.resolve(__dirname, '.env.local'), `REACT_APP_API_URL=${backendUrl}\n`);
}

// Set the PORT environment variable for the React app
process.env.PORT = frontendPort;

// Start the React app with the specified port
try {
  require('react-scripts/scripts/start');
} catch (error) {
  console.error('Error starting React app:', error);
  process.exit(1);
}