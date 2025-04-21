/**
 * AWS Architecture Cost Comparison Module
 * 
 * Compares cost metrics between different architecture approaches (serverless, containers, EC2)
 */

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('./cdk_analyzer');
const { formatCurrency } = require('./helpers');

/**
 * Compares costs between different architecture approaches
 * @param {Object} options Configuration options
 * @param {Array<string>} options.templatePaths Paths to the templates to compare 
 * @param {Array<string>} options.architectureNames Names of the architectures (e.g., "Serverless", "Containers", "EC2")
 * @param {Object} options.comparisonMetrics Additional metrics to compare
 * @returns {Object} Comparison results
 */
async function compareArchitectures(options) {
  const { 
    templatePaths = [],
    architectureNames = [],
    comparisonMetrics = {}
  } = options;

  if (!templatePaths || templatePaths.length === 0) {
    return {
      error: true,
      message: "No template paths provided for comparison"
    };
  }

  // Use provided architecture names or generate default ones
  const names = architectureNames.length === templatePaths.length 
    ? architectureNames 
    : templatePaths.map((_, i) => `Architecture ${i+1}`);

  try {
    // Analyze each architecture template
    const analysisPromises = templatePaths.map(templatePath => 
      analyzeCdkStack(templatePath, { 
        detailed: true,
        includeRecommendations: true 
      })
    );

    const analysisResults = await Promise.all(analysisPromises);
    
    // Build comparison data
    const stacks = names.map((name, i) => ({
      name,
      templatePath: templatePaths[i],
      analysis: analysisResults[i]
    }));

    // Calculate comparison metrics if provided
    const metricsResult = calculateComparisonMetrics(stacks, comparisonMetrics);

    // Generate a conclusion based on the analysis
    const conclusion = generateComparison(stacks);

    return {
      stacks,
      comparisonMetrics: metricsResult,
      conclusion,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      error: true,
      message: "Error comparing architectures",
      details: error.message
    };
  }
}

/**
 * Calculate additional comparison metrics between architectures
 * @param {Array} stacks Stack analysis results
 * @param {Object} metrics Metrics to calculate
 * @returns {Array} Calculated metrics
 */
function calculateComparisonMetrics(stacks, metrics = {}) {
  // Default metrics if none provided
  const defaultMetrics = [
    {
      name: "Initial Setup Cost",
      description: "Estimated cost for the first month of operation",
      calculate: (stack) => stack.analysis.estimatedCost.monthlyCost * 1.2 // 20% higher for initial setup
    },
    {
      name: "Operational Cost (3 Years)",
      description: "Estimated operational cost over a 3-year period",
      calculate: (stack) => stack.analysis.estimatedCost.monthlyCost * 36
    },
    {
      name: "Cost Per Million Requests",
      description: "Estimated cost per million API requests",
      calculate: (stack) => {
        // Simplified calculation based on service types
        const apiServices = ['ApiGateway', 'Lambda', 'ELB', 'EC2'];
        const relevantCosts = stack.analysis.serviceCosts
          .filter(s => apiServices.some(api => s.service.includes(api)))
          .reduce((sum, service) => sum + service.monthlyCost, 0);
        
        // Assume a baseline of 100M requests per month for the calculated costs
        return (relevantCosts / 100);
      }
    },
    {
      name: "Cost Efficiency Score",
      description: "Relative score (1-10) based on features vs. cost",
      calculate: (stack) => {
        const resourceTypes = Object.keys(stack.analysis.resourceCounts || {}).length;
        const monthlyCost = stack.analysis.estimatedCost.monthlyCost;
        
        // More resource types with lower cost = better efficiency
        return Math.round((resourceTypes / Math.max(monthlyCost, 1)) * 5);
      }
    },
    {
      name: "Scaling Cost Factor",
      description: "Estimated cost increase when scaling to 10x load",
      calculate: (stack) => {
        // Different architectures scale differently
        const scalingFactors = {
          Serverless: 7.5, // Serverless scales almost linearly
          Containers: 8.5, // Containers have some economies of scale
          EC2: 9.5 // EC2 has less efficient scaling
        };
        
        // Default scaling factor if architecture name isn't recognized
        const factor = scalingFactors[stack.name] || 8.5;
        
        return stack.analysis.estimatedCost.monthlyCost * factor;
      }
    }
  ];
  
  // Use provided metrics or default metrics
  const metricsToCalculate = Object.keys(metrics).length > 0 
    ? Object.entries(metrics).map(([name, metric]) => ({
        name,
        description: metric.description || name,
        calculate: metric.calculate || (() => 0)
      }))
    : defaultMetrics;
  
  // Calculate each metric for each stack
  return metricsToCalculate.map(metric => {
    const result = {
      name: metric.name,
      description: metric.description
    };
    
    // Calculate this metric for each stack
    stacks.forEach(stack => {
      result[stack.name] = metric.calculate(stack);
    });
    
    return result;
  });
}

