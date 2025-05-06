import './backend/server.js';
import { LLMClient, LLMToolResults } from "./llm-client.js";
import { AnthropicProvider, OpenAIProvider, BedrockAnthropicProvider } from "./llm-provider.js";
import { MCPHost } from "./mcp-host.js";
import { SessionManager } from "./session-manager.js";
import { SessionStorage } from "./session-storage.js";
import path from 'node:path';

// This file serves as the main entry point for Vercel deployment
// The actual server code is in backend/server.js
console.log('[Main] Server imported and running');

async function main() {
  const host = new MCPHost();
  await host.start({
    mcpServerConfig: "./mcp-servers.json", // This path is okay for local dev
  });

  // Create a session manager for persistent context
  const sessionManager = new SessionManager({
    maxSessionAge: 60 * 60 * 1000, // 1 hour
    maxSessionsPerUser: 3,
    maxMessagesPerSession: 50
  });

  // Create and initialize session storage
  const sessionStorage = new SessionStorage(sessionManager, {
    storageDir: path.join(process.cwd(), 'data', 'sessions'),
  });
  
  await sessionStorage.initialize();
  console.log('[Main] Session storage initialized');

  // Create the LLM client with session manager
  const llm = new LLMClient({ 
    provider: new BedrockAnthropicProvider(),
    sessionManager
  });

  // Create a session for a user
  const session = llm.createSession("user123", {
    name: "Sample Session",
    description: "Testing session-based context"
  });

  console.log(`[Main] Created session: ${session?.id}`);

  // Add system message to the session
  llm.append("system", "You are a helpful AI assistant that uses tools when needed.");
  
  // Set the tool execution context to match the current session
  host.setContext({
    sessionId: session?.id,
    userId: "user123",
    metadata: { source: "example" }
  });
  
  // First interaction
  llm.append("user", "Use add tool to calculate numbers 100 + 1000?");

  const { toolResults, text: toolResponse } = await llm.generate({
    tools: await host.tools(),
  });

  console.log("[Assistant]", toolResponse);

  for (const toolResult of toolResults as LLMToolResults) {
    // Ensure proper type checking or use 'any' if necessary for content access
    const content = (toolResult.result as any)?.content;
    if (Array.isArray(content) && content[0]?.text) {
      llm.append("user", content[0].text);
    }
  }

  const { text: assistantResponse } = await llm.generate();

  console.log("[Assistant]", assistantResponse);

  // Second interaction in the same session
  console.log("\n[Main] Continuing the same session with another question");
  llm.append("user", "What was the result of the calculation we just did?");

  const { text: followUpResponse } = await llm.generate();
  console.log("[Assistant]", followUpResponse);

  // Check tool usage stats for the first session
  const firstSessionStats = host.getToolUsageStats(session!.id);
  console.log("\n[Main] Tool usage stats for first session:", firstSessionStats);

  // Creating a new session
  const session2 = llm.createSession("user456", {
    name: "Second Session",
    description: "Testing multi-session support"
  });

  // Set the tool execution context to the new session
  host.setContext({
    sessionId: session2?.id,
    userId: "user456",
    metadata: { source: "example" }
  });

  console.log(`\n[Main] Created second session: ${session2?.id}`);
  llm.append("user", "What was the calculation result from the previous session?");
  
  const { text: session2Response } = await llm.generate();
  console.log("[Assistant]", session2Response);

  // Switch back to first session
  if (session) {
    console.log(`\n[Main] Switching back to first session: ${session.id}`);
    llm.setSessionId(session.id);
    
    // Also switch tool context
    host.setContext({
      sessionId: session.id,
      userId: "user123",
      metadata: { source: "example" }
    });
    
    llm.append("user", "Let's do another calculation: 200 * 5");
    
    const { toolResults: newToolResults, text: newToolResponse } = await llm.generate({
      tools: await host.tools(),
    });
    
    console.log("[Assistant]", newToolResponse);
    
    for (const toolResult of newToolResults as LLMToolResults) {
      const content = (toolResult.result as any)?.content;
      if (Array.isArray(content) && content[0]?.text) {
        llm.append("user", content[0].text);
      }
    }
    
    const { text: finalResponse } = await llm.generate();
    console.log("[Assistant]", finalResponse);
    
    // Check updated tool usage stats
    const updatedStats = host.getToolUsageStats(session.id);
    console.log("\n[Main] Updated tool usage stats for first session:", updatedStats);
  }

  // Save sessions to storage
  await sessionStorage.saveSessions();
  console.log('[Main] Sessions saved to storage');

  // Print session stats
  const stats = sessionManager.getStats();
  console.log("\n[Main] Session stats:", stats);

  // Clean shutdown
  host.clearContext();
  await sessionStorage.shutdown();
  await host.shutdown();

  process.exit(0);
}

main();