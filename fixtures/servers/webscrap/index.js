import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name for the current module (ESM compatible approach)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
  console.log('[WebScrap] Loaded configuration from .env file');
} else {
  console.warn('[WebScrap] No .env file found, using environment variables or defaults');
}

// Load configuration from environment variables with defaults
const CONFIG = {
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '15000', 10),
  userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH || '500000', 10),
  useProxy: process.env.USE_PROXY === 'true',
  proxyUrl: process.env.PROXY_URL || '',
  allowImages: process.env.ALLOW_IMAGES !== 'false',
  allowLinks: process.env.ALLOW_LINKS !== 'false'
};

console.log('[WebScrap] Configuration loaded:', CONFIG);

const server = new McpServer({
  name: 'WebScrap',
  version: '1.0.0',
});

/**
 * Extracts clean text content from HTML
 * @param {string} html - HTML content to clean
 * @param {object} options - Configuration options
 * @returns {string} - Clean text content
 */
function extractCleanText(html, options = {}) {
  const $ = cheerio.load(html);
  
  // Remove script, style, and other non-content elements
  $('script, style, noscript, iframe, img, svg, picture, video, audio, canvas, map, object, embed').remove();
  
  // Remove hidden elements
  $('[style*="display:none"], [style*="display: none"], [hidden], [aria-hidden="true"]').remove();
  
  // Extract specific content if selector is provided
  let content;
  if (options.contentSelector) {
    content = $(options.contentSelector).text();
  } else {
    // Otherwise use body or main content elements
    const mainContent = $('main, article, .content, .main, .post, .entry, #content, #main');
    content = mainContent.length > 0 ? mainContent.text() : $('body').text();
  }
  
  // Clean up the text
  return content
    .replace(/\s+/g, ' ') // Remove excess whitespace
    .replace(/\n+/g, '\n') // Normalize line breaks
    .replace(/\t+/g, ' ') // Replace tabs with spaces
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Extract metadata from HTML
 * @param {string} html - HTML content
 * @param {string} url - URL of the page
 * @returns {object} - Page metadata
 */
function extractMetadata(html, url) {
  const $ = cheerio.load(html);
  const metadata = {
    url,
    title: $('title').text().trim() || '',
    description: $('meta[name="description"]').attr('content') || 
                 $('meta[property="og:description"]').attr('content') || '',
    keywords: $('meta[name="keywords"]').attr('content') || '',
    author: $('meta[name="author"]').attr('content') || 
            $('meta[property="article:author"]').attr('content') || 
            $('meta[property="og:author"]').attr('content') || '',
    publishedDate: $('meta[property="article:published_time"]').attr('content') || 
                  $('meta[name="date"]').attr('content') || '',
    siteName: $('meta[property="og:site_name"]').attr('content') || '',
  };
  
  return metadata;
}

/**
 * Extract images from HTML
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Array} - List of image objects with URL and alt text
 */
function extractImages(html, baseUrl) {
  if (!CONFIG.allowImages) {
    return [];
  }
  
  const $ = cheerio.load(html);
  const images = [];
  
  $('img').each((i, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (src) {
      try {
        const imageUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        images.push({
          url: imageUrl,
          alt: $(el).attr('alt') || '',
          title: $(el).attr('title') || ''
        });
      } catch (error) {
        console.warn(`[WebScrap] Invalid image URL: ${src}`);
      }
    }
  });
  
  return images.slice(0, 10); // Limit to 10 images
}

/**
 * Extract links from HTML
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative paths
 * @returns {Array} - List of link objects with URL and text
 */
function extractLinks(html, baseUrl) {
  if (!CONFIG.allowLinks) {
    return [];
  }
  
  const $ = cheerio.load(html);
  const links = [];
  
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
      try {
        const linkUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        links.push({
          url: linkUrl,
          text: $(el).text().trim() || linkUrl
        });
      } catch (error) {
        console.warn(`[WebScrap] Invalid link URL: ${href}`);
      }
    }
  });
  
  // Remove duplicates by URL
  const uniqueLinks = links.filter((link, index, self) => 
    index === self.findIndex((l) => l.url === link.url)
  );
  
  return uniqueLinks.slice(0, 15); // Limit to 15 links
}

