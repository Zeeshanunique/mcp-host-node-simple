#!/usr/bin/env node

/**
 * AWS Architecture Cost Comparison Tool
 * 
 * Compares costs between EC2-based and container-based architectures.
 * Uses the CDK Analyzer to estimate costs for each architecture.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeCdkStack } from './cdk_analyzer.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define paths to templates
const EC2_TEMPLATE_PATH = path.join(__dirname, 'templates', 'ec2_template.json');
const CONTAINER_TEMPLATE_PATH = path.join(__dirname, 'templates', 'container_template.json');

// Options for cost analysis
const analysisOptions = {
  region: 'us-east-1',
  duration: 30, // days
  includeDetailedBreakdown: true
};

// Utility function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

// Utility function to calculate percentage difference
function calculatePercentageDifference(cost1, cost2) {
  const difference = ((cost2 - cost1) / cost1) * 100;
  return difference.toFixed(2);
}

// Helper to create a simple ASCII table
function createTable(headers, rows) {
  // Find the max width for each column
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = rows.reduce((max, row) => {
      return Math.max(max, String(row[i]).length);
    }, 0);
    return Math.max(h.length, maxRowWidth) + 2; // +2 for padding
  });
  
  // Create header row
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join('| ');
  const separator = colWidths.map(w => '-'.repeat(w)).join('+-');
  
  // Create data rows
  const dataRows = rows.map(row => {
    return row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('| ');
  });
  
  // Combine all parts
  return [
    headerRow,
    separator,
    ...dataRows
  ].join('\n');
}

// Main function to compare architectures
async function compareArchitectures() {
  console.log('🔍 Analyzing EC2-based architecture...');
  const ec2Analysis = await analyzeCdkStack(EC2_TEMPLATE_PATH, analysisOptions);

  console.log('🔍 Analyzing Container-based architecture...');
  const containerAnalysis = await analyzeCdkStack(CONTAINER_TEMPLATE_PATH, analysisOptions);

  // Extract total costs
  const ec2Cost = ec2Analysis.costEstimates?.totalCost || 0;
  const containerCost = containerAnalysis.costEstimates?.totalCost || 0;
  const pctDifference = calculatePercentageDifference(ec2Cost, containerCost);

  console.log('\n📊 ARCHITECTURE COST COMPARISON SUMMARY');
  console.log('=====================================');
  console.log(`EC2-based Architecture: ${formatCurrency(ec2Cost)}`);
  console.log(`Container-based Architecture: ${formatCurrency(containerCost)}`);
  console.log(`Difference: ${formatCurrency(containerCost - ec2Cost)} (${pctDifference}%)`);
  console.log(`Duration: ${analysisOptions.duration} days`);
  console.log(`Region: ${analysisOptions.region}`);
  
  // Compare service costs
  console.log('\n📊 SERVICE COST COMPARISON');
  console.log('=======================');
  
  // Combine all services from both architectures
  const allServices = new Set([
    ...Object.keys(ec2Analysis.costEstimates?.serviceCosts || {}),
    ...Object.keys(containerAnalysis.costEstimates?.serviceCosts || {})
  ]);
  
  const comparisonRows = [];
  
  allServices.forEach(service => {
    const ec2ServiceCost = ec2Analysis.costEstimates?.serviceCosts?.[service] || 0;
    const containerServiceCost = containerAnalysis.costEstimates?.serviceCosts?.[service] || 0;
    const diff = containerServiceCost - ec2ServiceCost;
    const pctDiff = ec2ServiceCost > 0 
      ? calculatePercentageDifference(ec2ServiceCost, containerServiceCost) 
      : 'N/A';
    
    comparisonRows.push([
      service,
      formatCurrency(ec2ServiceCost),
      formatCurrency(containerServiceCost),
      formatCurrency(diff),
      `${pctDiff}%`
    ]);
  });
  
  // Sort rows by cost difference (descending)
  comparisonRows.sort((a, b) => {
    const diffA = parseFloat(a[3].replace(/[^0-9.-]+/g, ''));
    const diffB = parseFloat(b[3].replace(/[^0-9.-]+/g, ''));
    return diffB - diffA;
  });
  
  const table = createTable(
    ['Service', 'EC2 Cost', 'Container Cost', 'Difference', '% Change'],
    comparisonRows
  );
  
  console.log(table);
  
  // Resource count comparison
  console.log('\n📊 RESOURCE COUNT COMPARISON');
  console.log('=========================');
  
  const ec2ResourceCount = ec2Analysis.resourceCounts || {};
  const containerResourceCount = containerAnalysis.resourceCounts || {};
  
  // Combine all resource types
  const allResourceTypes = new Set([
    ...Object.keys(ec2ResourceCount),
    ...Object.keys(containerResourceCount)
  ]);
  
  const resourceRows = [];
  
  allResourceTypes.forEach(resourceType => {
    const ec2Count = ec2ResourceCount[resourceType] || 0;
    const containerCount = containerResourceCount[resourceType] || 0;
    const diff = containerCount - ec2Count;
    
    resourceRows.push([
      resourceType,
      ec2Count,
      containerCount,
      diff
    ]);
  });
  
  // Sort by resource count difference
  resourceRows.sort((a, b) => b[3] - a[3]);
  
  const resourceTable = createTable(
    ['Resource Type', 'EC2 Count', 'Container Count', 'Difference'],
    resourceRows
  );
  
  console.log(resourceTable);
  
  // Generate recommendations
  console.log('\n🔍 COST OPTIMIZATION RECOMMENDATIONS');
  console.log('==================================');
  
  if (containerCost < ec2Cost) {
    console.log('✅ The container-based architecture is more cost-effective.');
    
    // Find the top services where containers save money
    const topSavings = comparisonRows
      .filter(row => parseFloat(row[3].replace(/[^0-9.-]+/g, '')) < 0)
      .slice(0, 3);
    
    if (topSavings.length > 0) {
      console.log('\nTop savings with containers:');
      topSavings.forEach(row => {
        console.log(`- ${row[0]}: ${row[3]} (${row[4]})`);
      });
    }
  } else {
    console.log('✅ The EC2-based architecture is more cost-effective.');
    
    // Find the top services where EC2 saves money
    const topSavings = comparisonRows
      .filter(row => parseFloat(row[3].replace(/[^0-9.-]+/g, '')) > 0)
      .slice(0, 3);
    
    if (topSavings.length > 0) {
      console.log('\nTop savings with EC2:');
      topSavings.forEach(row => {
        console.log(`- ${row[0]}: ${row[3]} (${row[4]})`);
      });
    }
  }
  
  // Generate specific recommendations
  console.log('\nRecommendations:');
  
  // EC2 recommendations
  if (ec2Analysis.costEstimates?.serviceCosts?.['EC2'] > 0) {
    console.log('- Consider reserved instances for EC2 to save up to 75% compared to on-demand pricing');
  }
  
  // ECS/Fargate recommendations
  if (containerAnalysis.costEstimates?.serviceCosts?.['ECS'] > 0 || containerAnalysis.costEstimates?.serviceCosts?.['Fargate'] > 0) {
    console.log('- Use Fargate Spot for non-critical workloads to save up to 70% on container costs');
    console.log('- Optimize container CPU and memory settings to avoid over-provisioning');
  }
  
  // RDS recommendations
  if (ec2Analysis.costEstimates?.serviceCosts?.['RDS'] > 0 || containerAnalysis.costEstimates?.serviceCosts?.['RDS'] > 0) {
    console.log('- Consider RDS reserved instances for database workloads');
  }
  
  // NAT Gateway recommendations
  if (containerAnalysis.costEstimates?.serviceCosts?.['NAT Gateway'] > 0) {
    console.log('- NAT Gateways are expensive, consider consolidating to one NAT Gateway per AZ');
  }
  
  // S3 recommendations
  if (ec2Analysis.costEstimates?.serviceCosts?.['S3'] > 0 || containerAnalysis.costEstimates?.serviceCosts?.['S3'] > 0) {
    console.log('- Implement S3 lifecycle policies to transition data to cheaper storage tiers');
  }
  
  console.log('\n💡 ADDITIONAL CONSIDERATIONS');
  console.log('=========================');
  console.log('- The container architecture provides better scalability and resource utilization');
  console.log('- The EC2 architecture may provide more control over the infrastructure');
  console.log('- Container deployments typically enable faster CI/CD pipelines and simpler scaling');
  console.log('- Consider operational costs beyond infrastructure (development, maintenance, etc.)');
}

// Run the comparison
compareArchitectures()
  .catch(error => {
    console.error('❌ Error comparing architectures:', error);
    process.exit(1);
  }); 