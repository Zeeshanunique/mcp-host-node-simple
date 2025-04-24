import { CoreMessage } from 'ai';
import { setProvider, getCurrentProvider } from './providers.js';

// Improved test to simulate the frontend's API call using Azure provider
async function testAzureAPIResponseV2() {
  try {
    console.log('Testing improved Azure OpenAI provider via API endpoint...');
    
    // Force the provider to be Azure
    setProvider('azure');
    console.log('Current provider set to:', getCurrentProvider());
    
    // Create a simple chat history with a more complex query that might trigger tool use
    const history: CoreMessage[] = [
      { role: 'user', content: 'Calculate 42 + 57 and then tell me what the sum is.' }
    ];
    
    // Send the request to the local API endpoint
    console.log('Sending request to API...');
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
    
    // Log the full response structure but limit content length for readability
    console.log('API Response Structure:', JSON.stringify({
      initialResponse: data.initialResponse?.substring(0, 100) + (data.initialResponse?.length > 100 ? '...' : ''),
      toolResults: data.toolResults?.map((tr: any) => ({
        name: tr.name,
        sequence: tr.sequence,
        totalSteps: tr.totalSteps,
        result: tr.result?.substring(0, 30) + (tr.result?.length > 30 ? '...' : '')
      })),
      finalResponse: data.finalResponse?.substring(0, 100) + (data.finalResponse?.length > 100 ? '...' : '')
    }, null, 2));
    
    // Check if the response has the expected fields
    console.log('Response has initialResponse:', !!data.initialResponse);
    console.log('Response has toolResults:', !!data.toolResults && Array.isArray(data.toolResults));
    console.log('Response has finalResponse:', !!data.finalResponse);
    
    // Log response content if it exists
    if (data.initialResponse) {
      console.log('Initial Response:', data.initialResponse);
    }
    
    if (data.toolResults && data.toolResults.length > 0) {
      console.log(`Tool Results (${data.toolResults.length}):`);
      data.toolResults.forEach((tool: any, index: number) => {
        console.log(`  ${index + 1}. ${tool.name}: ${tool.result?.substring(0, 50)}${tool.result?.length > 50 ? '...' : ''}`);
      });
    }
    
    if (data.finalResponse) {
      console.log('Final Response:', data.finalResponse);
    }
  } catch (error) {
    console.error('Error testing Azure API response:', error);
  }
}

// Run the test
testAzureAPIResponseV2(); 