#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('../cdk_analyzer');
const { generateComparisonReport } = require('../report_generator');

// Paths to the templates
const serverlessTemplatePath = path.join(__dirname, 'serverless-template.json');
const ec2TemplatePath = path.join(__dirname, 'ec2-template.json');

// Configuration for analysis
const analysisOptions = {
  region: 'us-east-1',
  duration: 30, // 30 days
  includeDetailedBreakdown: true,
  pricing: {
    useReservedInstances: false, // For EC2 analysis
    lambdaInvocations: 1000000, // 1M invocations per month for serverless
    apiRequests: 1000000, // 1M API requests per month
    dynamoDbReadUnits: 5000000, // 5M read units per month
    dynamoDbWriteUnits: 1000000, // 1M write units per month
    s3Operations: {
      get: 100000,
      put: 10000,
      dataTransferOut: 500 // GB
    },
    ec2Utilization: 0.7, // 70% average CPU utilization
    rdsUtilization: 0.6 // 60% average utilization
  }
};

async function main() {
  try {
    console.log('Analyzing Serverless Template...');
    const serverlessAnalysis = await analyzeCdkStack(serverlessTemplatePath, analysisOptions);
    
    console.log('Analyzing EC2 Template...');
    const ec2Analysis = await analyzeCdkStack(ec2TemplatePath, analysisOptions);
    
    // Generate comparison report
    const comparisonReport = generateComparisonReport({
      serverless: serverlessAnalysis,
      ec2: ec2Analysis,
      options: analysisOptions
    });
    
    // Write reports to files
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'serverless-analysis.json'), 
      JSON.stringify(serverlessAnalysis, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'ec2-analysis.json'), 
      JSON.stringify(ec2Analysis, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'comparison-report.md'), 
      comparisonReport
    );
    
    console.log('Analysis complete! Reports generated in the output directory.');
    console.log(`Total Monthly Cost (Serverless): $${serverlessAnalysis.totalCost.toFixed(2)}`);
    console.log(`Total Monthly Cost (EC2-based): $${ec2Analysis.totalCost.toFixed(2)}`);
    console.log(`Difference: $${Math.abs(serverlessAnalysis.totalCost - ec2Analysis.totalCost).toFixed(2)}`);
    console.log(`Percentage Difference: ${((Math.abs(serverlessAnalysis.totalCost - ec2Analysis.totalCost) / 
      Math.max(serverlessAnalysis.totalCost, ec2Analysis.totalCost)) * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

main(); 