/**
 * Format scraped content for MCP response
 */
function formatScrapedContent(metadata, mainContent, images, links, options = {}) {
  let formatted = `# ${metadata.title}\n\n`;
  
  if (metadata.siteName) {
    formatted += `**Source:** ${metadata.siteName}\n`;
  }
  
  if (metadata.description) {
    formatted += `## Description\n${metadata.description}\n\n`;
  }
  
  if (metadata.author) {
    formatted += `**Author:** ${metadata.author}\n`;
  }
  
  if (metadata.publishedDate) {
    formatted += `**Published:** ${metadata.publishedDate}\n\n`;
  }
  
  formatted += `## Main Content\n${mainContent}\n\n`;
  
  if (images.length > 0 && (options.includeImages !== false)) {
    formatted += `## Images (${images.length})\n`;
    images.forEach((img, i) => {
      formatted += `${i+1}. ${img.url}${img.alt ? ` - "${img.alt}"` : ''}\n`;
    });
    formatted += '\n';
  }
  
  if (links.length > 0 && (options.includeLinks !== false)) {
    formatted += `## Links (${links.length})\n`;
    links.forEach((link, i) => {
      formatted += `${i+1}. [${link.text || link.url}](${link.url})\n`;
    });
  }
  
  return formatted;
}

/**
 * Creates axios instance with appropriate configuration
 */
function createAxiosInstance(customOptions = {}) {
  const options = {
    headers: {
      'User-Agent': CONFIG.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: CONFIG.requestTimeout,
    maxContentLength: CONFIG.maxContentLength,
    ...customOptions
  };
  
  // Add proxy if configured
  if (CONFIG.useProxy && CONFIG.proxyUrl) {
    options.proxy = {
      host: CONFIG.proxyUrl
    };
  }
  
  return axios.create(options);
}

/**
 * Main scraping function
 * @param {string} url - URL to scrape
 * @param {object} options - Scraping options
 */
async function scrapeUrl(url, options = {}) {
  console.log(`[WebScrap] Scraping URL: ${url}`);
  
  try {
    // Create axios instance with appropriate configuration
    const axiosInstance = createAxiosInstance();
    
    // Make HTTP request
    const response = await axiosInstance.get(url);
    const html = response.data;
    
    // Check for empty content
    if (!html || html.trim().length === 0) {
      return {
        content: [{ type: 'text', text: `Error: Empty content returned from ${url}` }]
      };
    }
    
    // Extract various components
    const metadata = extractMetadata(html, url);
    const mainContent = extractCleanText(html, options);
    const images = options.includeImages !== false ? extractImages(html, url) : [];
    const links = options.includeLinks !== false ? extractLinks(html, url) : [];
    
    // Format results
    const formattedContent = formatScrapedContent(metadata, mainContent, images, links, options);
    
    return {
      content: [{ type: 'text', text: formattedContent }]
    };
  } catch (error) {
    console.error(`[WebScrap] Error scraping ${url}: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error scraping URL ${url}: ${error.message}. ${
          error.response ? `Status code: ${error.response.status}` : ''
        }`
      }]
    };
  }
}

// Register the basic scrape tool
server.tool('scrape_url', { 
  url: z.string().url(),
  selector: z.string().optional(),
  include_images: z.boolean().optional(),
  include_links: z.boolean().optional()
}, async ({ url, selector, include_images, include_links }) => {
  console.log(`[WebScrap] Received scrape_url request for: ${url}`);
  const options = {
    contentSelector: selector,
    includeImages: include_images,
    includeLinks: include_links
  };
  
  return await scrapeUrl(url, options);
});

