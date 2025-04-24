import { LLMClient } from "./llm-client.js";
import { AzureOpenAIProvider } from "./llm-provider.js";

async function main() {
  try {
    console.log('Testing AzureOpenAIProvider with LLMClient...');
    
    // Initialize LLMClient with AzureOpenAIProvider
    const llm = new LLMClient({ provider: new AzureOpenAIProvider() });

    // Add a user message
    llm.append("user", "What is Azure OpenAI? Explain in one sentence.");

    // Generate a response
    const { text: response } = await llm.generate();

    console.log('[Assistant]', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 