import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Calculator',
  version: '1.0.0',
  description: 'A simple calculator tool with various mathematical operations',
});

// Single comprehensive calculator tool
server.tool('calculate', { 
  operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt'])
    .describe('Mathematical operation to perform'),
  a: z.number().describe('First number'),
  b: z.number().optional().describe('Second number (not required for sqrt operation)') 
}, async ({ operation, a, b }) => {
  console.log(`[Calculator] Performing operation: ${operation}`);
  
  let result;
  let expression;
  
  switch (operation) {
    case 'add':
      if (b === undefined) throw new Error("Second number required for addition");
      result = a + b;
      expression = `${a} + ${b}`;
      break;
      
    case 'subtract':
      if (b === undefined) throw new Error("Second number required for subtraction");
      result = a - b;
      expression = `${a} - ${b}`;
      break;
      
    case 'multiply':
      if (b === undefined) throw new Error("Second number required for multiplication");
      result = a * b;
      expression = `${a} * ${b}`;
      break;
      
    case 'divide':
      if (b === undefined) throw new Error("Second number required for division");
      if (b === 0) throw new Error("Division by zero is not allowed");
      result = a / b;
      expression = `${a} / ${b}`;
      break;
      
    case 'power':
      if (b === undefined) throw new Error("Second number (exponent) required for power operation");
      result = Math.pow(a, b);
      expression = `${a} ^ ${b}`;
      break;
      
    case 'sqrt':
      if (a < 0) throw new Error("Cannot calculate square root of negative number");
      result = Math.sqrt(a);
      expression = `√${a}`;
      break;
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  return {
    content: [{ 
      type: 'text', 
      text: `${expression} = ${result}`
    }],
  };
});

async function main() {
  try {
    console.log("[Calculator Server] Starting...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("[Calculator Server] Connected");
  } catch (error) {
    console.error("[Calculator Server] Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[Calculator Server] Fatal error:", error);
  process.exit(1);
}); 