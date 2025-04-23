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

    const toolsValid = await this.validateTools();
    console.log(`[MCPHost] Tool validation: ${toolsValid ? 'Passed' : 'Failed'}`);
    console.log('[MCPHost] Host started with', await this.toolList());
  }

  async tools() {
    console.log('[MCPHost] Returning configured tools:', Object.keys(this.#tools).length);
    return this.#tools;
  }

  async toolList(): Promise<string[]> {
    const toolsObj = await this.tools();
    const toolNames = Object.keys(toolsObj);
    console.log('[MCPHost] Available tools:', toolNames);
    return toolNames;
  }

  // Add validation method to verify tools are properly loaded
  async validateTools(): Promise<boolean> {
    const tools = await this.tools();
    const toolCount = Object.keys(tools).length;
    console.log(`[MCPHost] Validating tools: found ${toolCount} tools`);
    
    if (toolCount === 0) {
      console.warn('[MCPHost] No tools available - MCP functionality will be limited');
      return false;
    }
    
    // Verify each tool has the required properties
    let validTools = 0;
    for (const [name, tool] of Object.entries(tools)) {
      if (typeof tool === 'function' || (typeof tool === 'object' && tool !== null)) {
        validTools++;
      } else {
        console.warn(`[MCPHost] Invalid tool: ${name} (${typeof tool})`);
      }
    }
    
    console.log(`[MCPHost] Tool validation: ${validTools}/${toolCount} tools are valid`);
    return validTools > 0;
  }

  // Add method to get tools with metadata
  async toolsWithMetadata() {
    const toolsObj = await this.tools();
    const enhancedTools: Record<string, any> = {};
    
    for (const [name, tool] of Object.entries(toolsObj)) {
      // Extract or generate metadata
      const metadata = {
        name,
        description: (tool as any).description || `Tool for ${name.replace(/_/g, ' ')} operations`,
        parameters: (tool as any).parameters || {},
        category: this.categorizeToolByName(name),
      };
      
      enhancedTools[name] = {
        ...tool,
        metadata
      };
    }
    
    return enhancedTools;
  }

  private categorizeToolByName(name: string): string {
    // Categorize tools for better organization and sequential usage
    if (name.includes('search') || name.includes('research') || name.includes('find')) {
      return 'information-gathering';
    }
    if (name.includes('analyze') || name.includes('process') || name.includes('summarize')) {
      return 'data-processing';
    }
    if (name.includes('create') || name.includes('generate') || name.includes('make')) {
      return 'content-generation';
    }
    if (name.includes('add') || name.includes('subtract') || name.includes('multiply') || name.includes('calculate')) {
      return 'calculation';
    }
    return 'utility';
  }
}
