/**
 * AWS CDK Stack Analyzer for Cost Analysis
 * Parses CDK stack templates and estimates costs
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateServiceCost, readBedrockPatterns } from './helpers.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Analyze an AWS CDK stack template for cost estimation
 * @param {string} templatePath Path to the CDK stack template JSON file
 * @param {Object} options Analysis options
 * @returns {Promise<Object>} Analysis results
 */
export const analyzeCdkStack = async (templatePath, options = {}) => {
  try {
    // Parse pricing patterns 
    const pricingPatterns = await readBedrockPatterns();
    
    // Read and parse the CDK stack template
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = JSON.parse(templateContent);
    
    // Extract stack name
    const stackName = getStackName(template);
    
    // Extract resources
    const resources = extractResources(template);
    
    // Count resources by type
    const resourceCounts = countResourcesByType(resources);
    
    // Extract services from resource types
    const services = extractServicesFromResources(Object.keys(resourceCounts));
    
    // Calculate service costs
    const costEstimates = calculateAllServiceCosts(services, resources, pricingPatterns, options);
    
    return {
      stackName,
      services,
      resourceCounts,
      costEstimates,
      template: options.includeTemplate ? template : null,
      analysisTimestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error analyzing CDK stack: ${error.message}`);
    return {
      error: error.message,
      success: false
    };
  }
};

/**
 * Extract the stack name from the template
 * @param {Object} template CDK stack template
 * @returns {string} Stack name
 */
const getStackName = (template) => {
  // Try to find the stack name in the template
  if (template.Description && template.Description.includes('Stack')) {
    // Find stack name in description
    const match = template.Description.match(/for (.*?) Stack/);
    if (match) {
      return match[1];
    }
  }
  
  // Fallback to metadata if available
  if (template.Metadata && template.Metadata.StackName) {
    return template.Metadata.StackName;
  }
  
  // Final fallback
  return "Unknown CDK Stack";
};

/**
 * Extract all resources from a CDK stack template
 * @param {Object} template CDK stack template
 * @returns {Object} Extracted resources
 */
const extractResources = (template) => {
  if (!template.Resources) {
    return {};
  }
  
  return template.Resources;
};

/**
 * Count resources by type
 * @param {Object} resources Resources object from template
 * @returns {Object} Resource counts by type
 */
const countResourcesByType = (resources) => {
  const counts = {};
  
  Object.values(resources).forEach(resource => {
    const type = resource.Type;
    
    if (type) {
      counts[type] = (counts[type] || 0) + 1;
    }
  });
  
  return counts;
};

/**
 * Extract AWS service names from resource types
 * @param {Array} resourceTypes Array of resource types
 * @returns {Array} Unique AWS service names
 */
const extractServicesFromResources = (resourceTypes) => {
  const serviceMap = {
    'AWS::Lambda': 'Lambda',
    'AWS::ApiGateway': 'API Gateway',
    'AWS::S3': 'S3',
    'AWS::DynamoDB': 'DynamoDB',
    'AWS::EC2': 'EC2',
    'AWS::IAM': 'IAM',
    'AWS::CloudFront': 'CloudFront',
    'AWS::SNS': 'SNS',
    'AWS::SQS': 'SQS',
    'AWS::RDS': 'RDS',
  };
  
  const services = new Set();
  
  resourceTypes.forEach(type => {
    // Extract the service prefix (up to the "::")
    const servicePrefix = type.split('::').slice(0, 2).join('::');
    
    if (serviceMap[servicePrefix]) {
      services.add(serviceMap[servicePrefix]);
    } else {
      // Try to extract service name from the type
      const serviceName = type.split('::')[1];
      if (serviceName) {
        services.add(serviceName);
      }
    }
  });
  
  return [...services];
};

/**
 * Calculate costs for all services in the stack
 * @param {Array} services List of AWS services
 * @param {Object} resources Resources object from template
 * @param {Object} pricingPatterns Pricing patterns
 * @param {Object} options Analysis options
 * @returns {Object} Cost estimates by service
 */
const calculateAllServiceCosts = (services, resources, pricingPatterns, options) => {
  const costEstimates = {};
  
  services.forEach(service => {
    costEstimates[service] = estimateServiceCost(service, resources, pricingPatterns, options);
  });
  
  return costEstimates;
};

/**
 * Estimate the cost for a specific service
 * @param {string} serviceName Service name
 * @param {Object} resources Resources from the template
 * @param {Object} pricingPatterns Pricing patterns
 * @param {Object} options Analysis options
 * @returns {Object} Cost estimate for the service
 */
const estimateServiceCost = (serviceName, resources, pricingPatterns, options) => {
  // Get service resources
  const serviceResources = getResourcesForService(serviceName, resources);
  
  // Get usage details based on the resources
  const usageDetails = estimateUsageDetails(serviceName, serviceResources, options);
  
  // Calculate service cost with the usage details
  return calculateServiceCost(serviceName, usageDetails, pricingPatterns);
};

/**
 * Filter resources for a specific service
 * @param {string} serviceName Service name
 * @param {Object} resources All resources
 * @returns {Array} Resources for the service
 */
const getResourcesForService = (serviceName, resources) => {
  const serviceResources = [];
  
  // Map service names to resource type patterns
  const servicePatterns = {
    'Lambda': 'AWS::Lambda::',
    'API Gateway': 'AWS::ApiGateway::',
    'S3': 'AWS::S3::',
    'DynamoDB': 'AWS::DynamoDB::',
    'EC2': 'AWS::EC2::',
    'IAM': 'AWS::IAM::',
    'CloudFront': 'AWS::CloudFront::',
    'SNS': 'AWS::SNS::',
    'SQS': 'AWS::SQS::',
    'RDS': 'AWS::RDS::',
  };
  
  const pattern = servicePatterns[serviceName] || `AWS::${serviceName}::`;
  
  // Filter resources by type pattern
  Object.entries(resources).forEach(([resourceId, resource]) => {
    if (resource.Type && resource.Type.startsWith(pattern)) {
      serviceResources.push({
        id: resourceId,
        ...resource
      });
    }
  });
  
  return serviceResources;
};

/**
 * Estimate usage details for a service based on its resources
 * @param {string} serviceName Service name
 * @param {Array} serviceResources Resources for the service
 * @param {Object} options Analysis options
 * @returns {Object} Usage details
 */
const estimateUsageDetails = (serviceName, serviceResources, options) => {
  // Default usage patterns
  let defaultUsage = {
    monthly_average: true,
    avg_monthly_requests: 100000,
    avg_resource_count: serviceResources.length || 1,
    data_transfer_gb: 50,
    storage_gb: 20,
    usage_hours: 720, // 24 * 30 hours in a month
    instance_type: 't3.micro'
  };
  
  // Override defaults with options if provided
  if (options.usageAssumptions && options.usageAssumptions[serviceName]) {
    defaultUsage = {
      ...defaultUsage,
      ...options.usageAssumptions[serviceName]
    };
  }
  
  // Service-specific usage estimates
  switch (serviceName) {
    case 'Lambda':
      return estimateLambdaUsage(serviceResources, defaultUsage);
    case 'S3':
      return estimateS3Usage(serviceResources, defaultUsage);
    case 'DynamoDB':
      return estimateDynamoDBUsage(serviceResources, defaultUsage);
    case 'API Gateway':
      return estimateApiGatewayUsage(serviceResources, defaultUsage);
    case 'EC2':
      return estimateEC2Usage(serviceResources, defaultUsage);
    default:
      return defaultUsage;
  }
};

/**
 * Estimate Lambda usage details
 * @param {Array} resources Lambda resources
 * @param {Object} defaultUsage Default usage assumptions
 * @returns {Object} Lambda usage details
 */
const estimateLambdaUsage = (resources, defaultUsage) => {
  // Start with default usage
  const usage = { ...defaultUsage };
  
  if (resources.length === 0) {
    return usage;
  }
  
  // Try to extract memory size and timeout from resources
  let totalMemory = 0;
  let totalTimeout = 0;
  
  resources.forEach(resource => {
    // Check for properties
    if (resource.Properties) {
      // Memory size
      if (resource.Properties.MemorySize) {
        totalMemory += parseInt(resource.Properties.MemorySize, 10) || 128;
      } else {
        totalMemory += 128; // Default
      }
      
      // Timeout
      if (resource.Properties.Timeout) {
        totalTimeout += parseInt(resource.Properties.Timeout, 10) || 3;
      } else {
        totalTimeout += 3; // Default
      }
    }
  });
  
  // Calculate averages
  usage.avg_memory_size = resources.length > 0 ? Math.round(totalMemory / resources.length) : 128;
  usage.avg_duration_ms = resources.length > 0 ? Math.round((totalTimeout / resources.length) * 500) : 500; // Assuming 50% of max timeout
  
  return usage;
};

/**
 * Estimate S3 usage details
 * @param {Array} resources S3 resources
 * @param {Object} defaultUsage Default usage assumptions
 * @returns {Object} S3 usage details
 */
const estimateS3Usage = (resources, defaultUsage) => {
  // Start with default usage
  const usage = { ...defaultUsage };
  
  // Count buckets
  usage.bucket_count = resources.filter(r => r.Type === 'AWS::S3::Bucket').length || 1;
  
  // Set some reasonable defaults for S3
  usage.storage_gb = usage.bucket_count * defaultUsage.storage_gb;
  usage.monthly_get_requests = defaultUsage.avg_monthly_requests * 0.8; // 80% reads
  usage.monthly_put_requests = defaultUsage.avg_monthly_requests * 0.2; // 20% writes
  
  return usage;
};

/**
 * Estimate DynamoDB usage details
 * @param {Array} resources DynamoDB resources
 * @param {Object} defaultUsage Default usage assumptions
 * @returns {Object} DynamoDB usage details
 */
const estimateDynamoDBUsage = (resources, defaultUsage) => {
  // Start with default usage
  const usage = { ...defaultUsage };
  
  // Count tables
  usage.table_count = resources.filter(r => r.Type === 'AWS::DynamoDB::Table').length || 1;
  
  // Estimate read/write capacity
  let totalReadCapacity = 0;
  let totalWriteCapacity = 0;
  let onDemandTables = 0;
  
  resources.forEach(resource => {
    if (resource.Type === 'AWS::DynamoDB::Table' && resource.Properties) {
      // Check for provisioned capacity
      if (resource.Properties.ProvisionedThroughput) {
        const readCapacity = parseInt(resource.Properties.ProvisionedThroughput.ReadCapacityUnits, 10) || 5;
        const writeCapacity = parseInt(resource.Properties.ProvisionedThroughput.WriteCapacityUnits, 10) || 5;
        
        totalReadCapacity += readCapacity;
        totalWriteCapacity += writeCapacity;
      } else {
        // Assume on-demand
        onDemandTables++;
      }
    }
  });
  
  // Calculate average capacity or set defaults for on-demand
  if (totalReadCapacity > 0 || totalWriteCapacity > 0) {
    usage.provisioned_mode = true;
    usage.read_capacity_units = Math.max(totalReadCapacity, 1);
    usage.write_capacity_units = Math.max(totalWriteCapacity, 1);
  } else {
    usage.provisioned_mode = false;
    usage.monthly_read_request_units = defaultUsage.avg_monthly_requests * 0.8; // 80% reads
    usage.monthly_write_request_units = defaultUsage.avg_monthly_requests * 0.2; // 20% writes
  }
  
  usage.storage_gb = usage.table_count * 1; // Assume 1GB per table as default
  
  return usage;
};

/**
 * Estimate API Gateway usage details
 * @param {Array} resources API Gateway resources
 * @param {Object} defaultUsage Default usage assumptions
 * @returns {Object} API Gateway usage details
 */
const estimateApiGatewayUsage = (resources, defaultUsage) => {
  // Start with default usage
  const usage = { ...defaultUsage };
  
  // Count APIs
  usage.api_count = resources.filter(r => 
    r.Type === 'AWS::ApiGateway::RestApi' || 
    r.Type === 'AWS::ApiGateway::Stage' ||
    r.Type === 'AWS::ApiGatewayV2::Api'
  ).length || 1;
  
  // Set API-specific usage
  usage.monthly_requests = defaultUsage.avg_monthly_requests;
  
  return usage;
};

/**
 * Estimate EC2 usage details
 * @param {Array} resources EC2 resources
 * @param {Object} defaultUsage Default usage assumptions
 * @returns {Object} EC2 usage details
 */
const estimateEC2Usage = (resources, defaultUsage) => {
  // Start with default usage
  const usage = { ...defaultUsage };
  
  // Count instances
  const instances = resources.filter(r => r.Type === 'AWS::EC2::Instance');
  const autoScalingGroups = resources.filter(r => r.Type === 'AWS::AutoScaling::AutoScalingGroup');
  
  let totalInstances = instances.length;
  
  // Count instances in auto scaling groups
  autoScalingGroups.forEach(asg => {
    if (asg.Properties && asg.Properties.MinSize) {
      totalInstances += parseInt(asg.Properties.MinSize, 10) || 1;
    } else {
      totalInstances += 1; // Default minimum size
    }
  });
  
  usage.instance_count = Math.max(totalInstances, 1);
  
  // Try to determine instance types
  let instanceTypes = [];
  
  instances.forEach(instance => {
    if (instance.Properties && instance.Properties.InstanceType) {
      instanceTypes.push(instance.Properties.InstanceType);
    }
  });
  
  // If we found instance types, use the most common one
  if (instanceTypes.length > 0) {
    const typeCounts = {};
    instanceTypes.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
    
    let mostCommonType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    usage.instance_type = mostCommonType;
  }
  
  // Set usage hours (usually 24/7)
  usage.usage_hours = defaultUsage.usage_hours;
  
  return usage;
};

/**
 * Analyze CloudFormation template for cost estimation
 * This is an alias for analyzeCdkStack since CloudFormation templates
 * follow the same format as CDK synthesized templates
 */
export const analyzeCloudFormationTemplate = analyzeCdkStack; 