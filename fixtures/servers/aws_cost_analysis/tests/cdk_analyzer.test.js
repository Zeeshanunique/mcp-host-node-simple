/**
 * Tests for the CDK Stack Analyzer module
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { analyzeCdkStack } from '../cdk_analyzer.js';
import { readPricingPatterns } from '../helpers.js';
import { calculateAllServiceCosts } from '../price_calculator.js';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../helpers.js');
jest.mock('../price_calculator.js');

describe('CDK Stack Analyzer', () => {
  // Sample template for testing
  const mockTemplate = {
    Description: 'AWS CloudFormation template for MyService Stack',
    Resources: {
      MyLambdaFunction: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Handler: 'index.handler',
          Runtime: 'nodejs18.x',
          MemorySize: 512
        }
      },
      MyS3Bucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'my-test-bucket'
        }
      },
      MyDynamoDBTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: 'my-test-table',
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    }
  };

  const mockTemplateString = JSON.stringify(mockTemplate);
  const mockTemplatePath = 'path/to/template.json';
  
  // Set up mocks
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock file reading
    fs.readFile.mockResolvedValue(mockTemplateString);
    
    // Mock pricing patterns
    readPricingPatterns.mockResolvedValue({
      Lambda: { price_per_request: 0.0000002, price_per_gb_second: 0.0000166667 },
      S3: { price_per_gb_storage: 0.023, price_per_request: 0.0000004 },
      DynamoDB: { price_per_rcu: 0.00000125, price_per_wcu: 0.00000125 }
    });
    
    // Mock cost calculation
    calculateAllServiceCosts.mockReturnValue({
      Lambda: { monthly: 10, yearly: 120 },
      S3: { monthly: 5, yearly: 60 },
      DynamoDB: { monthly: 15, yearly: 180 }
    });
  });

  test('analyzeCdkStack should return analysis results for a valid template', async () => {
    const result = await analyzeCdkStack(mockTemplatePath);
    
    // Verify file was read
    expect(fs.readFile).toHaveBeenCalledWith(mockTemplatePath, 'utf8');
    
    // Verify pricing patterns were loaded
    expect(readPricingPatterns).toHaveBeenCalled();
    
    // Verify cost calculation was called
    expect(calculateAllServiceCosts).toHaveBeenCalled();
    
    // Test result structure
    expect(result).toHaveProperty('stackName', 'MyService');
    expect(result).toHaveProperty('services');
    expect(result).toHaveProperty('resourceCounts');
    expect(result).toHaveProperty('costEstimates');
    expect(result).toHaveProperty('usageDetails');
    expect(result).toHaveProperty('analysisTimestamp');
    
    // Verify resource counts
    expect(result.resourceCounts['AWS::Lambda::Function']).toBe(1);
    expect(result.resourceCounts['AWS::S3::Bucket']).toBe(1);
    expect(result.resourceCounts['AWS::DynamoDB::Table']).toBe(1);
    
    // Verify services list
    expect(result.services).toContain('Lambda');
    expect(result.services).toContain('S3');
    expect(result.services).toContain('DynamoDB');
    
    // Verify cost estimates
    expect(result.costEstimates.Lambda.monthly).toBe(10);
    expect(result.costEstimates.S3.monthly).toBe(5);
    expect(result.costEstimates.DynamoDB.monthly).toBe(15);
  });

  test('analyzeCdkStack should handle errors gracefully', async () => {
    // Set up the mock to throw an error
    fs.readFile.mockRejectedValue(new Error('File not found'));
    
    const result = await analyzeCdkStack(mockTemplatePath);
    
    // Verify error response
    expect(result.success).toBe(false);
    expect(result.error).toBe('File not found');
  });

  test('analyzeCdkStack should include template when requested', async () => {
    const result = await analyzeCdkStack(mockTemplatePath, { includeTemplate: true });
    
    // Verify template is included
    expect(result.template).toEqual(mockTemplate);
  });

  test('analyzeCdkStack should respect usage assumptions', async () => {
    const options = {
      usageAssumptions: {
        Lambda: {
          avg_monthly_requests: 500000,
          avg_memory_mb: 1024
        }
      }
    };
    
    await analyzeCdkStack(mockTemplatePath, options);
    
    // Verify that calculateAllServiceCosts was called with the overridden usage assumptions
    const callArgs = calculateAllServiceCosts.mock.calls[0];
    
    // Extract the usage details passed to calculateAllServiceCosts
    const [, usageDetails] = callArgs;
    
    // Check that our assumptions were used
    expect(usageDetails.Lambda.avg_monthly_requests).toBe(500000);
  });

  test('analyzeCdkStack should handle templates without resources', async () => {
    // Mock an empty template
    const emptyTemplate = { Description: 'Empty Stack' };
    fs.readFile.mockResolvedValue(JSON.stringify(emptyTemplate));
    
    const result = await analyzeCdkStack(mockTemplatePath);
    
    // Verify empty resources
    expect(result.resourceCounts).toEqual({});
    expect(result.services).toEqual([]);
  });
}); 