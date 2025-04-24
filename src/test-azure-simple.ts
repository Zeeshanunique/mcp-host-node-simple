import { AzureOpenAIProvider } from "./llm-provider.js";

async function main() {
  try {
    console.log('Testing AzureOpenAIProvider directly...');
    
    // Initialize the provider
    const provider = new AzureOpenAIProvider();
    console.log('Provider name:', provider.name());
    
    // Get the model
    const model = provider.model();
    
    // Call doGenerate directly
    const response = await (model as any).doGenerate({
      prompt: [{ role: 'user', content: 'Hello, Azure OpenAI. What are you?' }]
    });
    
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 