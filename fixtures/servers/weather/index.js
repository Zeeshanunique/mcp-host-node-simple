import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'Weather',
  version: '1.0.0',
});

server.tool('get_weather', { 
  location: z.string(),
  units: z.enum(['metric', 'imperial']).optional().default('metric')
}, async ({ location, units }) => {
  console.log(`[Weather] Getting weather for: ${location} in ${units} units`);
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Generate random weather data for demonstration
  const temperature = units === 'metric' 
    ? Math.round(15 + Math.random() * 15) 
    : Math.round(59 + Math.random() * 27);
  
  const conditions = ['sunny', 'partly cloudy', 'cloudy', 'rainy', 'stormy'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];
  
  const tempUnit = units === 'metric' ? '°C' : '°F';
  
  return {
    content: [
      { 
        type: 'text', 
        text: `Weather for ${location}:\n` +
              `Temperature: ${temperature}${tempUnit}\n` +
              `Conditions: ${condition}\n` +
              `Humidity: ${Math.round(50 + Math.random() * 40)}%\n` +
              `Wind: ${Math.round(5 + Math.random() * 20)} km/h\n\n` +
              `Note: This is simulated weather data for demonstration purposes.`
      }
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});