/**
 * Generate a comparison conclusion based on the analysis
 * @param {Array} stacks Analyzed stacks
 * @returns {string} Conclusion text
 */
function generateComparison(stacks) {
  // Find the lowest cost architecture
  const lowestCostStack = stacks.reduce((lowest, current) => 
    (current.analysis.estimatedCost.monthlyCost < lowest.analysis.estimatedCost.monthlyCost) 
      ? current 
      : lowest, 
    stacks[0]
  );
  
  // Find architecture with most resources/services
  const mostResourcesStack = stacks.reduce((most, current) => {
    const currentCount = Object.values(current.analysis.resourceCounts || {})
      .reduce((sum, count) => sum + count, 0);
    const mostCount = Object.values(most.analysis.resourceCounts || {})
      .reduce((sum, count) => sum + count, 0);
    
    return (currentCount > mostCount) ? current : most;
  }, stacks[0]);
  
  // Find architecture with most services
  const mostServicesStack = stacks.reduce((most, current) => 
    (current.analysis.serviceCosts.length > most.analysis.serviceCosts.length) 
      ? current 
      : most, 
    stacks[0]
  );
  
  // Generate conclusion text
  let conclusion = `Based on the cost analysis, the ${lowestCostStack.name} architecture offers the lowest estimated monthly cost at $${formatCurrency(lowestCostStack.analysis.estimatedCost.monthlyCost)}. `;
  
  if (mostResourcesStack.name !== lowestCostStack.name) {
    conclusion += `The ${mostResourcesStack.name} architecture provides the most comprehensive resource utilization. `;
  }
  
  if (mostServicesStack.name !== lowestCostStack.name && mostServicesStack.name !== mostResourcesStack.name) {
    conclusion += `The ${mostServicesStack.name} architecture leverages the widest range of AWS services. `;
  }
  
  // Add general recommendation
  conclusion += `\n\nFor cost-sensitive deployments, the ${lowestCostStack.name} architecture is recommended. `;
  
  // Add scaling considerations
  conclusion += `However, considerations around scaling, maintenance, and specific workload requirements should inform the final architecture decision.`;
  
  return conclusion;
}

/**
 * Get comparison details for specific architecture types
 * @param {string} templatePath1 Path to first template 
 * @param {string} templatePath2 Path to second template
 * @param {Object} options Comparison options
 * @returns {Object} Detailed comparison
 */
async function compareSpecificArchitectures(templatePath1, templatePath2, options = {}) {
  const {
    architecture1Name = "Architecture 1",
    architecture2Name = "Architecture 2",
  } = options;
  
  return compareArchitectures({
    templatePaths: [templatePath1, templatePath2],
    architectureNames: [architecture1Name, architecture2Name],
    ...options
  });
}

/**
 * Compare serverless vs container architectures
 * @param {Object} options Comparison options
 * @returns {Object} Comparison results
 */
async function compareServerlessVsContainers(options = {}) {
  const serverlessPath = path.join(__dirname, 'templates', 'serverless_template.json');
  const containerPath = path.join(__dirname, 'templates', 'container_template.json');
  
  return compareSpecificArchitectures(
    serverlessPath,
    containerPath,
    {
      architecture1Name: "Serverless",
      architecture2Name: "Containers",
      ...options
    }
  );
}

/**
 * Compare container vs EC2 architectures
 * @param {Object} options Comparison options
 * @returns {Object} Comparison results
 */
async function compareContainersVsEC2(options = {}) {
  const containerPath = path.join(__dirname, 'templates', 'container_template.json');
  const ec2Path = path.join(__dirname, 'templates', 'ec2_template.json');
  
  return compareSpecificArchitectures(
    containerPath,
    ec2Path,
    {
      architecture1Name: "Containers",
      architecture2Name: "EC2",
      ...options
    }
  );
}

/**
 * Compare all available architecture types (serverless, containers, EC2)
 * @param {Object} options Comparison options
 * @returns {Object} Comparison results
 */
async function compareAllArchitectures(options = {}) {
  const serverlessPath = path.join(__dirname, 'templates', 'serverless_template.json');
  const containerPath = path.join(__dirname, 'templates', 'container_template.json');
  const ec2Path = path.join(__dirname, 'templates', 'ec2_template.json');
  
  return compareArchitectures({
    templatePaths: [serverlessPath, containerPath, ec2Path],
    architectureNames: ["Serverless", "Containers", "EC2"],
    ...options
  });
}

module.exports = {
  compareArchitectures,
  compareSpecificArchitectures,
  compareServerlessVsContainers,
  compareContainersVsEC2,
  compareAllArchitectures
}; 