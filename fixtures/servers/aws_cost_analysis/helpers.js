/**
 * Helper functions for AWS cost analysis
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Default pricing patterns for AWS services
 */
const DEFAULT_BEDROCK_PATTERNS = [
  {
    service: "Lambda",
    pricing_factors: ["Requests count", "Duration", "Memory allocation"],
    estimated_cost: "$0.20 per 1M requests + $0.0000166667 per GB-second",
    free_tier_eligible: true,
    free_tier_limit: "1M requests + 400k GB-seconds per month"
  },
  {
    service: "S3",
    pricing_factors: ["Storage", "Requests", "Data transfer"],
    estimated_cost: "$0.023 per GB for first 50TB/month",
    free_tier_eligible: true,
    free_tier_limit: "5GB storage + 20,000 GET requests"
  },
  {
    service: "DynamoDB",
    pricing_factors: ["RCU/WCU", "Storage", "Data transfer"],
    estimated_cost: "$1.25 per million write requests + $0.25 per million read requests",
    free_tier_eligible: true,
    free_tier_limit: "25 WCU + 25 RCU + 25GB storage"
  },
  {
    service: "API Gateway",
    pricing_factors: ["API calls", "Data transfer"],
    estimated_cost: "$3.50 per million API calls",
    free_tier_eligible: true,
    free_tier_limit: "1M API calls per month"
  },
  {
    service: "EC2",
    pricing_factors: ["Instance type", "Running hours", "EBS volume", "Data transfer"],
    estimated_cost: "Varies by instance type, starting around $0.0116 per hour for t3.micro",
    free_tier_eligible: true,
    free_tier_limit: "750 hours of t2.micro/t3.micro per month"
  }
];

/**
 * Read the Bedrock pricing patterns from patterns.json or use defaults
 * @returns {Promise<Array>} Bedrock pricing patterns
 */
export const readBedrockPatterns = async () => {
  try {
    const patternsPath = path.join(__dirname, 'patterns.json');
    const fileContent = await fs.readFile(patternsPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.warn(`Warning: Could not read patterns.json. Using default patterns. Error: ${error.message}`);
    return DEFAULT_BEDROCK_PATTERNS;
  }
};

/**
 * Load a template file from the templates directory
 * @param {string} templateName Name of the template file
 * @returns {Promise<string>} Template content
 */
export const loadTemplate = async (templateName) => {
  try {
    const templatePath = path.join(__dirname, 'templates', templateName);
    return await fs.readFile(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error loading template ${templateName}: ${error.message}`);
    throw new Error(`Failed to load template: ${error.message}`);
  }
};

/**
 * Save content to a file
 * @param {string} filePath Path to save the file
 * @param {string} content Content to save
 * @returns {Promise<string>} Path to the saved file
 */
export const saveToFile = async (filePath, content) => {
  try {
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    
    // Write the content to the file
    await fs.writeFile(filePath, content, 'utf8');
    
    return filePath;
  } catch (error) {
    console.error(`Error saving file to ${filePath}: ${error.message}`);
    throw new Error(`Failed to save file: ${error.message}`);
  }
};

/**
 * Format a cost value with currency symbol
 * @param {number|string} value Cost value
 * @param {boolean} includeRange Whether to include a range
 * @returns {string} Formatted cost
 */
export const formatCost = (value, includeRange = false) => {
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value !== 'number') {
    return 'Varies based on usage';
  }
  
  const formattedValue = `$${value.toFixed(2)}`;
  
  if (includeRange && value > 0) {
    const lowerRange = value * 0.8;
    const upperRange = value * 1.2;
    return `$${lowerRange.toFixed(2)} - $${upperRange.toFixed(2)}`;
  }
  
  return formattedValue;
};

/**
 * Convert data sizes to a consistent format
 * @param {number} bytes Size in bytes
 * @returns {string} Formatted size
 */
export const formatDataSize = (bytes) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
};

/**
 * Generate a unique timestamp-based ID
 * @returns {string} Unique ID
 */
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

/**
 * Validate AWS credentials are available
 * @returns {Promise<boolean>} Whether credentials are available
 */
export const validateAwsCredentials = async () => {
  // Check for AWS_PROFILE or AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
  return !!(
    process.env.AWS_PROFILE || 
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  );
};

/**
 * Calculate projected growth in costs over time
 * @param {number} baseCost Initial cost
 * @param {number} growthRate Annual growth rate
 * @param {number} years Number of years to project
 * @returns {Array} Yearly projected costs
 */
export const calculateGrowthProjection = (baseCost, growthRate, years = 3) => {
  const projections = [];
  let currentCost = baseCost;
  
  for (let i = 0; i < years; i++) {
    projections.push({
      year: i + 1,
      monthly: currentCost,
      annually: currentCost * 12
    });
    
    currentCost *= (1 + growthRate);
  }
  
  return projections;
};

/**
 * Calculate the cost breakdown for a given service
 * @param {Object} serviceDetails Service usage details
 * @returns {Object} Cost breakdown
 */
export const calculateServiceCost = (serviceDetails) => {
  // This would normally contain detailed AWS pricing logic
  // For now, we'll use a simplified approach
  
  const { service, usage } = serviceDetails;
  let monthlyCost = 0;
  const breakdown = [];
  
  switch (service) {
    case 'Lambda':
      {
        const requests = usage.requests || 1000000;
        const avgDuration = usage.duration || 100; // ms
        const memory = usage.memory || 128; // MB
        
        // Convert to GB-seconds
        const gbSeconds = (requests * avgDuration * memory) / (1000 * 1024);
        
        // $0.20 per 1M requests + $0.0000166667 per GB-second
        const requestCost = (requests / 1000000) * 0.20;
        const computeCost = gbSeconds * 0.0000166667;
        
        monthlyCost = requestCost + computeCost;
        
        breakdown.push(
          { component: 'Requests', cost: requestCost, details: `${requests.toLocaleString()} requests` },
          { component: 'Compute', cost: computeCost, details: `${gbSeconds.toFixed(2)} GB-seconds` }
        );
      }
      break;
      
    case 'S3':
      {
        const storage = usage.storage || 100; // GB
        const requests = usage.requests || 100000;
        
        // $0.023 per GB for first 50TB + $0.005 per 1000 PUT/POST/DELETE requests + $0.0004 per 1000 GET requests
        const storageCost = storage * 0.023;
        const requestCost = (requests / 1000) * 0.0004;
        
        monthlyCost = storageCost + requestCost;
        
        breakdown.push(
          { component: 'Storage', cost: storageCost, details: `${storage} GB` },
          { component: 'Requests', cost: requestCost, details: `${requests.toLocaleString()} requests` }
        );
      }
      break;
      
    // Add more services as needed
    
    default:
      monthlyCost = usage.estimated || 10;
      breakdown.push({ component: 'Base usage', cost: monthlyCost, details: 'Estimated usage' });
  }
  
  return {
    service,
    monthly_cost: monthlyCost,
    annual_cost: monthlyCost * 12,
    breakdown
  };
}; 