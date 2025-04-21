/**
 * Utility functions for AWS Documentation MCP Server.
 */

import cheerio from 'cheerio';
import { convert } from 'html-to-markdown';
import { RecommendationResult } from './models.js';

/**
 * Extract and convert HTML content to Markdown format.
 * 
 * @param {string} html Raw HTML content to process
 * @returns {string} Simplified markdown version of the content
 */
export function extractContentFromHtml(html) {
  if (!html) {
    return '<e>Empty HTML content</e>';
  }

  try {
    // Parse HTML with cheerio (equivalent to BeautifulSoup)
    const $ = cheerio.load(html);
    
    // Try to find the main content area
    let mainContent = null;
    
    // Common content container selectors for AWS documentation
    const contentSelectors = [
      'main',
      'article',
      '#main-content',
      '.main-content',
      '#content',
      '.content',
      "div[role='main']",
      '#awsdocs-content',
      '.awsui-article',
    ];
    
    // Try to find the main content using common selectors
    for (const selector of contentSelectors) {
      const content = $(selector);
      if (content.length > 0) {
        mainContent = content;
        break;
      }
    }
    
    // If no main content found, use the body
    if (!mainContent) {
      mainContent = $('body').length > 0 ? $('body') : $;
    }
    
    // Remove navigation elements that might be in the main content
    const navSelectors = [
      'noscript',
      '.prev-next',
      '#main-col-footer',
      '.awsdocs-page-utilities',
      '#quick-feedback-yes',
      '#quick-feedback-no',
      '.page-loading-indicator',
      '#tools-panel',
      '.doc-cookie-banner',
      'awsdocs-copyright',
      'awsdocs-thumb-feedback',
    ];
    
    for (const selector of navSelectors) {
      mainContent.find(selector).remove();
    }
    
    // Remove tags we don't want in the output
    const tagsToStrip = [
      'script',
      'style',
      'noscript',
      'meta',
      'link',
      'footer',
      'nav',
      'aside',
      'header',
      // AWS documentation specific elements
      'awsdocs-cookie-consent-container',
      'awsdocs-feedback-container',
      'awsdocs-page-header',
      'awsdocs-page-header-container',
      'awsdocs-filter-selector',
      'awsdocs-breadcrumb-container',
      'awsdocs-page-footer',
      'awsdocs-page-footer-container',
      'awsdocs-footer',
      'awsdocs-cookie-banner',
    ];
    
    for (const tag of tagsToStrip) {
      mainContent.find(tag).remove();
    }
    
    // Convert the cleaned HTML to markdown
    const content = convert(mainContent.html(), {
      // Convert headings using # format
      headingStyle: 'atx',
      // Automatically create links
      linkReferenceStyle: 'full',
    });
    
    if (!content) {
      return '<e>Page failed to be simplified from HTML</e>';
    }
    
    return content;
  } catch (e) {
    return `<e>Error converting HTML to Markdown: ${e.message}</e>`;
  }
}

/**
 * Determine if content is HTML.
 * 
 * @param {string} pageRaw Raw page content 
 * @param {string} contentType Content-Type header
 * @returns {boolean} True if content is HTML, False otherwise
 */
export function isHtmlContent(pageRaw, contentType) {
  return pageRaw.substring(0, 100).includes('<html') || 
         contentType.includes('text/html') || 
         !contentType;
}

/**
 * Format documentation result with pagination information.
 * 
 * @param {string} url Documentation URL
 * @param {string} content Content to format
 * @param {number} startIndex Start index for pagination
 * @param {number} maxLength Maximum content length
 * @returns {string} Formatted documentation result
 */
export function formatDocumentationResult(url, content, startIndex, maxLength) {
  const originalLength = content.length;
  
  if (startIndex >= originalLength) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }
  
  // Calculate the end index, ensuring we don't go beyond the content length
  const endIndex = Math.min(startIndex + maxLength, originalLength);
  const truncatedContent = content.substring(startIndex, endIndex);
  
  if (!truncatedContent) {
    return `AWS Documentation from ${url}:\n\n<e>No more content available.</e>`;
  }
  
  const actualContentLength = truncatedContent.length;
  const remainingContent = originalLength - (startIndex + actualContentLength);
  
  let result = `AWS Documentation from ${url}:\n\n${truncatedContent}`;
  
  // Only add the prompt to continue fetching if there is still remaining content
  if (remainingContent > 0) {
    const nextStart = startIndex + actualContentLength;
    result += `\n\n<e>Content truncated. Call the read_documentation tool with start_index=${nextStart} to get more content.</e>`;
  }
  
  return result;
}

/**
 * Parse recommendation API response into RecommendationResult objects.
 * 
 * @param {Object} data Raw API response data
 * @returns {RecommendationResult[]} List of recommendation results
 */
export function parseRecommendationResults(data) {
  const results = [];
  
  // Process highly rated recommendations
  if (data.highlyRated && data.highlyRated.items) {
    for (const item of data.highlyRated.items) {
      const context = item.abstract || null;
      results.push(
        new RecommendationResult(
          item.url || '', 
          item.assetTitle || '', 
          context
        )
      );
    }
  }
  
  // Process journey recommendations (organized by intent)
  if (data.journey && data.journey.items) {
    for (const intentGroup of data.journey.items) {
      const intent = intentGroup.intent || '';
      if (intentGroup.urls) {
        for (const urlItem of intentGroup.urls) {
          // Add intent as part of the context
          const context = intent ? `Intent: ${intent}` : null;
          results.push(
            new RecommendationResult(
              urlItem.url || '', 
              urlItem.assetTitle || '', 
              context
            )
          );
        }
      }
    }
  }
  
  // Process new content recommendations
  if (data.new && data.new.items) {
    for (const item of data.new.items) {
      // Add "New content" label to context
      const dateCreated = item.dateCreated || '';
      const context = dateCreated ? 
        `New content added on ${dateCreated}` : 
        'New content';
      
      results.push(
        new RecommendationResult(
          item.url || '', 
          item.assetTitle || '', 
          context
        )
      );
    }
  }
  
  // Process similar recommendations
  if (data.similar && data.similar.items) {
    for (const item of data.similar.items) {
      const context = item.abstract || 'Similar content';
      results.push(
        new RecommendationResult(
          item.url || '', 
          item.assetTitle || '', 
          context
        )
      );
    }
  }
  
  return results;
} 