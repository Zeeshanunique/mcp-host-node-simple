import { CoreMessage } from 'ai';
import { setProvider, getCurrentProvider } from './providers.js';

// Simple test to simulate the frontend's API call using Azure provider
async function testAzureAPIResponse() {
  try {
    console.log('Testing Azure OpenAI provider via API endpoint...');
    
    // Force the provider to be Azure
    setProvider('azure');
    console.log('Current provider set to:', getCurrentProvider());
    
    // Create a simple chat history
    const history: CoreMessage[] = [
      { role: 'user', content: 'Hello, can you tell me about Azure OpenAI?' }
    ];
    
    // Send the request to the local API endpoint
    const response = await fetch('http://localhost:6754/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        history,
        provider: 'azure' // Explicitly set provider to azure
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    // Log the full response
    console.log('API Response Structure:', JSON.stringify(data, null, 2));
    
    // Check if the response has the expected fields
    console.log('Response has initialResponse:', !!data.initialResponse);
    console.log('Response has toolResults:', !!data.toolResults);
    console.log('Response has finalResponse:', !!data.finalResponse);
    
    // Log response content if it exists
    if (data.initialResponse) {
      console.log('Initial Response:', data.initialResponse.substring(0, 100) + '...');
    }
    
    if (data.finalResponse) {
      console.log('Final Response:', data.finalResponse.substring(0, 100) + '...');
    }
  } catch (error) {
    console.error('Error testing Azure API response:', error);
  }
}

// Run the test
testAzureAPIResponse(); 