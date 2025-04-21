#!/usr/bin/env node

/**
 * AWS Cost Analysis CLI
 * Command-line interface for analyzing CDK stacks and estimating costs
 */

import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import { analyzeCdkStack } from './cdk_analyzer.js';
import { generateCostReport, generateCostSummary } from './report_generator.js';
import { formatCurrency } from './helpers.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up the CLI
program
  .name('aws-cost-analyzer')
  .description('Analyze AWS CDK stacks and estimate costs')
  .version('1.0.0');

// analyze command
program
  .command('analyze')
  .description('Analyze a CDK stack template and estimate costs')
  .argument('<template>', 'Path to the CDK stack template JSON file')
  .option('-o, --output <file>', 'Output file for the analysis results (JSON)')
  .option('-r, --report <file>', 'Generate a cost report (Markdown)')
  .option('-a, --assumptions <file>', 'JSON file with usage assumptions')
  .option('-f, --free-tier', 'Apply free tier discounts', true)
  .option('-t, --include-template', 'Include the template in the output', false)
  .option('-s, --summary', 'Print a summary to the console', true)
  .action(async (template, options) => {
    try {
      const spinner = ora('Analyzing CDK stack...').start();
      
      // Check if template exists
      try {
        await fs.access(template);
      } catch (error) {
        spinner.fail(`Template file not found: ${template}`);
        process.exit(1);
      }
      
      // Read usage assumptions if provided
      let usageAssumptions = {};
      if (options.assumptions) {
        try {
          const assumptionsContent = await fs.readFile(options.assumptions, 'utf8');
          usageAssumptions = JSON.parse(assumptionsContent);
          spinner.text = 'Using custom usage assumptions...';
        } catch (error) {
          spinner.warn(`Could not read assumptions file: ${error.message}`);
        }
      }
      
      // Analyze the stack
      const analysisResults = await analyzeCdkStack(template, {
        applyFreeTier: options.freeTier,
        includeTemplate: options.includeTemplate,
        usageAssumptions
      });
      
      if (analysisResults.error) {
        spinner.fail(`Analysis failed: ${analysisResults.error}`);
        process.exit(1);
      }
      
      spinner.succeed('CDK stack analyzed successfully');
      
      // Save analysis results if requested
      if (options.output) {
        const outputPath = options.output;
        await fs.writeFile(outputPath, JSON.stringify(analysisResults, null, 2), 'utf8');
        console.log(`Analysis results saved to ${chalk.cyan(outputPath)}`);
      }
      
      // Generate cost report if requested
      if (options.report) {
        const reportSpinner = ora('Generating cost report...').start();
        const reportPath = options.report;
        
        const reportResult = await generateCostReport(analysisResults, {
          outputFormat: 'markdown',
          includeFreeTier: options.freeTier,
          outputDir: path.dirname(reportPath),
          fileName: path.basename(reportPath)
        });
        
        if (reportResult.success) {
          reportSpinner.succeed(`Cost report generated at ${chalk.cyan(reportPath)}`);
        } else {
          reportSpinner.fail(`Failed to generate report: ${reportResult.error}`);
        }
      }
      
      // Print summary
      if (options.summary) {
        printSummary(analysisResults);
      }
    } catch (error) {
      ora().fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// report command
program
  .command('report')
  .description('Generate a cost report from analysis results')
  .argument('<analysis-file>', 'Path to the analysis results JSON file')
  .option('-o, --output <file>', 'Output file for the report')
  .option('-f, --format <format>', 'Report format (markdown)', 'markdown')
  .action(async (analysisFile, options) => {
    try {
      const spinner = ora('Generating cost report...').start();
      
      // Read analysis results
      let analysisResults;
      try {
        const analysisContent = await fs.readFile(analysisFile, 'utf8');
        analysisResults = JSON.parse(analysisContent);
      } catch (error) {
        spinner.fail(`Could not read analysis file: ${error.message}`);
        process.exit(1);
      }
      
      // Determine output file
      const outputFile = options.output || `aws-cost-report-${Date.now()}.md`;
      
      // Generate report
      const reportResult = await generateCostReport(analysisResults, {
        outputFormat: options.format,
        outputDir: path.dirname(outputFile),
        fileName: path.basename(outputFile)
      });
      
      if (reportResult.success) {
        spinner.succeed(`Cost report generated at ${chalk.cyan(outputFile)}`);
      } else {
        spinner.fail(`Failed to generate report: ${reportResult.error}`);
        process.exit(1);
      }
    } catch (error) {
      ora().fail(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Print a summary of the analysis results
 * @param {Object} analysisResults Analysis results
 */
function printSummary(analysisResults) {
  console.log('\n' + chalk.bold.blue('AWS CDK Stack Analysis Summary'));
  console.log(chalk.dim('─'.repeat(50)));
  
  // Stack info
  console.log(`${chalk.cyan('Stack Name:')} ${analysisResults.stackName}`);
  console.log(`${chalk.cyan('Services:')} ${analysisResults.services.length}`);
  console.log(`${chalk.cyan('Resources:')} ${Object.values(analysisResults.resourceCounts).reduce((a, b) => a + b, 0)}`);
  
  // Cost summary
  let totalMonthlyCost = 0;
  Object.values(analysisResults.costEstimates).forEach(estimate => {
    if (estimate.monthly_cost && typeof estimate.monthly_cost === 'number') {
      totalMonthlyCost += estimate.monthly_cost;
    }
  });
  
  console.log(chalk.dim('─'.repeat(50)));
  console.log(`${chalk.cyan('Estimated Monthly Cost:')} ${chalk.yellow(formatCurrency(totalMonthlyCost))}`);
  console.log(`${chalk.cyan('Estimated Annual Cost:')} ${chalk.yellow(formatCurrency(totalMonthlyCost * 12))}`);
  
  // Service breakdown
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.bold('Service Cost Breakdown:'));
  
  // Sort services by cost
  const servicesByCost = analysisResults.services
    .map(service => ({
      name: service,
      cost: analysisResults.costEstimates[service]?.monthly_cost || 0
    }))
    .sort((a, b) => b.cost - a.cost);
  
  // Display services and costs
  servicesByCost.forEach(service => {
    const percentage = totalMonthlyCost > 0 
      ? ((service.cost / totalMonthlyCost) * 100).toFixed(1) 
      : 0;
    
    console.log(
      `${chalk.green(service.name.padEnd(15))} ${formatCurrency(service.cost).padStart(10)} ${chalk.dim(`(${percentage}%)`)}`
    );
  });
  
  console.log(chalk.dim('─'.repeat(50)));
}

// Parse command line arguments
program.parse();

// If no arguments provided, show help
if (process.argv.length <= 2) {
  program.help();
} 