import fs from 'node:fs/promises';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { experimental_createMCPClient, MCPTransport } from 'ai';
import path from 'node:path';

export type SSEMCPTransport = Exclude<
  Parameters<typeof experimental_createMCPClient>[0]['transport'],
  MCPTransport
>;

export type MCPClientTransport =
  | Experimental_StdioMCPTransport
  | SSEMCPTransport;

export async function readMCPTransport(
  mcpServerConfig: string
): Promise<Record<string, MCPClientTransport>> {
  try {
    console.log(`[Transport] Reading MCP server config from: ${mcpServerConfig}`);
    
    const configContent = await fs.readFile(mcpServerConfig, 'utf-8');
    console.log(`[Transport] Config content length: ${configContent.length}`);
    
    const config = JSON.parse(configContent);
    console.log(`[Transport] Parsed config, mcpServers:`, Object.keys(config.mcpServers || {}));
    
    if (!config.mcpServers) {
      throw new Error(
        'Invalid MCP server config, missing mcpServers property.'
      );
    }

    const transports = Object.entries<any>(config.mcpServers).reduce(
      (acc, [name, option]) => {
        console.log(`[Transport] Processing server: ${name}`);
        try {
          if (option.command) {
            console.log(`[Transport] Creating StdioMCPTransport for ${name}, command: ${option.command}, args:`, option.args);
            
            // Ensure paths are resolved correctly
            const args = option.args.map((arg: string) => {
              if (arg.startsWith('./')) {
                return path.resolve(process.cwd(), arg);
              }
              return arg;
            });
            
            console.log(`[Transport] Resolved args for ${name}:`, args);
            
            acc[name] = new Experimental_StdioMCPTransport({
              command: option.command,
              args: args,
              env: option.env,
              stderr: process.stderr, // Redirect stderr to main process for debugging
              cwd: option.cwd || process.cwd(),
            });
            console.log(`[Transport] Created transport for ${name}`);
          } else if (option.url) {
            // @FIXME check /sse perfix
            console.log(`[Transport] Creating SSE transport for ${name} with URL: ${option.url}`);
            acc[name] = { type: 'sse', url: option.url } as SSEMCPTransport;
          } else {
            throw new Error('MCP server config has no command or url property.');
          }
        } catch (err) {
          console.error(`[Transport] Error creating transport for ${name}:`, err);
          throw err;
        }

        return acc;
      },
      {} as Record<string, MCPClientTransport>
    );

    console.log(`[Transport] Created ${Object.keys(transports).length} transports:`, Object.keys(transports));
    return transports;
  } catch (err) {
    console.error('[Transport] Error reading MCP server config:', err);
    throw err;
  }

  return {};
}
