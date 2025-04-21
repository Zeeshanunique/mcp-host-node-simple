#!/usr/bin/env node

/**
 * Sample script to demonstrate usage of the CDK analyzer
 * 
 * This script analyzes both serverless and EC2-based templates
 * and generates a comparative cost report
 */

const path = require('path');
const fs = require('fs');
const { analyzeCdkStack } = require('../cdk_analyzer');
const { generateComparisonReport } = require('../report_generator');

// Define paths to our templates
const SERVERLESS_TEMPLATE_PATH = path.join(__dirname, 'serverless-template.json');
const EC2_TEMPLATE_PATH = path.join(__dirname, 'ec2-template.json');
const OUTPUT_REPORT_PATH = path.join(__dirname, 'cost-comparison-report.md');

// Options for analysis
const analysisOptions = {
  region: 'us-east-1',
  includeUsageBreakdown: true,
  usageScenarios: {
    apiRequests: 1000000, // 1 million API requests per month
    lambdaExecutions: 1000000, // 1 million Lambda executions per month
    lambdaAvgDuration: 500, // 500ms average duration
    s3Storage: 50, // 50 GB storage
    s3Requests: 500000, // 500,000 requests per month
    dynamoDbStorage: 10, // 10 GB storage
    dynamoDbReadUnits: 5, // 5 read capacity units
    dynamoDbWriteUnits: 5, // 5 write capacity units
    ec2RunningHours: 730, // 24/7 running for a month
    rdsStorage: 20, // 20 GB storage
    rdsMultiAZ: true,
    elbDataProcessed: 100 // 100 GB processed per month
  }
};

async function main() {
  try {
    console.log('Analyzing Serverless Template...');
    const serverlessAnalysis = await analyzeCdkStack(SERVERLESS_TEMPLATE_PATH, analysisOptions);
    console.log(`Serverless Analysis Complete. Estimated Monthly Cost: $${serverlessAnalysis.estimatedCost.totalCost.toFixed(2)}`);
    
    console.log('\nAnalyzing EC2-Based Template...');
    const ec2Analysis = await analyzeCdkStack(EC2_TEMPLATE_PATH, analysisOptions);
    console.log(`EC2 Analysis Complete. Estimated Monthly Cost: $${ec2Analysis.estimatedCost.totalCost.toFixed(2)}`);
    
    // Generate a comparison report
    console.log('\nGenerating comparison report...');
    const comparisonReport = generateComparisonReport({
      title: 'Serverless vs EC2-Based Architecture Cost Comparison',
      architectures: [
        {
          name: 'Serverless Architecture',
          analysis: serverlessAnalysis,
          description: 'Serverless architecture using Lambda, API Gateway, DynamoDB, and S3'
        },
        {
          name: 'EC2-Based Architecture',
          analysis: ec2Analysis,
          description: 'Traditional EC2-based architecture using EC2, ELB, RDS, and S3'
        }
      ],
      usageScenario: 'Medium traffic web application',
      recommendations: true
    });
    
    fs.writeFileSync(OUTPUT_REPORT_PATH, comparisonReport);
    console.log(`Comparison report generated at: ${OUTPUT_REPORT_PATH}`);
    
  } catch (error) {
    console.error('Error during analysis:', error);
    process.exit(1);
  }
}

main(); 