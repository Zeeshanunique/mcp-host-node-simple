/**
 * AWS Cost Analysis Helper Functions
 * 
 * Utility functions to support AWS cost analysis operations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Format a number as a currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency symbol to use
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount, currency = '$') {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Format a number as a percentage
 * @param {number} value - The value to format
 * @returns {string} - Formatted percentage string
 */
function formatPercentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Get AWS profile from environment variables or default
 * @returns {string} - AWS profile name
 */
function getAwsProfile() {
  return process.env.AWS_PROFILE || 'default';
}

/**
 * Execute an AWS CLI command
 * @param {string} command - AWS command to execute
 * @returns {string} - Command output
 */
function executeAwsCommand(command) {
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
function readJsonFile(filePath) {
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
function writeJsonFile(filePath, data) {
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
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get temporary directory path
 * @returns {string} - Path to the temporary directory
 */
function getTempDir() {
  const tempDir = path.join(process.cwd(), 'tmp');
  ensureDirectoryExists(tempDir);
  return tempDir;
}

module.exports = {
  formatCurrency,
  formatPercentage,
  getAwsProfile,
  executeAwsCommand,
  readJsonFile,
  writeJsonFile,
  ensureDirectoryExists,
  getTempDir
}; 