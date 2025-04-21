/**
 * Report generator for AWS cost analysis
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadTemplate, saveToFile, formatCost, calculateGrowthProjection } from './helpers.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate a cost report from service analysis results
 * @param {Object} analysisResults Analysis results from cdk_analyzer.js
 * @param {Object} options Report generation options
 * @returns {Promise<Object>} Report details
 */
export const generateCostReport = async (analysisResults, options = {}) => {
  try {
    const {
      outputFormat = 'markdown',
      includeFreeTier = true,
      includeGrowthProjection = true,
      outputDir = 'reports',
      fileName = `aws-cost-report-${Date.now()}.md`
    } = options;
    
    // Load the appropriate template
    const templateName = `report-template.${outputFormat}`;
    let template = await loadTemplate(templateName);
    
    // Prepare report data
    const reportData = prepareReportData(analysisResults, {
      includeFreeTier,
      includeGrowthProjection
    });
    
    // Generate the report content
    const reportContent = generateReportContent(template, reportData, outputFormat);
    
    // Save the report to a file
    const outputPath = path.join(__dirname, outputDir, fileName);
    await saveToFile(outputPath, reportContent);
    
    return {
      success: true,
      reportPath: outputPath,
      fileName,
      reportData
    };
  } catch (error) {
    console.error(`Error generating cost report: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Prepare data for the cost report
 * @param {Object} analysisResults Analysis results
 * @param {Object} options Report options
 * @returns {Object} Formatted report data
 */
const prepareReportData = (analysisResults, options) => {
  const { 
    services = [], 
    resourceCounts = {}, 
    costEstimates = {} 
  } = analysisResults;
  
  // Calculate total costs
  let totalMonthlyCost = 0;
  let totalAnnualCost = 0;
  
  Object.values(costEstimates).forEach(estimate => {
    if (estimate.monthly_cost && typeof estimate.monthly_cost === 'number') {
      totalMonthlyCost += estimate.monthly_cost;
      totalAnnualCost += estimate.monthly_cost * 12;
    }
  });
  
  // Prepare service details for the report
  const serviceDetails = services.map(service => {
    const resourceCount = Object.entries(resourceCounts)
      .filter(([type, count]) => type.includes(service))
      .reduce((total, [_, count]) => total + count, 0);
    
    const costEstimate = costEstimates[service] || {};
    
    return {
      name: service,
      resourceCount,
      monthlyCost: costEstimate.monthly_cost || 0,
      annualCost: costEstimate.annual_cost || 0,
      freeTierEligible: costEstimate.free_tier_eligible || false,
      freeTierInfo: costEstimate.free_tier_limit || 'Not available',
      costComponents: costEstimate.breakdown || []
    };
  });
  
  // Generate growth projections if needed
  let growthProjections = {};
  if (options.includeGrowthProjection && totalMonthlyCost > 0) {
    growthProjections = {
      conservative: calculateGrowthProjection(totalMonthlyCost, 0.05), // 5% growth
      moderate: calculateGrowthProjection(totalMonthlyCost, 0.15),     // 15% growth
      aggressive: calculateGrowthProjection(totalMonthlyCost, 0.30)    // 30% growth
    };
  }
  
  // Prepare free tier information if needed
  let freeTierServices = [];
  if (options.includeFreeTier) {
    freeTierServices = serviceDetails.filter(service => 
      service.freeTierEligible
    );
  }
  
  return {
    analysisTimestamp: new Date().toISOString(),
    stackName: analysisResults.stackName || 'Unknown Stack',
    totalServices: services.length,
    totalResources: Object.values(resourceCounts).reduce((a, b) => a + b, 0),
    totalMonthlyCost,
    totalAnnualCost,
    formattedMonthlyCost: formatCost(totalMonthlyCost),
    formattedAnnualCost: formatCost(totalAnnualCost),
    serviceDetails,
    freeTierServices,
    growthProjections,
    resourceCounts
  };
};

/**
 * Generate the report content using the template
 * @param {string} template Report template
 * @param {Object} data Report data
 * @param {string} format Output format
 * @returns {string} Report content
 */
const generateReportContent = (template, data, format) => {
  let content = template;
  
  // Replace basic placeholders
  content = content.replace(/\{TIMESTAMP\}/g, new Date().toLocaleString());
  content = content.replace(/\{STACK_NAME\}/g, data.stackName);
  content = content.replace(/\{TOTAL_SERVICES\}/g, data.totalServices);
  content = content.replace(/\{TOTAL_RESOURCES\}/g, data.totalResources);
  content = content.replace(/\{MONTHLY_COST\}/g, data.formattedMonthlyCost);
  content = content.replace(/\{ANNUAL_COST\}/g, data.formattedAnnualCost);
  
  // Generate service cost table
  const serviceTable = generateServiceTable(data.serviceDetails, format);
  content = content.replace(/\{SERVICE_COST_TABLE\}/g, serviceTable);
  
  // Generate resource count section
  const resourceSection = generateResourceSection(data.resourceCounts, format);
  content = content.replace(/\{RESOURCE_COUNT_SECTION\}/g, resourceSection);
  
  // Generate free tier section if applicable
  if (data.freeTierServices.length > 0) {
    const freeTierSection = generateFreeTierSection(data.freeTierServices, format);
    content = content.replace(/\{FREE_TIER_SECTION\}/g, freeTierSection);
  } else {
    content = content.replace(/\{FREE_TIER_SECTION\}/g, "No free tier eligible services identified.");
  }
  
  // Generate growth projection section if applicable
  if (data.growthProjections && Object.keys(data.growthProjections).length > 0) {
    const growthSection = generateGrowthSection(data.growthProjections, format);
    content = content.replace(/\{GROWTH_PROJECTION_SECTION\}/g, growthSection);
  } else {
    content = content.replace(/\{GROWTH_PROJECTION_SECTION\}/g, "Growth projections not available.");
  }
  
  return content;
};

/**
 * Generate a service cost table for the report
 * @param {Array} services Service details
 * @param {string} format Output format
 * @returns {string} Service table content
 */
const generateServiceTable = (services, format) => {
  if (format === 'markdown') {
    let table = "| Service | Resources | Monthly Cost | Annual Cost | Free Tier Eligible |\n";
    table += "|---------|-----------|--------------|-------------|-------------------|\n";
    
    services.forEach(service => {
      table += `| ${service.name} | ${service.resourceCount} | ${formatCost(service.monthlyCost)} | ${formatCost(service.annualCost)} | ${service.freeTierEligible ? 'Yes' : 'No'} |\n`;
    });
    
    return table;
  }
  
  // Default to simple text if format is not supported
  let table = "SERVICE COSTS:\n";
  services.forEach(service => {
    table += `- ${service.name}: ${service.resourceCount} resources, ${formatCost(service.monthlyCost)}/month, ${formatCost(service.annualCost)}/year\n`;
  });
  
  return table;
};

/**
 * Generate a resource count section for the report
 * @param {Object} resourceCounts Resource counts
 * @param {string} format Output format
 * @returns {string} Resource section content
 */
const generateResourceSection = (resourceCounts, format) => {
  const resources = Object.entries(resourceCounts)
    .sort((a, b) => b[1] - a[1]); // Sort by count descending
  
  if (format === 'markdown') {
    let section = "| Resource Type | Count |\n";
    section += "|--------------|-------|\n";
    
    resources.forEach(([resource, count]) => {
      section += `| ${resource} | ${count} |\n`;
    });
    
    return section;
  }
  
  // Default to simple text
  let section = "RESOURCE COUNTS:\n";
  resources.forEach(([resource, count]) => {
    section += `- ${resource}: ${count}\n`;
  });
  
  return section;
};

/**
 * Generate a free tier section for the report
 * @param {Array} freeTierServices Free tier eligible services
 * @param {string} format Output format
 * @returns {string} Free tier section content
 */
const generateFreeTierSection = (freeTierServices, format) => {
  if (format === 'markdown') {
    let section = "| Service | Free Tier Limits |\n";
    section += "|---------|----------------|\n";
    
    freeTierServices.forEach(service => {
      section += `| ${service.name} | ${service.freeTierInfo} |\n`;
    });
    
    return section;
  }
  
  // Default to simple text
  let section = "FREE TIER ELIGIBLE SERVICES:\n";
  freeTierServices.forEach(service => {
    section += `- ${service.name}: ${service.freeTierInfo}\n`;
  });
  
  return section;
};

/**
 * Generate a growth projection section for the report
 * @param {Object} projections Growth projections
 * @param {string} format Output format
 * @returns {string} Growth section content
 */
const generateGrowthSection = (projections, format) => {
  if (format === 'markdown') {
    let section = "## Growth Projections\n\n";
    
    // Conservative growth
    section += "### Conservative Growth (5% Annually)\n\n";
    section += "| Year | Monthly Cost | Annual Cost |\n";
    section += "|------|--------------|-------------|\n";
    projections.conservative.forEach(year => {
      section += `| Year ${year.year} | ${formatCost(year.monthly)} | ${formatCost(year.annually)} |\n`;
    });
    
    // Moderate growth
    section += "\n### Moderate Growth (15% Annually)\n\n";
    section += "| Year | Monthly Cost | Annual Cost |\n";
    section += "|------|--------------|-------------|\n";
    projections.moderate.forEach(year => {
      section += `| Year ${year.year} | ${formatCost(year.monthly)} | ${formatCost(year.annually)} |\n`;
    });
    
    // Aggressive growth
    section += "\n### Aggressive Growth (30% Annually)\n\n";
    section += "| Year | Monthly Cost | Annual Cost |\n";
    section += "|------|--------------|-------------|\n";
    projections.aggressive.forEach(year => {
      section += `| Year ${year.year} | ${formatCost(year.monthly)} | ${formatCost(year.annually)} |\n`;
    });
    
    return section;
  }
  
  // Default to simple text
  let section = "GROWTH PROJECTIONS:\n";
  
  section += "\nConservative Growth (5% Annually):\n";
  projections.conservative.forEach(year => {
    section += `- Year ${year.year}: ${formatCost(year.monthly)}/month, ${formatCost(year.annually)}/year\n`;
  });
  
  section += "\nModerate Growth (15% Annually):\n";
  projections.moderate.forEach(year => {
    section += `- Year ${year.year}: ${formatCost(year.monthly)}/month, ${formatCost(year.annually)}/year\n`;
  });
  
  section += "\nAggressive Growth (30% Annually):\n";
  projections.aggressive.forEach(year => {
    section += `- Year ${year.year}: ${formatCost(year.monthly)}/month, ${formatCost(year.annually)}/year\n`;
  });
  
  return section;
};

/**
 * Generate a cost optimization recommendations section
 * @param {Object} analysisResults Analysis results
 * @returns {string} Recommendations content
 */
export const generateOptimizationRecommendations = (analysisResults) => {
  const { services = [], resourceCounts = {}, costEstimates = {} } = analysisResults;
  
  // Initialize recommendations
  const recommendations = [];
  
  // Check for Lambda optimizations
  if (services.includes('Lambda')) {
    recommendations.push({
      service: 'Lambda',
      recommendation: 'Consider rightsizing Lambda function memory to optimize the cost-performance ratio',
      impact: 'Medium',
      implementation: 'Review CloudWatch logs to identify memory usage patterns and adjust memory allocation accordingly'
    });
  }
  
  // Check for S3 optimizations
  if (services.includes('S3')) {
    recommendations.push({
      service: 'S3',
      recommendation: 'Implement S3 lifecycle policies to transition infrequently accessed data to cheaper storage classes',
      impact: 'High',
      implementation: 'Add lifecycle configuration to move objects to S3-IA or Glacier after 30 days of inactivity'
    });
  }
  
  // Check for EC2 optimizations
  if (services.includes('EC2')) {
    recommendations.push({
      service: 'EC2',
      recommendation: 'Consider using Reserved Instances for predictable workloads',
      impact: 'High',
      implementation: 'Purchase 1-year or 3-year Reserved Instances for instances with consistent usage patterns'
    });
  }
  
  // Check for DynamoDB optimizations
  if (services.includes('DynamoDB')) {
    recommendations.push({
      service: 'DynamoDB',
      recommendation: 'Review provisioned capacity settings and consider using auto-scaling or on-demand pricing',
      impact: 'Medium',
      implementation: 'Analyze CloudWatch metrics to identify usage patterns and implement auto-scaling with appropriate settings'
    });
  }
  
  // Format recommendations as markdown
  let recommendationsMarkdown = '## Cost Optimization Recommendations\n\n';
  
  if (recommendations.length === 0) {
    recommendationsMarkdown += 'No specific optimization recommendations available for the current stack configuration.\n';
  } else {
    recommendationsMarkdown += '| Service | Recommendation | Impact | Implementation |\n';
    recommendationsMarkdown += '|---------|----------------|--------|----------------|\n';
    
    recommendations.forEach(rec => {
      recommendationsMarkdown += `| ${rec.service} | ${rec.recommendation} | ${rec.impact} | ${rec.implementation} |\n`;
    });
  }
  
  return recommendationsMarkdown;
};

/**
 * Generate a condensed summary of the cost analysis
 * @param {Object} analysisResults Analysis results
 * @returns {string} Summary content
 */
export const generateCostSummary = (analysisResults) => {
  const { 
    services = [], 
    resourceCounts = {}, 
    costEstimates = {},
    stackName = 'Unknown Stack'
  } = analysisResults;
  
  // Calculate total costs
  let totalMonthlyCost = 0;
  Object.values(costEstimates).forEach(estimate => {
    if (estimate.monthly_cost && typeof estimate.monthly_cost === 'number') {
      totalMonthlyCost += estimate.monthly_cost;
    }
  });
  
  // Format the summary
  let summary = `# AWS Cost Analysis Summary for "${stackName}"\n\n`;
  summary += `**Analysis Date:** ${new Date().toLocaleDateString()}\n\n`;
  summary += `**Total Services:** ${services.length}\n`;
  summary += `**Total Resources:** ${Object.values(resourceCounts).reduce((a, b) => a + b, 0)}\n`;
  summary += `**Estimated Monthly Cost:** ${formatCost(totalMonthlyCost)}\n`;
  summary += `**Estimated Annual Cost:** ${formatCost(totalMonthlyCost * 12)}\n\n`;
  
  // Add service breakdown
  summary += "## Services Breakdown\n\n";
  
  const serviceDetails = services.map(service => {
    const estimate = costEstimates[service] || {};
    return {
      name: service,
      monthly: estimate.monthly_cost || 0,
      percentage: totalMonthlyCost > 0 
        ? ((estimate.monthly_cost || 0) / totalMonthlyCost) * 100 
        : 0
    };
  }).sort((a, b) => b.monthly - a.monthly);
  
  summary += "| Service | Monthly Cost | % of Total |\n";
  summary += "|---------|--------------|------------|\n";
  
  serviceDetails.forEach(service => {
    summary += `| ${service.name} | ${formatCost(service.monthly)} | ${service.percentage.toFixed(1)}% |\n`;
  });
  
  return summary;
};

/**
 * Generate a comparison report between serverless and EC2-based architectures
 * @param {Object} data Object containing serverless and EC2 analysis results 
 * @returns {string} Markdown comparison report
 */
export const generateComparisonReport = (data) => {
  const { serverless, ec2, options = {} } = data;
  
  if (!serverless || !ec2) {
    throw new Error('Both serverless and EC2 analysis results are required');
  }
  
  // Initialize the report content
  let report = `# AWS Architecture Cost Comparison\n\n`;
  report += `**Analysis Date:** ${new Date().toLocaleDateString()}\n`;
  report += `**Region:** ${options.region || 'us-east-1'}\n`;
  report += `**Duration:** ${options.duration || 30} days\n\n`;
  
  // Overall comparison
  const serverlessCost = serverless.totalCost || 0;
  const ec2Cost = ec2.totalCost || 0;
  const difference = Math.abs(serverlessCost - ec2Cost);
  const percentageDiff = ((difference / Math.max(serverlessCost, ec2Cost)) * 100).toFixed(2);
  const cheaper = serverlessCost < ec2Cost ? 'Serverless' : 'EC2-based';
  
  report += `## Cost Summary\n\n`;
  report += `| Architecture | Monthly Cost | Annual Cost | Relative Cost |\n`;
  report += `|--------------|--------------|-------------|---------------|\n`;
  report += `| Serverless | ${formatCost(serverlessCost)} | ${formatCost(serverlessCost * 12)} | ${serverlessCost < ec2Cost ? '✅ Cheaper' : '❌ More expensive'} |\n`;
  report += `| EC2-based | ${formatCost(ec2Cost)} | ${formatCost(ec2Cost * 12)} | ${ec2Cost < serverlessCost ? '✅ Cheaper' : '❌ More expensive'} |\n\n`;
  
  report += `The **${cheaper}** architecture is **${formatCost(difference)}** cheaper per month (${percentageDiff}% difference).\n\n`;
  
  // Service breakdown comparison
  report += `## Service Cost Breakdown\n\n`;
  
  // Get all unique services across both architectures
  const allServices = new Set([
    ...(serverless.services || []),
    ...(ec2.services || [])
  ]);
  
  report += `| Service | Serverless Cost | EC2-based Cost | Difference |\n`;
  report += `|---------|----------------|----------------|------------|\n`;
  
  // Add rows for each service
  Array.from(allServices).sort().forEach(service => {
    const serverlessServiceCost = (serverless.costEstimates && serverless.costEstimates[service] && 
      serverless.costEstimates[service].monthly_cost) || 0;
    
    const ec2ServiceCost = (ec2.costEstimates && ec2.costEstimates[service] && 
      ec2.costEstimates[service].monthly_cost) || 0;
    
    const serviceDiff = Math.abs(serverlessServiceCost - ec2ServiceCost);
    let diffText = '';
    
    if (serviceDiff > 0) {
      diffText = serverlessServiceCost < ec2ServiceCost ? 
        `✅ ${formatCost(serviceDiff)} cheaper` : 
        `❌ ${formatCost(serviceDiff)} more`;
    } else {
      diffText = 'Same cost';
    }
    
    report += `| ${service} | ${formatCost(serverlessServiceCost)} | ${formatCost(ec2ServiceCost)} | ${diffText} |\n`;
  });
  
  // Resource counts comparison
  report += `\n## Resource Count Comparison\n\n`;
  
  // Get all unique resource types
  const allResourceTypes = new Set([
    ...Object.keys(serverless.resourceCounts || {}),
    ...Object.keys(ec2.resourceCounts || {})
  ]);
  
  report += `| Resource Type | Serverless Count | EC2-based Count |\n`;
  report += `|---------------|-----------------|----------------|\n`;
  
  Array.from(allResourceTypes).sort().forEach(resourceType => {
    const serverlessCount = (serverless.resourceCounts && serverless.resourceCounts[resourceType]) || 0;
    const ec2Count = (ec2.resourceCounts && ec2.resourceCounts[resourceType]) || 0;
    
    report += `| ${resourceType} | ${serverlessCount} | ${ec2Count} |\n`;
  });
  
  // Pros and cons section
  report += `\n## Architecture Pros & Cons\n\n`;
  
  report += `### Serverless Architecture\n\n`;
  report += `**Pros:**\n`;
  report += `- Auto-scaling without manual configuration\n`;
  report += `- Pay only for actual usage\n`;
  report += `- Lower operational overhead\n`;
  report += `- Built-in high availability\n\n`;
  
  report += `**Cons:**\n`;
  report += `- Cold start latency\n`;
  report += `- Limited execution duration\n`;
  report += `- Potentially higher costs at very large scale\n`;
  report += `- Less control over infrastructure\n\n`;
  
  report += `### EC2-based Architecture\n\n`;
  report += `**Pros:**\n`;
  report += `- Full control over infrastructure\n`;
  report += `- Predictable performance\n`;
  report += `- No execution time limits\n`;
  report += `- Potentially cheaper at consistent high loads\n\n`;
  
  report += `**Cons:**\n`;
  report += `- Manual scaling configuration required\n`;
  report += `- Higher operational overhead\n`;
  report += `- Pay for provisioned capacity, not usage\n`;
  report += `- More complex high availability setup\n\n`;
  
  // Recommendations section
  report += `## Recommendations\n\n`;
  
  if (serverlessCost < ec2Cost) {
    report += `Based on the cost analysis, the **Serverless** architecture is recommended for this workload. `;
    report += `It provides a ${percentageDiff}% cost saving (${formatCost(difference)}/month) compared to the EC2-based approach.\n\n`;
    
    report += `Consider using the Serverless architecture if:\n`;
    report += `- Your workload has variable or unpredictable traffic patterns\n`;
    report += `- You want to minimize operational overhead\n`;
    report += `- Fast deployment and iteration are important\n`;
    report += `- The application can be broken down into small, independent functions\n`;
  } else {
    report += `Based on the cost analysis, the **EC2-based** architecture is recommended for this workload. `;
    report += `It provides a ${percentageDiff}% cost saving (${formatCost(difference)}/month) compared to the Serverless approach.\n\n`;
    
    report += `Consider using the EC2-based architecture if:\n`;
    report += `- Your workload has consistent, predictable traffic\n`;
    report += `- You require more control over the infrastructure\n`;
    report += `- Your application has long-running processes\n`;
    report += `- You have existing operational expertise with EC2\n`;
  }
  
  report += `\n## Potential Optimizations\n\n`;
  
  report += `### Serverless Optimizations\n`;
  report += `- Right-size Lambda memory configurations\n`;
  report += `- Optimize code to reduce execution time\n`;
  report += `- Use provisioned concurrency for critical functions\n`;
  report += `- Implement caching strategies to reduce function invocations\n\n`;
  
  report += `### EC2 Optimizations\n`;
  report += `- Use Reserved Instances for predictable workloads\n`;
  report += `- Implement auto-scaling based on actual usage patterns\n`;
  report += `- Right-size instance types based on application requirements\n`;
  report += `- Consider Spot Instances for non-critical workloads\n`;
  
  return report;
}; 