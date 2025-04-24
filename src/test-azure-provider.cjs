require('dotenv').config();
const { OpenAI } = require('openai');

// This is a simplified version of what's in the AzureOpenAIProvider class
// to test the same approach but in CommonJS format

async function testAzureOpenAIProvider() {
  try {
    console.log('Testing Azure OpenAI provider implementation...');
    console.log('Environment variables:');
    console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? 'Found (masked)' : 'Not found');
    console.log('AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
    
    // Initialize the OpenAI client with Azure-specific configuration
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${deploymentName}`,
      defaultQuery: { 'api-version': '2024-10-21' },
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
    });
    
    console.log('Client initialized, creating compatible model function...');
    
    // Create a function similar to our LanguageModel adapter
    const modelFunction = async (options) => {
      const { messages, maxTokens = 1000, temperature = 0.7 } = options;
      
      const formattedMessages = [];
      
      for (const msg of messages) {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        
        switch (msg.role) {
          case 'system':
            formattedMessages.push({ role: 'system', content });
            break;
          case 'user':
            formattedMessages.push({ role: 'user', content });
            break;
          case 'assistant':
            formattedMessages.push({ role: 'assistant', content });
            break;
          default:
            formattedMessages.push({ role: 'user', content });
        }
      }
      
      console.log('Sending messages to Azure OpenAI:', formattedMessages);
      
      try {
        const response = await client.chat.completions.create({
          model: deploymentName,
          messages: formattedMessages,
          max_tokens: maxTokens,
          temperature: temperature,
        });
        
        console.log('Response received successfully');
        
        const choice = response.choices[0];
        
        return {
          content: choice.message.content || '',
          id: response.id,
          model: deploymentName,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
          },
        };
      } catch (error) {
        console.error('Error calling Azure OpenAI:', error);
        throw error;
      }
    };
    
    // Test the model function
    const result = await modelFunction({
      messages: [
        { role: 'user', content: 'Hello, can you test if the Azure OpenAI integration is working?' }
      ]
    });
    
    console.log('Response from model function:');
    console.log('Content:', result.content);
    console.log('Usage:', result.usage);
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testAzureOpenAIProvider(); 