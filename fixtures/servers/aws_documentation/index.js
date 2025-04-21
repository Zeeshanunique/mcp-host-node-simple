/**
 * AWS Documentation MCP Server implementation.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
import {
  extractContentFromHtml,
  formatDocumentationResult,
  isHtmlContent,
  parseRecommendationResults
} from './utils.js';
import { SearchResult, RecommendationResult } from './models.js';

// Constants
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 ModelContextProtocol/1.0 (AWS Documentation Server)';
const SEARCH_API_URL = 'https://proxy.search.docs.aws.amazon.com/search';
const RECOMMENDATIONS_API_URL = 'https://contentrecs-api.docs.aws.amazon.com/v1/recommendations';

// Setup logging
const logLevel = process.env.FASTMCP_LOG_LEVEL || 'warn';
const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

function log(level, message) {
  if (logLevels[level] >= logLevels[logLevel]) {
    console.error(`[${level.toUpperCase()}] ${message}`);
  }
}

// Initialize the MCP server
const server = new McpServer({
  name: 'aws-documentation-mcp-server',
  version: '1.0.0',
  instructions: `
    # AWS Documentation MCP Server

    This server provides tools to access public AWS documentation, search for content, and get recommendations.

    ## Best Practices

    - For long documentation pages, make multiple calls to \`read_documentation\` with different \`start_index\` values for pagination
    - For very long documents (>30,000 characters), stop reading if you've found the needed information
    - When searching, use specific technical terms rather than general phrases
    - Use \`recommend\` tool to discover related content that might not appear in search results
    - For recent updates to a service, get an URL for any page in that service, then check the **New** section of the \`recommend\` tool output on that URL
    - If multiple searches with similar terms yield insufficient results, pivot to using \`recommend\` to find related pages.
    - Always cite the documentation URL when providing information to users

    ## Tool Selection Guide

    - Use \`search_documentation\` when: You need to find documentation about a specific AWS service or feature
    - Use \`read_documentation\` when: You have a specific documentation URL and need its content
    - Use \`recommend\` when: You want to find related content to a documentation page you're already viewing or need to find newly released information
    - Use \`recommend\` as a fallback when: Multiple searches have not yielded the specific information needed
  `,
});

// Define read_documentation tool
server.tool('read_documentation', {
  url: z.string().url(),
  max_length: z.number().int().positive().max(1000000).default(5000),
  start_index: z.number().int().min(0).default(0)
}, 
async ({ url, max_length, start_index }, ctx) => {
  // Validate that URL is from docs.aws.amazon.com and ends with .html
  if (!url.match(/^https?:\/\/docs\.aws\.amazon\.com/)) {
    const errorMsg = `Invalid URL: ${url}. URL must be from the docs.aws.amazon.com domain`;
    log('error', errorMsg);
    return {
      content: [{ type: 'error', text: errorMsg }]
    };
  }
  
  if (!url.endsWith('.html')) {
    const errorMsg = `Invalid URL: ${url}. URL must end with .html`;
    log('error', errorMsg);
    return {
      content: [{ type: 'error', text: errorMsg }]
    };
  }

  log('debug', `Fetching documentation from ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      },
      timeout: 30000
    });

    const pageRaw = response.data;
    const contentType = response.headers['content-type'] || '';

    let content;
    if (isHtmlContent(pageRaw, contentType)) {
      content = extractContentFromHtml(pageRaw);
    } else {
      content = pageRaw;
    }

    const result = formatDocumentationResult(url, content, start_index, max_length);

    // Log if content was truncated
    if (content.length > start_index + max_length) {
      log('debug', `Content truncated at ${start_index + max_length} of ${content.length} characters`);
    }

    return {
      content: [{ type: 'text', text: result }]
    };
  } catch (error) {
    const errorMsg = `Failed to fetch ${url}: ${error.message}`;
    log('error', errorMsg);
    return {
      content: [{ type: 'error', text: errorMsg }]
    };
  }
});

// Define search_documentation tool
server.tool('search_documentation', {
  search_phrase: z.string(),
  limit: z.number().int().min(1).max(50).default(10)
},
async ({ search_phrase, limit }, ctx) => {
  log('debug', `Searching AWS documentation for: ${search_phrase}`);

  try {
    const response = await axios.get(SEARCH_API_URL, {
      params: {
        q: search_phrase,
        size: limit
      },
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      },
      timeout: 30000
    });

    if (!response.data || !response.data.hits || !response.data.hits.hit) {
      log('warn', 'No search results found or unexpected API response format');
      return {
        content: [{ type: 'text', text: 'No search results found for the query.' }]
      };
    }

    const rawResults = response.data.hits.hit;
    const results = [];

    for (let i = 0; i < rawResults.length; i++) {
      const item = rawResults[i];
      const fields = item.fields || {};
      
      // Extract title, removing any HTML tags
      const title = (fields.title || '').replace(/<\/?[^>]+(>|$)/g, '');
      
      // Extract context/description
      let context = fields.description || fields.content || null;
      if (context) {
        context = context.replace(/<\/?[^>]+(>|$)/g, '');
      }
      
      // Only include results with a valid URL
      if (fields.url) {
        results.push(new SearchResult(i + 1, fields.url, title, context));
      }
    }

    log('debug', `Found ${results.length} search results for: ${search_phrase}`);
    
    // Format the results as a nice text response
    let resultText = `Search results for "${search_phrase}":\n\n`;
    
    if (results.length === 0) {
      resultText += "No results found. Try using different search terms.";
    } else {
      results.forEach((result, index) => {
        resultText += `${index + 1}. [${result.title}](${result.url})\n`;
        if (result.context) {
          resultText += `   ${result.context.substring(0, 200)}${result.context.length > 200 ? '...' : ''}\n`;
        }
        resultText += '\n';
      });
    }
    
    return {
      content: [{ type: 'text', text: resultText }]
    };
  } catch (error) {
    const errorMsg = `Error searching AWS documentation: ${error.message}`;
    log('error', errorMsg);
    return {
      content: [{ type: 'error', text: errorMsg }]
    };
  }
});

// Define recommend tool
server.tool('recommend', {
  url: z.string().url()
},
async ({ url }, ctx) => {
  log('debug', `Getting recommendations for: ${url}`);

  const recommendationUrl = `${RECOMMENDATIONS_API_URL}?path=${url}`;

  try {
    const response = await axios.get(recommendationUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      },
      timeout: 30000
    });

    const results = parseRecommendationResults(response.data);
    log('debug', `Found ${results.length} recommendations for: ${url}`);
    
    // Format the results as a nice text response
    let resultText = `Recommendations for ${url}:\n\n`;
    
    if (results.length === 0) {
      resultText += "No recommendations found for this page.";
    } else {
      // Group recommendations by type (based on context)
      const groupedResults = {
        'Highly Rated': [],
        'New': [],
        'Similar': [],
        'Journey': []
      };
      
      results.forEach(result => {
        if (result.context && result.context.startsWith('New content')) {
          groupedResults['New'].push(result);
        } else if (result.context && result.context.startsWith('Intent:')) {
          groupedResults['Journey'].push(result);
        } else if (result.context && result.context === 'Similar content') {
          groupedResults['Similar'].push(result);
        } else {
          groupedResults['Highly Rated'].push(result);
        }
      });
      
      // Output each group
      Object.entries(groupedResults).forEach(([group, items]) => {
        if (items.length > 0) {
          resultText += `## ${group}\n\n`;
          items.forEach((result, index) => {
            resultText += `${index + 1}. [${result.title}](${result.url})\n`;
            if (result.context && !['Similar content', 'Intent: '].includes(result.context)) {
              resultText += `   ${result.context}\n`;
            }
            resultText += '\n';
          });
        }
      });
    }
    
    return {
      content: [{ type: 'text', text: resultText }]
    };
  } catch (error) {
    const errorMsg = `Error getting recommendations: ${error.message}`;
    log('error', errorMsg);
    return {
      content: [{ type: 'error', text: errorMsg }]
    };
  }
});

async function main() {
  try {
    console.log('[AWS Documentation Server] Starting...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('[AWS Documentation Server] Connected');
  } catch (error) {
    console.error('[AWS Documentation Server] Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[AWS Documentation Server] Fatal error:', error);
  process.exit(1);
}); 