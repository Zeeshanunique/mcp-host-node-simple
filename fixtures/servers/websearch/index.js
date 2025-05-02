import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory name for the current module (ESM compatible approach)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
} else {
  console.warn('[WebSearch] No .env file found, using environment variables or defaults');
}

// Configure API keys and settings
const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || '';

// Fallback search results
const fallbackSearchResponse = (query) => {
  return {
    content: [
      { 
        type: 'text', 
        text: `Search results for "${query}":\n` +
              `[Note: Could not connect to search API. Showing simulated results.]\n\n` +
              `1. Example result 1 related to ${query}\n` +
              `2. Example result 2 related to ${query}\n` +
              `3. Example result 3 related to ${query}\n`
      }
    ],
  };
};

const server = new McpServer({
  name: 'WebSearch',
  version: '1.0.0',
});

// SerpAPI implementation for Google search
async function searchWithSerpApi(query, searchType = 'search') {
  if (!SERPAPI_API_KEY) {
    console.warn('[WebSearch] No SerpAPI key provided, using fallback response');
    return fallbackSearchResponse(query);
  }

  try {
    console.log(`[WebSearch] Searching with SerpAPI for: ${query}`);
    
    // Build the API endpoint URL with parameters
    const params = new URLSearchParams({
      q: query,
      api_key: SERPAPI_API_KEY,
      engine: 'google',
      num: 10 // number of results
    });
    
    if (searchType === 'news') {
      params.append('tbm', 'nws'); // Add news parameter
    }
    
    const response = await axios.get(
      `https://serpapi.com/search?${params.toString()}`
    );
    
    // Select the appropriate results based on search type
    let results;
    let title;
    
    if (searchType === 'news') {
      results = response.data.news_results || [];
      title = `News results for "${query}"`;
    } else {
      // Extract featured snippet (answer box) if available
      const answerBox = response.data.answer_box;
      // Get organic results
      results = response.data.organic_results || [];
      title = `Search results for "${query}"`;
    }
    
    // Format the response
    let formattedResults = `${title}:\n\n`;
    
    // Include answer box if available (only for regular search)
    if (searchType !== 'news' && response.data.answer_box) {
      const answerBox = response.data.answer_box;
      formattedResults += `Featured answer: ${answerBox.title || ''}\n`;
      if (answerBox.answer) {
        formattedResults += `${answerBox.answer}\n`;
      } else if (answerBox.snippet) {
        formattedResults += `${answerBox.snippet}\n`;
      }
      formattedResults += `\n`;
    }
    
    // Include knowledge graph if available (only for regular search)
    if (searchType !== 'news' && response.data.knowledge_graph) {
      const kg = response.data.knowledge_graph;
      formattedResults += `Knowledge Graph: ${kg.title || ''}\n`;
      if (kg.description) {
        formattedResults += `${kg.description}\n`;
      }
      formattedResults += `\n`;
    }
    
    // Include results
    if (searchType === 'news') {
      // Format news results
      results.slice(0, 5).forEach((result, index) => {
        formattedResults += `${index + 1}. ${result.title || ''}\n`;
        if (result.snippet) {
          formattedResults += `   ${result.snippet}\n`;
        }
        if (result.date) {
          formattedResults += `   Published: ${result.date}\n`;
        }
        if (result.link) {
          formattedResults += `   URL: ${result.link}\n`;
        }
        formattedResults += `\n`;
      });
    } else {
      // Format organic search results
      results.slice(0, 5).forEach((result, index) => {
        formattedResults += `${index + 1}. ${result.title || ''}\n`;
        if (result.snippet) {
          formattedResults += `   ${result.snippet}\n`;
        }
        if (result.link) {
          formattedResults += `   URL: ${result.link}\n`;
        }
        formattedResults += `\n`;
      });
    }
    
    // Include pagination info if available
    if (response.data.serpapi_pagination && response.data.serpapi_pagination.current) {
      formattedResults += `Page: ${response.data.serpapi_pagination.current} of approximately ${response.data.search_information?.total_results || 'many'} results\n`;
    }
    
    return {
      content: [{ type: 'text', text: formattedResults }],
    };
  } catch (error) {
    console.error(`[WebSearch] SerpAPI error: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error searching for "${query}": ${error.message}. Please try again later.` 
      }],
    };
  }
}

// Register the search tool
server.tool('search', { query: z.string() }, async ({ query }) => {
  console.log(`[WebSearch] Received search request for: ${query}`);
  return await searchWithSerpApi(query, 'search');
});

// Add a specialized search tool for news
server.tool('search_news', { query: z.string() }, async ({ query }) => {
  console.log(`[WebSearch] Received news search request for: ${query}`);
  return await searchWithSerpApi(query, 'news');
});

// Add an image search tool
server.tool('search_images', { query: z.string() }, async ({ query }) => {
  if (!SERPAPI_API_KEY) {
    console.warn('[WebSearch] No SerpAPI key provided, using fallback response');
    return fallbackSearchResponse(`images of ${query}`);
  }

  try {
    console.log(`[WebSearch] Searching for images: ${query}`);
    
    // Build the API endpoint URL with parameters
    const params = new URLSearchParams({
      q: query,
      api_key: SERPAPI_API_KEY,
      engine: 'google_images',
      ijn: "0", // Page number
      num: 10 // number of results
    });
    
    const response = await axios.get(
      `https://serpapi.com/search?${params.toString()}`
    );
    
    const imageResults = response.data.images_results || [];
    
    // Format the response
    let formattedResults = `Image results for "${query}":\n\n`;
    
    imageResults.slice(0, 5).forEach((result, index) => {
      formattedResults += `${index + 1}. ${result.title || 'Image'}\n`;
      if (result.source) {
        formattedResults += `   Source: ${result.source}\n`;
      }
      if (result.original) {
        formattedResults += `   URL: ${result.original}\n`;
      }
      if (result.thumbnail) {
        formattedResults += `   Thumbnail: ${result.thumbnail}\n`;
      }
      formattedResults += `\n`;
    });
    
    return {
      content: [{ type: 'text', text: formattedResults }],
    };
  } catch (error) {
    console.error(`[WebSearch] Image search API error: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error searching images for "${query}": ${error.message}. Please try again later.` 
      }],
    };
  }
});

async function main() {
  try {
    console.log("[WebSearch Server] Starting...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("[WebSearch Server] Connected");
  } catch (error) {
    console.error("[WebSearch Server] Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[WebSearch Server] Fatal error:", error);
  process.exit(1);
});