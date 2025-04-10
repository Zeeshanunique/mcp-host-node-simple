import path from 'node:path';
import { readMCPTransport } from './mcp-transport.js';
import { experimental_createMCPClient } from 'ai';

export type MCPHostOptions = {
  mcpServerConfig: string;
};

export type MCPClient = Awaited<
  ReturnType<typeof experimental_createMCPClient>
>;

export class MCPHost {
  #tools: Record<string, any>;

  constructor() {
    this.#tools = {};
  }

  async start(options: MCPHostOptions) {
    console.log('[MCPHost] Host get started');

    const configPath = path.resolve(process.cwd(), options.mcpServerConfig);
    console.log('[MCPHost] Reading config from:', configPath);
    
    const transports = await readMCPTransport(configPath);
    console.log('[MCPHost] Configured servers:', Object.keys(transports));

    // Create clients for each server, handling errors individually
    const clients: MCPClient[] = [];
    for (const [name, transport] of Object.entries(transports)) {
      try {
        console.log(`[MCPHost] Creating client for server: ${name}`);
        const client = await experimental_createMCPClient({ transport });
        clients.push(client);
        console.log(`[MCPHost] Successfully created client for server: ${name}`);
      } catch (err) {
        console.error(`[MCPHost] Error creating client for ${name}:`, err);
        // Continue with other servers
      }
    }

    console.log(`[MCPHost] Created ${clients.length} clients successfully`);

    // Load tools from each client, handling errors individually
    for (const client of clients) {
      try {
        console.log('[MCPHost] Getting tools from client...');
        const tools = await client.tools();
        console.log('[MCPHost] Got tools:', Object.keys(tools));

        for (const [name, tool] of Object.entries(tools)) {
          console.log(`[MCPHost] Adding tool: ${name}`);
          this.#tools = {
            ...this.#tools,
            [name]: tool,
          };
        }
      } catch (err) {
        console.error('[MCPHost] Error getting tools from client:', err);
        // Continue with other clients
      }
    }

    console.log('[MCPHost] Host started with', await this.toolList());
  }

  async tools() {
    return this.#tools;
  }

  async toolList(): Promise<any> {
    return Object.keys(await this.tools());
  }
}