// Register an article extraction tool optimized for articles and blog posts
server.tool('extract_article', { 
  url: z.string().url()
}, async ({ url }) => {
  console.log(`[WebScrap] Extracting article from: ${url}`);
  
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Try to find the article content using common selectors
    const articleSelectors = [
      'article', 
      '[itemprop="articleBody"]',
      '.post-content', 
      '.entry-content',
      '.article-content',
      '.content-article',
      '.article-body',
      '.story-body',
      '#article-body',
      '.post-body'
    ];
    
    let articleContent = '';
    let usedSelector = '';
    
    // Try each selector until we find content
    for (const selector of articleSelectors) {
      const content = $(selector).text().trim();
      if (content && content.length > 100) { // Assume valid article has at least 100 chars
        articleContent = content;
        usedSelector = selector;
        break;
      }
    }
    
    console.log(`[WebScrap] Article selector found: ${usedSelector || 'none'}`);
    
    // If no content found with specific selectors, fall back to generic extraction
    if (!articleContent) {
      return await scrapeUrl(url, { articleMode: true });
    }
    
    // Clean up the text
    articleContent = articleContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    // Get metadata
    const metadata = extractMetadata(html, url);
    
    // Format the article
    let formattedArticle = `# ${metadata.title}\n\n`;
    
    if (metadata.siteName) {
      formattedArticle += `**Source:** ${metadata.siteName}\n`;
    }
    
    if (metadata.author) {
      formattedArticle += `**Author:** ${metadata.author}\n`;
    }
    
    if (metadata.publishedDate) {
      formattedArticle += `**Published:** ${metadata.publishedDate}\n\n`;
    }
    
    formattedArticle += `## Article Content\n${articleContent}\n`;
    
    return {
      content: [{ type: 'text', text: formattedArticle }]
    };
  } catch (error) {
    console.error(`[WebScrap] Error extracting article from ${url}: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error extracting article from ${url}: ${error.message}`
      }]
    };
  }
});

// Tool to get just text content (no images, links, or metadata)
server.tool('get_text_content', { 
  url: z.string().url()
}, async ({ url }) => {
  console.log(`[WebScrap] Getting text content from: ${url}`);
  
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.get(url);
    const html = response.data;
    const cleanText = extractCleanText(html);
    
    return {
      content: [{ type: 'text', text: cleanText }]
    };
  } catch (error) {
    console.error(`[WebScrap] Error getting text from ${url}: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error getting text from ${url}: ${error.message}`
      }]
    };
  }
});

// Add a new tool to capture element data by selector
server.tool('get_elements', { 
  url: z.string().url(),
  selector: z.string(),
  limit: z.number().optional()
}, async ({ url, selector, limit = 10 }) => {
  console.log(`[WebScrap] Getting elements with selector "${selector}" from: ${url}`);
  
  try {
    const axiosInstance = createAxiosInstance();
    const response = await axiosInstance.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    
    const elements = [];
    $(selector).each((i, el) => {
      if (i >= limit) return false;
      
      const $el = $(el);
      elements.push({
        text: $el.text().trim(),
        html: $el.html(),
        outerHTML: $.html(el),
        attributes: Object.fromEntries(
          [...el.attributes].map(attr => [attr.name, attr.value])
        )
      });
    });
    
    if (elements.length === 0) {
      return {
        content: [{ 
          type: 'text', 
          text: `No elements found matching selector "${selector}" on ${url}`
        }]
      };
    }
    
    let formattedElements = `# Elements matching "${selector}" on ${url}\n\n`;
    formattedElements += `Found ${elements.length} matching element(s):\n\n`;
    
    elements.forEach((element, i) => {
      formattedElements += `## Element ${i+1}\n`;
      formattedElements += `Text: ${element.text}\n\n`;
      
      if (Object.keys(element.attributes).length > 0) {
        formattedElements += `Attributes:\n`;
        for (const [name, value] of Object.entries(element.attributes)) {
          formattedElements += `- ${name}: ${value}\n`;
        }
        formattedElements += '\n';
      }
    });
    
    return {
      content: [{ type: 'text', text: formattedElements }]
    };
  } catch (error) {
    console.error(`[WebScrap] Error getting elements from ${url}: ${error.message}`);
    return {
      content: [{ 
        type: 'text', 
        text: `Error getting elements from ${url}: ${error.message}`
      }]
    };
  }
});

async function main() {
  try {
    console.log("[WebScrap Server] Starting...");
  const transport = new StdioServerTransport();
  await server.connect(transport);
    console.log("[WebScrap Server] Connected");
  } catch (error) {
    console.error("[WebScrap Server] Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[WebScrap Server] Fatal error:", error);
  process.exit(1);
}); 