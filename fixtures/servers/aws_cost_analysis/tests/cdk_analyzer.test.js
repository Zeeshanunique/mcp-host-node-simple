/**
 * Tests for the CDK analyzer module
 */

const fs = require('fs');
const path = require('path');
const { 
  analyzeCdkStack,
  getStackName,
  extractResources,
  countResourcesByType,
  extractServicesFromResources
} = require('../cdk_analyzer');

// Mock the fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn()
}));

describe('CDK Analyzer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });
  
  const mockTemplate = {
    Resources: {
      LambdaFunction1: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          FunctionName: 'test-function-1',
          Runtime: 'nodejs14.x',
          MemorySize: 128,
          Timeout: 30
        }
      },
      ApiGateway: {
        Type: 'AWS::ApiGateway::RestApi',
        Properties: {
          Name: 'TestAPI'
        }
      },
      S3Bucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'test-bucket'
        }
      },
      DynamoTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: 'TestTable',
          BillingMode: 'PAY_PER_REQUEST'
        }
      }
    }
  };
  
  describe('getStackName', () => {
    it('should extract stack name from template path', () => {
      const templatePath = '/path/to/ServerlessStack.template.json';
      const stackName = getStackName(templatePath);
      expect(stackName).toBe('ServerlessStack');
    });
    
    it('should handle paths with multiple dots', () => {
      const templatePath = '/path/to/Serverless.Stack.v1.template.json';
      const stackName = getStackName(templatePath);
      expect(stackName).toBe('Serverless.Stack.v1');
    });
  });
  
  describe('extractResources', () => {
    it('should extract resources from template', () => {
      const resources = extractResources(mockTemplate);
      
      expect(resources).toHaveProperty('AWS::Lambda::Function');
      expect(resources).toHaveProperty('AWS::ApiGateway::RestApi');
      expect(resources).toHaveProperty('AWS::S3::Bucket');
      expect(resources).toHaveProperty('AWS::DynamoDB::Table');
      
      expect(resources['AWS::Lambda::Function']).toHaveLength(1);
      expect(resources['AWS::ApiGateway::RestApi']).toHaveLength(1);
      expect(resources['AWS::S3::Bucket']).toHaveLength(1);
      expect(resources['AWS::DynamoDB::Table']).toHaveLength(1);
      
      expect(resources['AWS::Lambda::Function'][0]).toEqual({
        LogicalId: 'LambdaFunction1',
        Properties: {
          FunctionName: 'test-function-1',
          Runtime: 'nodejs14.x',
          MemorySize: 128,
          Timeout: 30
        }
      });
    });
    
    it('should handle empty template', () => {
      const resources = extractResources({});
      expect(resources).toEqual({});
    });
  });
  
  describe('countResourcesByType', () => {
    it('should count resources by type', () => {
      const resources = {
        'AWS::Lambda::Function': [{ LogicalId: 'Lambda1' }, { LogicalId: 'Lambda2' }],
        'AWS::S3::Bucket': [{ LogicalId: 'Bucket1' }]
      };
      
      const counts = countResourcesByType(resources);
      
      expect(counts).toEqual({
        'AWS::Lambda::Function': 2,
        'AWS::S3::Bucket': 1
      });
    });
    
    it('should handle empty resources', () => {
      const counts = countResourcesByType({});
      expect(counts).toEqual({});
    });
  });
  
  describe('extractServicesFromResources', () => {
    it('should extract AWS services from resource types', () => {
      const resources = {
        'AWS::Lambda::Function': [{}],
        'AWS::ApiGateway::RestApi': [{}],
        'AWS::S3::Bucket': [{}],
        'AWS::DynamoDB::Table': [{}]
      };
      
      const services = extractServicesFromResources(resources);
      
      expect(services).toContain('Lambda');
      expect(services).toContain('API Gateway');
      expect(services).toContain('S3');
      expect(services).toContain('DynamoDB');
      expect(services).toHaveLength(4);
    });
    
    it('should handle unknown resource types', () => {
      const resources = {
        'AWS::Unknown::Resource': [{}]
      };
      
      const services = extractServicesFromResources(resources);
      expect(services).toHaveLength(0);
    });
  });
  
  describe('analyzeCdkStack', () => {
    it('should analyze CDK stack template and return complete analysis', () => {
      const templatePath = '/path/to/template.json';
      
      // Mock the file system functions
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      
      const result = analyzeCdkStack(templatePath);
      
      expect(result).toHaveProperty('stackName');
      expect(result).toHaveProperty('template');
      expect(result).toHaveProperty('resources');
      expect(result).toHaveProperty('resourceCounts');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('totalEstimatedCost');
      expect(result).toHaveProperty('estimatedCostBreakdown');
      
      expect(result.services).toContain('Lambda');
      expect(result.services).toContain('API Gateway');
      expect(result.services).toContain('S3');
      expect(result.services).toContain('DynamoDB');
      
      expect(result.resourceCounts).toEqual({
        'AWS::Lambda::Function': 1,
        'AWS::ApiGateway::RestApi': 1,
        'AWS::S3::Bucket': 1,
        'AWS::DynamoDB::Table': 1
      });
    });
    
    it('should handle template not found', () => {
      const templatePath = '/path/to/nonexistent.json';
      
      // Mock the file system functions
      fs.existsSync.mockReturnValue(false);
      
      const result = analyzeCdkStack(templatePath);
      
      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Template file not found');
    });
    
    it('should handle invalid JSON template', () => {
      const templatePath = '/path/to/invalid.json';
      
      // Mock the file system functions
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('invalid json');
      
      const result = analyzeCdkStack(templatePath);
      
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Failed to parse template');
    });
    
    it('should respect custom name option', () => {
      const templatePath = '/path/to/template.json';
      const options = { name: 'CustomName' };
      
      // Mock the file system functions
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      
      const result = analyzeCdkStack(templatePath, options);
      
      expect(result.name).toBe('CustomName');
    });
  });
}); 