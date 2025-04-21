/**
 * AWS Cost Analysis Helper Functions
 * 
 * Utility functions to support AWS cost analysis operations
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Format a number as a currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency symbol to use
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, currency = '$') {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Format a number as a percentage
 * @param {number} value - The value to format
 * @returns {string} - Formatted percentage string
 */
export function formatPercentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Get AWS profile from environment variables or default
 * @returns {string} - AWS profile name
 */
export function getAwsProfile() {
  return process.env.AWS_PROFILE || 'default';
}

/**
 * Execute an AWS CLI command
 * @param {string} command - AWS command to execute
 * @returns {string} - Command output
 */
export function executeAwsCommand(command) {
  try {
    const profile = getAwsProfile();
    const fullCommand = `aws ${command} --profile ${profile}`;
    return execSync(fullCommand, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Error executing AWS command: ${error.message}`);
    throw error;
  }
}

/**
 * Read JSON file
 * @param {string} filePath - Path to the JSON file
 * @returns {Object} - Parsed JSON object
 */
export function readJsonFile(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading JSON file ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * Write JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {Object} data - Data to write
 */
export function writeJsonFile(filePath, data) {
  try {
    const fullPath = path.resolve(filePath);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing JSON file ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure a directory exists
 * @param {string} dirPath - Path to the directory
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get temporary directory path
 * @returns {string} - Path to the temporary directory
 */
export function getTempDir() {
  const tempDir = path.join(process.cwd(), 'tmp');
  ensureDirectoryExists(tempDir);
  return tempDir;
}

/**
 * Read the AWS cost patterns from patterns.json
 * @returns {Promise<Array>} Pricing patterns
 */
export async function readPricingPatterns() {
  try {
    const patternsPath = path.join(__dirname, 'patterns.json');
    const fileContent = await fs.promises.readFile(patternsPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.warn(`Warning: Could not read patterns.json. Error: ${error.message}`);
    return [];
  }
}

/**
 * Load a template file from the templates directory
 * @param {string} templateName - Name of the template file
 * @returns {Promise<string>} Template content
 */
export async function loadTemplate(templateName) {
  try {
    const templatePath = path.join(__dirname, 'templates', templateName);
    return await fs.promises.readFile(templatePath, 'utf8');
  } catch (error) {
    console.error(`Error loading template ${templateName}: ${error.message}`);
    throw new Error(`Failed to load template: ${error.message}`);
  }
}

/**
 * Save content to a file
 * @param {string} filePath - Path to save the file
 * @param {string} content - Content to save
 * @returns {Promise<string>} Path to the saved file
 */
export async function saveToFile(filePath, content) {
  try {
    // Ensure the directory exists
    const directory = path.dirname(filePath);
    await fs.promises.mkdir(directory, { recursive: true });
    
    // Write the content to the file
    await fs.promises.writeFile(filePath, content, 'utf8');
    
    return filePath;
  } catch (error) {
    console.error(`Error saving file to ${filePath}: ${error.message}`);
    throw new Error(`Failed to save file: ${error.message}`);
  }
}

/**
 * Calculate projected growth in costs over time
 * @param {number} baseCost - Initial cost
 * @param {number} growthRate - Annual growth rate
 * @param {number} years - Number of years to project
 * @returns {Array} Yearly projected costs
 */
export function calculateGrowthProjection(baseCost, growthRate, years = 3) {
  const projections = [];
  let currentCost = baseCost;
  
  for (let i = 0; i < years; i++) {
    projections.push({
      year: i + 1,
      monthly: currentCost,
      annually: currentCost * 12
    });
    
    currentCost *= (1 + growthRate);
  }
  
  return projections;
}

/**
 * Helper utilities for AWS Cost Analysis
 */

/**
 * Format a number with commas for thousands
 * @param {number} num Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Calculate percentage change between two values
 * @param {number} current Current value
 * @param {number} previous Previous value
 * @returns {number} Percentage change
 */
function calculatePercentageChange(current, previous) {
  if (previous === 0) return current > 0 ? 1 : 0;
  return (current - previous) / previous;
}

/**
 * Generate a report from a template and data
 * @param {string} templatePath Path to the report template
 * @param {Object} data Data to populate the template with
 * @returns {string} Generated report
 */
function generateReport(templatePath, data) {
  try {
    const template = fs.readFileSync(templatePath, 'utf8');
    let report = template;
    
    // Replace placeholders with actual data
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      report = report.replace(placeholder, value);
    });
    
    return report;
  } catch (error) {
    console.error(`Error generating report: ${error.message}`);
    return null;
  }
}

/**
 * Generate a markdown report from cost comparison results
 * @param {Object} comparisonResults Results from architecture comparison
 * @returns {string} Markdown report
 */
function generateComparisonReport(comparisonResults) {
  const { stacks, comparisonMetrics, conclusion } = comparisonResults;
  
  if (!stacks || stacks.length === 0) {
    return "No comparison data available.";
  }

  // Get the template
  const templatePath = path.join(__dirname, 'templates', 'report-template.markdown');
  
  // Prepare data for the template
  const reportData = {
    title: `Cost Comparison Report: ${stacks.map(s => s.name).join(' vs ')}`,
    date: new Date().toLocaleDateString(),
    architectureNames: stacks.map(s => s.name).join(', '),
    
    // Cost summary
    totalCostComparison: stacks.map(s => 
      `${s.name}: $${formatCurrency(s.analysis.estimatedCost.monthlyCost)} per month`
    ).join('\n'),
    
    // Metrics comparison
    metricsComparison: comparisonMetrics.map(metric => {
      const metricRows = stacks.map(stack => 
        `| ${stack.name} | ${typeof metric[stack.name] === 'number' ? 
          (metric.name.toLowerCase().includes('cost') ? 
            '$' + formatCurrency(metric[stack.name]) : 
            formatNumber(metric[stack.name])
          ) : 
          metric[stack.name] || 'N/A'} |`
      ).join('\n');
      
      return `### ${metric.name}\n${metric.description}\n\n| Architecture | ${metric.name} |\n|-------------|-------------:|\n${metricRows}`;
    }).join('\n\n'),
    
    // Service breakdown
    serviceBreakdown: stacks.map(stack => {
      const services = stack.analysis.serviceCosts
        .sort((a, b) => b.monthlyCost - a.monthlyCost)
        .map(service => 
          `| ${service.service} | $${formatCurrency(service.monthlyCost)} | ${formatPercentage(service.monthlyCost / stack.analysis.estimatedCost.monthlyCost)} |`
        ).join('\n');
        
      return `### ${stack.name} Services\n\n| Service | Monthly Cost | % of Total |\n|---------|------------:|----------:|\n${services}`;
    }).join('\n\n'),
    
    // Resource details
    resourceDetails: stacks.map(stack => {
      const resources = Object.entries(stack.analysis.resourceCounts || {})
        .sort(([, a], [, b]) => b - a)
        .map(([type, count]) => `| ${type} | ${count} |`)
        .join('\n');
        
      return `### ${stack.name} Resources\n\n| Resource Type | Count |\n|--------------|------:|\n${resources}`;
    }).join('\n\n'),
    
    // Cost optimization recommendations
    optimizationRecommendations: stacks.map(stack => {
      const recommendations = stack.analysis.recommendations || [];
      
      if (recommendations.length === 0) {
        return `### ${stack.name}\nNo specific optimization recommendations identified.`;
      }
      
      const recList = recommendations
        .map(rec => `- **${rec.title}**: ${rec.description}`)
        .join('\n');
        
      return `### ${stack.name}\n${recList}`;
    }).join('\n\n'),
    
    // Conclusion
    conclusion
  };
  
  return generateReport(templatePath, reportData);
}

