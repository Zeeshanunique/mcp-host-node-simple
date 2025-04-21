#!/usr/bin/env node

/**
 * Architecture Cost Comparison Script
 * 
 * This script compares the cost estimates between EC2-based and container-based
 * architectures using the CDK analyzer.
 */

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('./cdk_analyzer');
const { generateReport } = require('./report_generator');

// Directory containing templates
const TEMPLATES_DIR = path.join(__dirname, 'templates');

// Template paths
const EC2_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'ec2_template.json');
const CONTAINER_TEMPLATE_PATH = path.join(TEMPLATES_DIR, 'container_template.json');

// Output paths
const EC2_REPORT_PATH = path.join(__dirname, 'reports', 'ec2_analysis.md');
const CONTAINER_REPORT_PATH = path.join(__dirname, 'reports', 'container_analysis.md');
const COMPARISON_REPORT_PATH = path.join(__dirname, 'reports', 'architecture_comparison.md');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Formats a cost value as USD currency
 * @param {number} value - The cost value to format
 * @returns {string} - The formatted cost
 */
function formatCost(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/**
 * Calculates percentage difference between two values
 * @param {number} value1 - First value
 * @param {number} value2 - Second value
 * @returns {string} - Formatted percentage difference
 */
function calculateDifference(value1, value2) {
  const diff = ((value2 - value1) / value1) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(2)}%`;
}

/**
 * Main function to analyze and compare architectures
 */
async function compareArchitectures() {
  console.log('Analyzing EC2-based architecture...');
  const ec2Analysis = await analyzeCdkStack(EC2_TEMPLATE_PATH, {
    region: 'us-east-1', 
    estimatedUsage: {
      apiRequests: 1000000,
      storageGB: 500,
      lambdaInvocations: 0, // N/A for EC2
      databaseOperations: 5000000
    }
  });
  
  console.log('Analyzing container-based architecture...');
  const containerAnalysis = await analyzeCdkStack(CONTAINER_TEMPLATE_PATH, {
    region: 'us-east-1',
    estimatedUsage: {
      apiRequests: 1000000,
      storageGB: 500,
      lambdaInvocations: 0, // N/A for containers
      databaseOperations: 5000000
    }
  });

  // Generate individual reports
  await generateReport(ec2Analysis, EC2_REPORT_PATH);
  await generateReport(containerAnalysis, CONTAINER_REPORT_PATH);
  
  // Generate comparison report
  const ec2MonthlyCost = ec2Analysis.estimatedCost.monthlyCost;
  const containerMonthlyCost = containerAnalysis.estimatedCost.monthlyCost;
  const costDifference = calculateDifference(ec2MonthlyCost, containerMonthlyCost);
  
  const comparisonContent = `# Architecture Cost Comparison

## Overview
This report compares the cost estimates between EC2-based and container-based architectures.

## Cost Summary

| Architecture | Monthly Cost | Yearly Cost | Difference |
|--------------|--------------|------------|------------|
| EC2-based    | ${formatCost(ec2MonthlyCost)} | ${formatCost(ec2MonthlyCost * 12)} | Baseline |
| Container-based | ${formatCost(containerMonthlyCost)} | ${formatCost(containerMonthlyCost * 12)} | ${costDifference} |

## Resource Breakdown

### EC2-based Architecture
${generateResourceTable(ec2Analysis.resources)}

### Container-based Architecture
${generateResourceTable(containerAnalysis.resources)}

## Service Cost Comparison

| Service | EC2-based Cost | Container-based Cost | Difference |
|---------|---------------|----------------------|------------|
${generateServiceComparisonTable(ec2Analysis.serviceCosts, containerAnalysis.serviceCosts)}

## Recommendations

${generateRecommendations(ec2Analysis, containerAnalysis)}

## Notes
- Estimates are based on us-east-1 region pricing
- Actual costs may vary based on real-world usage patterns
- Reserved instances or Savings Plans not included in this analysis
`;

  fs.writeFileSync(COMPARISON_REPORT_PATH, comparisonContent);
  
  console.log(`\nAnalysis complete!`);
  console.log(`EC2 Report: ${EC2_REPORT_PATH}`);
  console.log(`Container Report: ${CONTAINER_REPORT_PATH}`);
  console.log(`Comparison Report: ${COMPARISON_REPORT_PATH}`);
}

/**
 * Generates a markdown table for resources
 * @param {Object} resources - Resources from analysis 
 * @returns {string} - Markdown table
 */
function generateResourceTable(resources) {
  let table = '| Resource Type | Count |\n|--------------|-------|\n';
  
  Object.entries(resources).forEach(([resourceType, count]) => {
    table += `| ${resourceType} | ${count} |\n`;
  });
  
  return table;
}

/**
 * Generates a markdown table comparing service costs
 * @param {Object} ec2Costs - EC2 architecture service costs
 * @param {Object} containerCosts - Container architecture service costs
 * @returns {string} - Markdown table
 */
function generateServiceComparisonTable(ec2Costs, containerCosts) {
  let result = '';
  
  // Get all unique service names
  const allServices = new Set([
    ...Object.keys(ec2Costs),
    ...Object.keys(containerCosts)
  ]);
  
  // Generate rows
  allServices.forEach(service => {
    const ec2Cost = ec2Costs[service] || 0;
    const containerCost = containerCosts[service] || 0;
    const diff = calculateDifference(ec2Cost || 0.01, containerCost || 0.01);
    
    result += `| ${service} | ${formatCost(ec2Cost)} | ${formatCost(containerCost)} | ${diff} |\n`;
  });
  
  return result;
}

/**
 * Generates recommendations based on analysis results
 * @param {Object} ec2Analysis - EC2 architecture analysis
 * @param {Object} containerAnalysis - Container architecture analysis
 * @returns {string} - Recommendations text
 */
function generateRecommendations(ec2Analysis, containerAnalysis) {
  const ec2Cost = ec2Analysis.estimatedCost.monthlyCost;
  const containerCost = containerAnalysis.estimatedCost.monthlyCost;
  
  let recommendations = '';
  
  if (containerCost < ec2Cost) {
    const savings = formatCost(ec2Cost - containerCost);
    const savingsPercent = (((ec2Cost - containerCost) / ec2Cost) * 100).toFixed(2);
    
    recommendations += `
The container-based architecture is more cost-effective, offering potential savings of ${savings} per month (${savingsPercent}%).

Key advantages of containers:
- More efficient resource utilization
- Lower operational overhead
- Better scaling capabilities
- Reduced infrastructure costs
`;
  } else {
    const savings = formatCost(containerCost - ec2Cost);
    const savingsPercent = (((containerCost - ec2Cost) / containerCost) * 100).toFixed(2);
    
    recommendations += `
The EC2-based architecture is more cost-effective, offering potential savings of ${savings} per month (${savingsPercent}%).

Key advantages of EC2:
- More predictable pricing
- Direct control over instance sizing
- Potentially lower overhead for stable workloads
- Simpler architecture for teams without container expertise
`;
  }
  
  recommendations += `
### Cost Optimization Opportunities

1. Consider reserved instances or savings plans for stable components
2. Implement auto-scaling to match capacity with demand
3. Review storage needs and lifecycle policies
4. Optimize network traffic patterns to reduce data transfer costs
5. Analyze CloudWatch metrics to right-size resources based on actual usage
`;

  return recommendations;
}

// Execute the comparison
compareArchitectures().catch(error => {
  console.error('Error comparing architectures:', error);
  process.exit(1);
}); 