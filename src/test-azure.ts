import { AzureOpenAIProvider } from './llm-provider.js';
import { CoreMessage } from 'ai';

async function testAzureOpenAI() {
  try {
    console.log('Testing Azure OpenAI provider...');
    console.log('Environment variables:');
    console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? 'Found (masked)' : 'Not found');
    console.log('AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    
    const azureProvider = new AzureOpenAIProvider();
    console.log('Provider name:', azureProvider.name());
    
    const model = azureProvider.model();
    console.log('Model initialized successfully');
    
    // Create a proper CoreMessage array
    const messages: CoreMessage[] = [
      { role: 'user', content: 'Hello, how are you?' }
    ];
    
    // Use the model with type assertion to bypass TypeScript's call signature check
    const result = await (model as any)({
      messages,
      maxTokens: 1000,
      temperature: 0.7
    });
    
    console.log('Response:', result);
  } catch (error) {
    console.error('Error testing Azure OpenAI provider:', error);
  }
}

testAzureOpenAI(); 