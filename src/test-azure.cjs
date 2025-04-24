require('dotenv').config();
const { OpenAI } = require('openai');

async function testAzureOpenAI() {
  try {
    console.log('Testing Azure OpenAI connection...');
    console.log('Environment variables:');
    console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? 'Found (masked)' : 'Not found');
    console.log('AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    
    const client = new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
      defaultQuery: { 'api-version': '2024-10-21' },
      defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
    });
    
    console.log('Client initialized, sending test request...');
    
    const response = await client.chat.completions.create({
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ],
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    });
    
    console.log('Response received:');
    console.log(response.choices[0].message);
  } catch (error) {
    console.error('Error testing Azure OpenAI connection:', error);
  }
}

testAzureOpenAI(); 