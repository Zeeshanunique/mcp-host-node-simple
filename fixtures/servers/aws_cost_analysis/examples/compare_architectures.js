#!/usr/bin/env node

/**
 * AWS Architecture Cost Comparison Example
 * 
 * This script demonstrates how to use the AWS Cost Analysis module to compare
 * costs between different architectural patterns: EC2-based, container-based,
 * and serverless architectures.
 */

const path = require('path');
const fs = require('fs');
const { 
  analyze_template, 
  compare_architectures, 
  list_templates 
} = require('../index');

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

/**
 * Helper function to print results in a formatted way
 */
function printResults(data) {
  console.log('\n' + '='.repeat(80));
  console.log(`${data.title}`.padStart(40 + Math.floor(data.title.length/2)));
  console.log('='.repeat(80));
  
  console.log(JSON.stringify(data.results, null, 2));
  
  if (data.reportPath) {
    console.log('\nHTML report generated at:', data.reportPath);
  }
  
  console.log('\n');
}

/**
 * Example 1: List available templates
 */
async function listTemplates() {
  console.log('\nListing available templates...');
  const templates = await list_templates();
  
  if (templates.error) {
    console.error('Error listing templates:', templates.error);
    return;
  }
  
  console.log(`Found ${templates.count} templates:`);
  templates.templates.forEach(template => {
    console.log(`- ${template.name} (${template.path})`);
  });
}

/**
 * Example 2: Analyze a single template
 */
async function analyzeSingleTemplate() {
  const templateName = 'container_template.json';
  console.log(`\nAnalyzing ${templateName}...`);
  
  const result = await analyze_template({
    templatePath: `templates/${templateName}`,
    name: 'Container Architecture',
    region: 'us-east-1',
    options: {
      includeRecommendations: true,
      assumedUtilization: 0.7
    }
  });
  
  if (result.error) {
    console.error('Error analyzing template:', result.error);
    return;
  }
  
  printResults({
    title: 'Single Template Analysis',
    results: {
      templateName: result.templateName,
      totalCost: `$${result.totalCost.toFixed(2)} per month`,
      serviceBreakdown: Object.entries(result.serviceCosts)
        .map(([service, cost]) => `${service}: $${cost.toFixed(2)}`),
      resourceCount: Object.entries(result.resources)
        .map(([type, resources]) => `${type}: ${resources.length}`),
      recommendationsCount: result.recommendations.length
    }
  });
}

/**
 * Example 3: Compare different architecture patterns
 */
async function compareArchitectures() {
  console.log('\nComparing architecture patterns...');
  
  const comparison = await compare_architectures({
    templates: [
      {
        path: 'templates/container_template.json',
        name: 'Container Architecture'
      },
      {
        path: 'templates/serverless_template.json',
        name: 'Serverless Architecture'
      }
    ],
    generateHtml: true,
    options: {
      region: 'us-east-1',
      reportTitle: 'Architecture Pattern Comparison',
      reportPath: 'reports/architecture_comparison.html',
      assumedUtilization: 0.7
    }
  });
  
  if (comparison.error) {
    console.error('Error comparing architectures:', comparison.error);
    return;
  }
  
  // Extract some key information for display
  const architectureCosts = {};
  comparison.architectures.forEach(arch => {
    architectureCosts[arch.templateName] = `$${arch.totalCost.toFixed(2)}`;
  });
  
  printResults({
    title: 'Architecture Comparison',
    results: {
      architectureCosts,
      recommendations: comparison.recommendations.map(rec => rec.title),
      timestamp: comparison.timestamp
    },
    reportPath: path.join(__dirname, '..', 'reports', 'architecture_comparison.html')
  });
}

/**
 * Main function - run all examples
 */
async function main() {
  try {
    // Example 1: List templates
    await listTemplates();
    
    // Example 2: Analyze a single template
    await analyzeSingleTemplate();
    
    // Example 3: Compare architectures
    await compareArchitectures();
    
    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run the main function
main(); 