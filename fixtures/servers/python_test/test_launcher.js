#!/usr/bin/env node

// Simple test launcher for the Python MCP server
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Python MCP server test...');

const pythonScriptPath = path.join(__dirname, 'mcp_test_server.py');
console.log(`Python script path: ${pythonScriptPath}`);

// Spawn the Python process with the PYTHONUNBUFFERED env var
const pythonProcess = spawn('python', [pythonScriptPath], {
  env: { ...process.env, PYTHONUNBUFFERED: '1' },
  stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
});

// Log the PID and connection status
console.log(`Python process spawned with PID: ${pythonProcess.pid}`);

// Handle stdout data
pythonProcess.stdout.on('data', (data) => {
  console.log(`[Python stdout]: ${data.toString().trim()}`);
});

// Handle stderr data
pythonProcess.stderr.on('data', (data) => {
  console.log(`[Python stderr]: ${data.toString().trim()}`);
});

// Handle process exit
pythonProcess.on('close', (code) => {
  console.log(`Python process exited with code ${code}`);
});

// Send a test request
const testRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'mcp.list_tools'
};

// Wait for a bit then send the test request
setTimeout(() => {
  console.log('Sending test request to Python server...');
  pythonProcess.stdin.write(JSON.stringify(testRequest) + '\n');
  
  // Wait for response then test a tool
  setTimeout(() => {
    const toolRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'mcp.execute_tool',
      params: {
        name: 'python_echo',
        parameters: {
          message: 'Hello from Node.js!'
        }
      }
    };
    
    console.log('Sending tool execution request...');
    pythonProcess.stdin.write(JSON.stringify(toolRequest) + '\n');
    
    // Wait before exiting
    setTimeout(() => {
      console.log('Test complete, terminating Python process...');
      pythonProcess.kill();
      process.exit(0);
    }, 1000);
  }, 1000);
}, 1000); 