#!/usr/bin/env node

/**
 * Sample script to demonstrate how to use the AWS CDK Stack Analyzer
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeCdkStack } from '../cdk_analyzer.js';
import { generateReport } from '../report_generator.js';
import { saveToFile } from '../helpers.js';

// Get current file directory using ES modules approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the paths to the template files
const TEMPLATES = {
  serverless: path.join(__dirname, 'serverless-template.json'),
  ec2: path.join(__dirname, 'ec2-template.json')
};

// Analytics options
const analyzerOptions = {
  region: 'us-east-1',
  duration: 30, // 30 days
  includeDetails: true,
  calculateSavings: true
};

// Main function
async function main() {
  console.log('AWS CDK Stack Analyzer - Example Usage');
  console.log('--------------------------------------');
  
  try {
    // Analyze the serverless template
    console.log('\n🔍 Analyzing Serverless Template...');
    const serverlessResults = await analyzeCdkStack(TEMPLATES.serverless, analyzerOptions);
    printResults('Serverless Stack', serverlessResults);
    
    // Generate and save a report for the serverless template
    const serverlessReport = await generateReport(serverlessResults);
    const serverlessReportPath = path.join(__dirname, 'serverless-report.md');
    await saveToFile(serverlessReportPath, serverlessReport);
    console.log(`💾 Serverless report saved to: ${serverlessReportPath}`);
    
    // Analyze the EC2 template
    console.log('\n🔍 Analyzing EC2 Template...');
    const ec2Results = await analyzeCdkStack(TEMPLATES.ec2, analyzerOptions);
    printResults('EC2 Stack', ec2Results);
    
    // Generate and save a report for the EC2 template
    const ec2Report = await generateReport(ec2Results);
    const ec2ReportPath = path.join(__dirname, 'ec2-report.md');
    await saveToFile(ec2ReportPath, ec2Report);
    console.log(`💾 EC2 report saved to: ${ec2ReportPath}`);
    
    // Compare the two stacks
    compareStacks(serverlessResults, ec2Results);
    
  } catch (error) {
    console.error('❌ Error running the analyzer:', error.message);
    process.exit(1);
  }
}

// Helper function to print analysis results
function printResults(stackName, results) {
  console.log(`\n📊 Results for ${stackName}:`);
  console.log(`  - Resources: ${results.resourceCount} total resources`);
  console.log(`  - Services: ${Object.keys(results.serviceBreakdown).length} AWS services used`);
  console.log(`  - Estimated Monthly Cost: $${results.totalCost.toFixed(2)}`);
  
  // Show top 3 most expensive services
  const services = Object.entries(results.serviceBreakdown)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 3);
  
  console.log('\n  Top 3 Most Expensive Services:');
  services.forEach(([service, data], i) => {
    console.log(`    ${i+1}. ${service}: $${data.cost.toFixed(2)} (${(data.cost / results.totalCost * 100).toFixed(2)}%)`);
  });
}

// Helper function to compare two stacks
function compareStacks(stack1Results, stack2Results) {
  console.log('\n🔄 Stack Comparison:');
  console.log(`  - ${stack1Results.stackName} vs ${stack2Results.stackName}`);
  
  const costDiff = stack2Results.totalCost - stack1Results.totalCost;
  const percentDiff = (costDiff / stack1Results.totalCost * 100).toFixed(2);
  
  console.log(`  - Cost Difference: $${Math.abs(costDiff).toFixed(2)} (${costDiff > 0 ? '+' : ''}${percentDiff}%)`);
  console.log(`  - More Economical Stack: ${costDiff > 0 ? stack1Results.stackName : stack2Results.stackName}`);
  
  // Compare resource counts
  console.log(`  - Resource Count: ${stack1Results.resourceCount} vs ${stack2Results.resourceCount}`);
  
  // Compare common services
  const commonServices = new Set([
    ...Object.keys(stack1Results.serviceBreakdown),
    ...Object.keys(stack2Results.serviceBreakdown)
  ]);
  
  console.log('\n  Service Comparison:');
  Array.from(commonServices).forEach(service => {
    const service1Cost = (stack1Results.serviceBreakdown[service]?.cost || 0).toFixed(2);
    const service2Cost = (stack2Results.serviceBreakdown[service]?.cost || 0).toFixed(2);
    console.log(`    - ${service}: $${service1Cost} vs $${service2Cost}`);
  });
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1); 
}); 