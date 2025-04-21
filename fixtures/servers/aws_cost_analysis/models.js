/**
 * Data models for AWS Cost Analysis MCP Server.
 */

import { z } from 'zod';

// CostAnalysisResult schema
export const CostAnalysisResultSchema = z.object({
  status: z.string(),
  service_name: z.string(),
  data: z.any(),
  message: z.string().optional(),
});

// CDK analysis result schema
export const CDKAnalysisResultSchema = z.object({
  status: z.string(),
  services: z.array(z.any()),
  message: z.string().optional(),
  details: z.any().optional(),
});

// Detailed cost data schema
export const DetailedCostDataSchema = z.object({
  services: z.record(z.object({
    usage: z.string().optional(),
    estimated_cost: z.string().optional(),
    free_tier_info: z.string().optional(),
    unit_pricing: z.record(z.string()).optional(),
    usage_quantities: z.record(z.string()).optional(),
    calculation_details: z.string().optional(),
  })),
});

// Recommendations schema
export const RecommendationsSchema = z.object({
  immediate: z.array(z.string()).optional(),
  best_practices: z.array(z.string()).optional(),
});

// Cost report parameters schema
export const CostReportParamsSchema = z.object({
  pricing_data: z.any(), // Raw pricing data
  service_name: z.string(),
  related_services: z.array(z.string()).optional(),
  pricing_model: z.string().optional().default('ON DEMAND'),
  assumptions: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  output_file: z.string().optional(),
  format: z.string().optional().default('markdown'),
  detailed_cost_data: z.any().optional(),
  recommendations: z.any().optional(),
}); 