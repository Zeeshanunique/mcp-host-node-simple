/**
 * Data models for AWS Documentation MCP Server.
 */

import { z } from 'zod';

// Search result from AWS documentation search
export const SearchResultSchema = z.object({
  rankOrder: z.number().int(),
  url: z.string().url(),
  title: z.string(),
  context: z.string().optional()
});

// Recommendation result from AWS documentation
export const RecommendationResultSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  context: z.string().optional()
});

export class SearchResult {
  constructor(rankOrder, url, title, context = null) {
    this.rankOrder = rankOrder;
    this.url = url;
    this.title = title;
    this.context = context;
  }
}

export class RecommendationResult {
  constructor(url, title, context = null) {
    this.url = url;
    this.title = title;
    this.context = context;
  }
} 