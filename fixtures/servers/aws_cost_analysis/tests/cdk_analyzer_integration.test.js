/**
 * Integration tests for the CDK Stack Analyzer module
 * Using actual template files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeCdkStack } from '../cdk_analyzer.js';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to example templates
const EXAMPLES_DIR = path.join(__dirname, '..', 'examples');
const SERVERLESS_TEMPLATE = path.join(EXAMPLES_DIR, 'serverless-template.json');
const EC2_TEMPLATE = path.join(EXAMPLES_DIR, 'ec2-template.json');

// Skip tests if files don't exist
const runTest = async (testFn) => {
  try {
    // Check if template files exist
    await fs.access(SERVERLESS_TEMPLATE);
    await fs.access(EC2_TEMPLATE);
    return testFn();
  } catch (error) {
    console.warn(`Skipping test: ${error.message}`);
    return test.skip('Test skipped: template files not found', () => {});
  }
};

describe('CDK Stack Analyzer Integration Tests', () => {
  runTest(() => {
    test('should analyze serverless template correctly', async () => {
      // Analyze the serverless template
      const result = await analyzeCdkStack(SERVERLESS_TEMPLATE);
      
      // Check basic structure
      expect(result).toHaveProperty('stackName');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('resourceCounts');
      expect(result).toHaveProperty('costEstimates');
      expect(result).toHaveProperty('usageDetails');
      
      // Verify expected services
      expect(result.services).toContain('Lambda');
      expect(result.services).toContain('API Gateway');
      expect(result.services).toContain('DynamoDB');
      expect(result.services).toContain('S3');
      
      // Verify resource counts
      expect(result.resourceCounts['AWS::Lambda::Function']).toBeGreaterThanOrEqual(1);
      expect(result.resourceCounts['AWS::ApiGateway::RestApi']).toBeGreaterThanOrEqual(1);
      expect(result.resourceCounts['AWS::DynamoDB::Table']).toBeGreaterThanOrEqual(1);
      expect(result.resourceCounts['AWS::S3::Bucket']).toBeGreaterThanOrEqual(1);
      
      // Verify cost estimates structure
      Object.values(result.costEstimates).forEach(costItem => {
        expect(costItem).toHaveProperty('monthly');
        expect(typeof costItem.monthly).toBe('number');
      });
    });
    
    test('should analyze EC2 template correctly', async () => {
      // Analyze the EC2 template
      const result = await analyzeCdkStack(EC2_TEMPLATE);
      
      // Check basic structure
      expect(result).toHaveProperty('stackName');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('resourceCounts');
      expect(result).toHaveProperty('costEstimates');
      expect(result).toHaveProperty('usageDetails');
      
      // Verify expected services
      expect(result.services).toContain('EC2');
      expect(result.services).toContain('IAM');
      
      // Verify resource counts
      expect(result.resourceCounts['AWS::EC2::Instance']).toBeGreaterThanOrEqual(1);
      
      // Verify EC2-specific usage details
      expect(result.usageDetails.EC2).toHaveProperty('instance_count');
      expect(result.usageDetails.EC2).toHaveProperty('instance_type');
      expect(result.usageDetails.EC2).toHaveProperty('usage_hours');
      
      // Verify cost estimates structure
      expect(result.costEstimates.EC2).toHaveProperty('monthly');
      expect(typeof result.costEstimates.EC2.monthly).toBe('number');
    });
    
    test('should apply usage assumptions correctly', async () => {
      // Define custom usage assumptions
      const options = {
        usageAssumptions: {
          Lambda: {
            avg_monthly_requests: 1000000,
            avg_memory_size: 1024
          },
          S3: {
            storage_gb: 500,
            monthly_get_requests: 5000000,
            monthly_put_requests: 1000000
          }
        }
      };
      
      // Analyze with custom assumptions
      const result = await analyzeCdkStack(SERVERLESS_TEMPLATE, options);
      
      // Verify the assumptions were applied
      expect(result.usageDetails.Lambda.avg_monthly_requests).toBe(1000000);
      expect(result.usageDetails.S3.storage_gb).toBe(500);
    });
    
    test('should return template content when requested', async () => {
      // Analyze with includeTemplate option
      const result = await analyzeCdkStack(SERVERLESS_TEMPLATE, { includeTemplate: true });
      
      // Verify template is included
      expect(result.template).toBeTruthy();
      expect(result.template).toHaveProperty('Resources');
      expect(result.template).toHaveProperty('Description');
    });
    
    test('should handle invalid template path gracefully', async () => {
      // Analyze with non-existent template
      const result = await analyzeCdkStack('/path/to/nonexistent/template.json');
      
      // Verify error response
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
  
  // Additional test for performance
  runTest(() => {
    test('should complete analysis in reasonable time', async () => {
      const startTime = Date.now();
      
      // Analyze both templates
      await analyzeCdkStack(SERVERLESS_TEMPLATE);
      await analyzeCdkStack(EC2_TEMPLATE);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Analysis should complete in less than 1 second for each template
      expect(duration).toBeLessThan(2000);
    });
  });
}); 