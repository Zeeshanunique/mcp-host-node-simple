#!/usr/bin/env node

// Test script for MCP host integration with Python server
const path = require('path');
const { MCPHost } = require('../../../src/mcp-host.js');
const fs = require('fs');

// Create a temporary config with just our Python server
const tempConfig = {
  mcpServers: {
    "python-test": {
      command: "python",
      args: [
        path.resolve(__dirname, 'mcp_test_server.py')
      ],
      env: {
        PYTHONUNBUFFERED: "1"
      }
    }
  }
};

// Temp config file path
const tempConfigPath = path.join(__dirname, 'temp-config.json');

async function runTest() {
  try {
    // Write temporary config
    fs.writeFileSync(tempConfigPath, JSON.stringify(tempConfig, null, 2));
    console.log('Created temporary config at:', tempConfigPath);
    
    // Initialize MCPHost with our config
    const host = new MCPHost();
    await host.start({
      mcpServerConfig: tempConfigPath
    });
    
    // Get available tools
    const tools = await host.tools();
    console.log('Available tools:', Object.keys(tools));
    
    // Test the Python echo tool
    if (tools.python_echo) {
      console.log('Testing python_echo tool...');
      try {
        const result = await tools.python_echo({
          message: 'Hello from MCP host integration test!'
        });
        console.log('Tool result:', result);
      } catch (err) {
        console.error('Error calling tool:', err);
      }
    } else {
      console.error('python_echo tool not found!');
    }
    
    console.log('Test complete!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    // Clean up temp config file
    try {
      fs.unlinkSync(tempConfigPath);
      console.log('Cleaned up temporary config file');
    } catch (err) {
      console.error('Error cleaning up:', err);
    }
    process.exit(0);
  }
}

runTest(); 