/**
 * Convert a markdown report to HTML
 * @param {string} markdown Markdown content
 * @returns {string} HTML content
 */
function markdownToHtml(markdown) {
  return marked(markdown);
}

/**
 * Parse a template file (JSON or YAML)
 * @param {string} templatePath Path to template file
 * @returns {Object} Parsed template
 */
function parseTemplateFile(templatePath) {
  try {
    const content = fs.readFileSync(templatePath, 'utf8');
    
    // Determine file type from extension
    const ext = path.extname(templatePath).toLowerCase();
    
    if (ext === '.json') {
      return JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
      // Assume yaml module is available
      // If not, you'll need to add it as a dependency
      const yaml = require('js-yaml');
      return yaml.load(content);
    } else {
      throw new Error(`Unsupported template format: ${ext}`);
    }
  } catch (error) {
    console.error(`Error parsing template file: ${error.message}`);
    return null;
  }
}

/**
 * Get list of available template files
 * @param {string} templatesDir Directory containing templates
 * @returns {Array} List of template files
 */
function getAvailableTemplates(templatesDir = path.join(__dirname, 'templates')) {
  try {
    const files = fs.readdirSync(templatesDir);
    
    return files
      .filter(file => file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml'))
      .map(file => ({
        name: file.replace(/\.(json|yaml|yml)$/, ''),
        path: path.join(templatesDir, file),
        type: path.extname(file).substring(1)
      }));
  } catch (error) {
    console.error(`Error reading templates directory: ${error.message}`);
    return [];
  }
}

module.exports = {
  formatCurrency,
  formatNumber,
  formatPercentage,
  calculatePercentageChange,
  generateReport,
  generateComparisonReport,
  markdownToHtml,
  parseTemplateFile,
  getAvailableTemplates
}; 