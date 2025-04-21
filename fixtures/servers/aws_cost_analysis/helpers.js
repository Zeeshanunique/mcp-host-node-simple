/**
 * AWS Cost Analysis Helper Functions
 * 
 * Utility functions to support AWS cost analysis operations
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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