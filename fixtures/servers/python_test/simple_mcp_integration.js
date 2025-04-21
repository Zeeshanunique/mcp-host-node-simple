#!/usr/bin/env node

/**
 * Simple test for MCP host integration with the Python server
 * This script focuses on just the Python server to test compatibility.
 */
const { Experimental_StdioMCPTransport } = require('ai/mcp-stdio');
const { experimental_createMCPClient } = require('ai');
const path = require('path');

async function main() {
  try {
    console.log('Starting Python MCP server integration test...');
    
    // Create transport for Python server
    console.log('Creating transport for Python MCP server...');
    const pythonScriptPath = path.resolve(
      __dirname, 
      'mcp_test_server.py'
    );
    
    // Windows needs special handling
    const isWindows = process.platform === 'win32';
    const transportCommand = isWindows ? 'cmd' : 'python';
    const transportArgs = isWindows 
      ? ['/c', 'python', pythonScriptPath]
      : [pythonScriptPath];
    
    console.log(`Command: ${transportCommand}`);
    console.log(`Args: ${transportArgs.join(' ')}`);
    
    // Create transport
    const transport = new Experimental_StdioMCPTransport({
      command: transportCommand,
      args: transportArgs,
      env: { PYTHONUNBUFFERED: '1' },
      stderr: process.stderr,
      cwd: process.cwd(),
    });
    
    // Create MCP client
    console.log('Creating MCP client...');
    const client = await experimental_createMCPClient({ transport });
    
    // Get tools
    console.log('Getting tools from client...');
    const tools = await client.tools();
    console.log('Available tools:', Object.keys(tools));
    
    // Test tools
    if (tools.python_echo) {
      console.log('Testing python_echo tool...');
      const result = await tools.python_echo({
        message: 'Hello from MCP integration test!'
      });
      console.log('Result:', result);
    }
    
    if (tools.python_add) {
      console.log('Testing python_add tool...');
      const result = await tools.python_add({
        a: 5,
        b: 10
      });
      console.log('Result:', result);
    }
    
    console.log('Test completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

main(); 