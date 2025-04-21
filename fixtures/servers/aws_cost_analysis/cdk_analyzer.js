/**
 * AWS CDK stack analyzer for cost estimation
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readBedrockPatterns } from './helpers.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Resource types and their corresponding AWS services
 */
const RESOURCE_SERVICES_MAP = {
  'AWS::Lambda::Function': 'Lambda',
  'AWS::S3::Bucket': 'S3',
  'AWS::DynamoDB::Table': 'DynamoDB',
  'AWS::SQS::Queue': 'SQS',
  'AWS::SNS::Topic': 'SNS',
  'AWS::ApiGateway::RestApi': 'API Gateway',
  'AWS::ApiGatewayV2::Api': 'API Gateway v2',
  'AWS::CloudFront::Distribution': 'CloudFront',
  'AWS::EC2::Instance': 'EC2',
  'AWS::RDS::DBInstance': 'RDS',
  'AWS::ElasticLoadBalancingV2::LoadBalancer': 'ELB',
  'AWS::ElastiCache::CacheCluster': 'ElastiCache',
  'AWS::Elasticsearch::Domain': 'Elasticsearch',
  'AWS::Kinesis::Stream': 'Kinesis',
  'AWS::Cognito::UserPool': 'Cognito',
};

/**
 * Analyzes a CDK stack to identify AWS services and estimate costs
 * @param {Object} params Parameters for stack analysis
 * @returns {Promise<Object>} Analysis result
 */
export const analyzeCdkStack = async (params) => {
  try {
    const stackPath = params.stack_path;
    const detailedAnalysis = params.detailed_analysis || false;
    
    if (!stackPath) {
      return {
        status: "error",
        message: "No stack path provided"
      };
    }
    
    // Read the stack file
    const stackContent = await fs.readFile(stackPath, 'utf8');
    
    // Extract services used in the stack
    const servicesUsed = extractServicesFromStack(stackContent);
    
    // Get resource counts
    const resourceCounts = countResourcesByType(stackContent);
    
    // Generate cost estimates if detailed analysis is requested
    let costEstimates = {};
    if (detailedAnalysis) {
      costEstimates = await generateCostEstimates(servicesUsed, resourceCounts, params);
    }
    
    return {
      status: "success",
      services_used: servicesUsed,
      resource_counts: resourceCounts,
      cost_estimates: costEstimates,
      stack_path: stackPath
    };
  } catch (error) {
    console.error(`Error analyzing CDK stack: ${error.message}`);
    return {
      status: "error",
      message: `Failed to analyze CDK stack: ${error.message}`
    };
  }
};

/**
 * Extract services used in a stack based on resource types
 * @param {string} stackContent Stack file content
 * @returns {Array} List of AWS services used in the stack
 */
const extractServicesFromStack = (stackContent) => {
  const servicesUsed = new Set();
  
  for (const resourceType in RESOURCE_SERVICES_MAP) {
    if (stackContent.includes(resourceType)) {
      servicesUsed.add(RESOURCE_SERVICES_MAP[resourceType]);
    }
  }
  
  // Also check for direct service names
  const directServiceMatches = Object.values(RESOURCE_SERVICES_MAP)
    .filter(service => stackContent.includes(service));
  
  directServiceMatches.forEach(service => servicesUsed.add(service));
  
  return Array.from(servicesUsed);
};

/**
 * Count resources by type in a stack
 * @param {string} stackContent Stack file content
 * @returns {Object} Map of resource types to counts
 */
const countResourcesByType = (stackContent) => {
  const resourceCounts = {};
  
  for (const resourceType in RESOURCE_SERVICES_MAP) {
    const regex = new RegExp(resourceType, 'g');
    const matches = stackContent.match(regex);
    
    if (matches) {
      resourceCounts[resourceType] = matches.length;
    }
  }
  
  return resourceCounts;
};

/**
 * Generate cost estimates for services in a stack
 * @param {Array} servicesUsed Services used in the stack
 * @param {Object} resourceCounts Resource counts by type
 * @param {Object} params Additional parameters
 * @returns {Promise<Object>} Cost estimates by service
 */
const generateCostEstimates = async (servicesUsed, resourceCounts, params) => {
  const costEstimates = {};
  const region = params.region || 'us-east-1';
  const bedrockPatterns = await readBedrockPatterns();
  
  for (const service of servicesUsed) {
    // If we have Bedrock patterns, use them to generate cost estimates
    if (bedrockPatterns) {
      const servicePattern = bedrockPatterns.find(p => 
        p.service && p.service.toLowerCase() === service.toLowerCase()
      );
      
      if (servicePattern) {
        costEstimates[service] = {
          estimated_monthly_cost: servicePattern.estimated_cost || "Varies based on usage",
          pricing_factors: servicePattern.pricing_factors || [],
          free_tier_eligible: servicePattern.free_tier_eligible || false
        };
        continue;
      }
    }
    
    // Default estimates when no pattern is found
    costEstimates[service] = generateDefaultEstimate(service, resourceCounts, region);
  }
  
  return costEstimates;
};

/**
 * Generate a default cost estimate for a service
 * @param {string} service AWS service name
 * @param {Object} resourceCounts Resource counts by type
 * @param {string} region AWS region
 * @returns {Object} Default cost estimate
 */
const generateDefaultEstimate = (service, resourceCounts, region) => {
  const freeTierServices = ['Lambda', 'S3', 'DynamoDB', 'SQS', 'SNS', 'CloudFront'];
  const highCostServices = ['RDS', 'EC2', 'ElastiCache', 'Elasticsearch'];
  
  // Find the resource count for this service
  const resourceType = Object.keys(RESOURCE_SERVICES_MAP).find(
    type => RESOURCE_SERVICES_MAP[type] === service
  );
  
  const count = resourceCounts[resourceType] || 1;
  
  // Generate default pricing factors
  const pricingFactors = [];
  
  switch (service) {
    case 'Lambda':
      pricingFactors.push('Number of invocations', 'Duration', 'Memory allocation');
      break;
    case 'S3':
      pricingFactors.push('Storage amount', 'Number of requests', 'Data transfer');
      break;
    case 'DynamoDB':
      pricingFactors.push('Read/write capacity units', 'Storage amount', 'Data transfer');
      break;
    case 'EC2':
      pricingFactors.push('Instance type', 'Running hours', 'Data transfer', 'Storage');
      break;
    case 'RDS':
      pricingFactors.push('Instance type', 'Running hours', 'Storage', 'Multi-AZ deployment');
      break;
    default:
      pricingFactors.push('Resources provisioned', 'Usage volume', 'Data transfer');
  }
  
  // Determine if the service is free tier eligible
  const freeTierEligible = freeTierServices.includes(service);
  
  // Generate a rough cost estimate based on service type
  let costEstimate = "Varies based on usage";
  if (highCostServices.includes(service)) {
    costEstimate = `$${(50 * count).toFixed(2)} - $${(200 * count).toFixed(2)} per month`;
  } else if (freeTierEligible) {
    costEstimate = count > 1 
      ? `$${(5 * count).toFixed(2)} - $${(30 * count).toFixed(2)} per month (may be free tier eligible)`
      : "May be covered by free tier";
  } else {
    costEstimate = `$${(10 * count).toFixed(2)} - $${(50 * count).toFixed(2)} per month`;
  }
  
  return {
    estimated_monthly_cost: costEstimate,
    pricing_factors: pricingFactors,
    free_tier_eligible: freeTierEligible
  };
}; 