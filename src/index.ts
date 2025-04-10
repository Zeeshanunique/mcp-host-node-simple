import './backend/server.js';
import { LLMClient, LLMToolResults } from "./llm-client.js";
import { AnthropicProvider } from "./llm-provider.js";
import { MCPHost } from "./mcp-host.js";

// This file serves as the main entry point for Vercel deployment
// The actual server code is in backend/server.js
console.log('[Main] Server imported and running');

async function main() {
  const host = new MCPHost();