#!/usr/bin/env node

/**
 * AWS CDK Stack Analyzer - Sample Script
 * 
 * This script demonstrates how to use the CDK Stack Analyzer programmatically
 * to analyze different architecture templates and compare their estimated costs.
 */

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('./cdk_analyzer');

// Define templates to analyze
const TEMPLATES = {
  EC2_ARCHITECTURE: path.join(__dirname, 'templates/ec2_template.json'),
  CONTAINER_ARCHITECTURE: path.join(__dirname, 'templates/container_template.json'),
};

// Analyze function with error handling
async function analyzeAndReport(templatePath, options = {}) {
  console.log(`\n===== Analyzing ${path.basename(templatePath)} =====\n`);
  
  try {
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file does not exist: ${templatePath}`);
    }
    
    const result = await analyzeCdkStack(templatePath, options);
    
    // Print basic information
    console.log(`Stack: ${result.stackName}`);
    console.log(`Resources: ${result.totalResources}`);
    console.log(`Services: ${result.services.length}`);
    
    // Print resource breakdown
    console.log('\nResource Breakdown:');
    Object.entries(result.resourceCounts).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });
    
    // Print service costs
    console.log('\nEstimated Monthly Costs:');
    let totalCost = 0;
    
    result.services.forEach(service => {
      console.log(`  - ${service.name}: $${service.monthlyCost.toFixed(2)}`);
      totalCost += service.monthlyCost;
    });
    
    console.log(`\nTotal Estimated Monthly Cost: $${totalCost.toFixed(2)}`);
    return result;
  } catch (error) {
    console.error('Analysis failed:', error.message);
    return null;
  }
}

// Compare two architectures
async function compareArchitectures(arch1, arch2) {
  const result1 = await analyzeAndReport(TEMPLATES[arch1]);
  const result2 = await analyzeAndReport(TEMPLATES[arch2]);
  
  if (!result1 || !result2) {
    console.error('Unable to compare architectures due to analysis failure');
    return;
  }
  
  const totalCost1 = result1.services.reduce((sum, service) => sum + service.monthlyCost, 0);
  const totalCost2 = result2.services.reduce((sum, service) => sum + service.monthlyCost, 0);
  
  console.log('\n===== Architecture Comparison =====\n');
  console.log(`${arch1} Total Cost: $${totalCost1.toFixed(2)}`);
  console.log(`${arch2} Total Cost: $${totalCost2.toFixed(2)}`);
  
  const diff = totalCost2 - totalCost1;
  const percentDiff = ((diff / totalCost1) * 100).toFixed(2);
  
  if (diff > 0) {
    console.log(`${arch2} is $${diff.toFixed(2)} (${percentDiff}%) more expensive than ${arch1}`);
  } else if (diff < 0) {
    console.log(`${arch2} is $${Math.abs(diff).toFixed(2)} (${Math.abs(percentDiff)}%) cheaper than ${arch1}`);
  } else {
    console.log(`Both architectures have the same cost`);
  }
  
  // Compare service costs
  console.log('\nService Cost Comparison:');
  const allServices = new Set([
    ...result1.services.map(s => s.name),
    ...result2.services.map(s => s.name)
  ]);
  
  allServices.forEach(serviceName => {
    const service1 = result1.services.find(s => s.name === serviceName) || { monthlyCost: 0 };
    const service2 = result2.services.find(s => s.name === serviceName) || { monthlyCost: 0 };
    
    const serviceDiff = service2.monthlyCost - service1.monthlyCost;
    
    if (serviceDiff !== 0) {
      const direction = serviceDiff > 0 ? 'more expensive' : 'cheaper';
      console.log(`  - ${serviceName}: $${Math.abs(serviceDiff).toFixed(2)} ${direction} in ${arch2}`);
    } else if (service1.monthlyCost > 0 && service2.monthlyCost > 0) {
      console.log(`  - ${serviceName}: Same cost in both architectures`);
    }
  });
}

// Main function
async function main() {
  const command = process.argv[2] || 'analyze';
  
  switch (command) {
    case 'analyze':
      const templateArg = process.argv[3] || 'EC2_ARCHITECTURE';
      if (!TEMPLATES[templateArg]) {
        console.error(`Unknown template: ${templateArg}`);
        console.log(`Available templates: ${Object.keys(TEMPLATES).join(', ')}`);
        process.exit(1);
      }
      await analyzeAndReport(TEMPLATES[templateArg]);
      break;
      
    case 'compare':
      await compareArchitectures('EC2_ARCHITECTURE', 'CONTAINER_ARCHITECTURE');
      break;
      
    default:
      console.log('Usage:');
      console.log('  node sample.js analyze [EC2_ARCHITECTURE|CONTAINER_ARCHITECTURE]');
      console.log('  node sample.js compare');
      break;
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 