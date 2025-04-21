/**
 * Cost Optimization Recommendation Generator
 * 
 * This module analyzes AWS resources and generates cost optimization
 * recommendations based on common best practices and usage patterns.
 */

/**
 * Generate optimization recommendations for a single architecture
 * 
 * @param {Object} analysisResults - The analysis results
 * @returns {Array} List of recommendations
 */
function generateRecommendations(analysisResults) {
  const recommendations = [];
  
  // Extract resources and service costs for analysis
  const { resources, serviceCosts, metrics } = analysisResults;
  
  // Check for idle or underutilized EC2 instances
  if (resources.EC2Instance && resources.EC2Instance.length > 0) {
    const ec2Resources = resources.EC2Instance;
    
    // Check for oversized instances
    const oversizedInstances = ec2Resources.filter(resource => {
      const instanceType = resource.Properties?.InstanceType;
      // Consider larger instances potentially oversized (simplified logic)
      return instanceType && (
        instanceType.startsWith('m5.4xl') || 
        instanceType.startsWith('c5.4xl') || 
        instanceType.startsWith('r5.4xl') ||
        instanceType.includes('8xl') ||
        instanceType.includes('12xl') ||
        instanceType.includes('16xl') ||
        instanceType.includes('24xl') ||
        instanceType.includes('metal')
      );
    });
    
    if (oversizedInstances.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'EC2',
        impact: 'HIGH',
        title: 'Potential EC2 instance right-sizing opportunity',
        description: `${oversizedInstances.length} EC2 instances may be oversized for their workload. Consider using AWS Compute Optimizer to right-size instances.`,
        resources: oversizedInstances.map(r => r.LogicalId),
        estimatedSavings: calculateRightSizingSavings(oversizedInstances),
        implementation: 'Analyze instance utilization with CloudWatch metrics and AWS Compute Optimizer, then downsize instances that consistently show low CPU/memory usage.'
      });
    }
    
    // Check for opportunities to use Spot instances
    if (ec2Resources.length >= 3) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'EC2',
        impact: 'MEDIUM',
        title: 'Evaluate using EC2 Spot Instances',
        description: 'You have multiple EC2 instances which could potentially leverage Spot Instances for cost savings of up to 90%.',
        resources: ec2Resources.map(r => r.LogicalId),
        estimatedSavings: calculateSpotInstanceSavings(ec2Resources),
        implementation: 'For non-critical or fault-tolerant workloads, configure Auto Scaling groups to use Spot Instances.'
      });
    }
    
    // Check for Reserved Instance opportunities
    recommendations.push({
      type: 'COST_OPTIMIZATION',
      service: 'EC2',
      impact: 'HIGH',
      title: 'Consider purchasing Reserved Instances',
      description: 'For predictable workloads, Reserved Instances can offer up to 72% cost savings compared to On-Demand pricing.',
      resources: ec2Resources.map(r => r.LogicalId),
      estimatedSavings: calculateReservedInstanceSavings(ec2Resources, serviceCosts),
      implementation: 'Analyze your EC2 usage patterns and purchase 1 or 3-year Reserved Instances for stable workloads.'
    });
  }
  
  // Check for S3 optimization opportunities
  if (resources.S3Bucket && resources.S3Bucket.length > 0) {
    const s3Buckets = resources.S3Bucket;
    
    // Check for S3 lifecycle policies
    const bucketsWithoutLifecycle = s3Buckets.filter(bucket => {
      const lifecycleConfig = bucket.Properties?.LifecycleConfiguration;
      return !lifecycleConfig || !lifecycleConfig.Rules || lifecycleConfig.Rules.length === 0;
    });
    
    if (bucketsWithoutLifecycle.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'S3',
        impact: 'MEDIUM',
        title: 'Implement S3 lifecycle policies',
        description: `${bucketsWithoutLifecycle.length} S3 buckets don't have lifecycle policies configured. Implementing lifecycle policies can reduce storage costs.`,
        resources: bucketsWithoutLifecycle.map(r => r.LogicalId),
        estimatedSavings: calculateS3LifecycleSavings(bucketsWithoutLifecycle),
        implementation: 'Add lifecycle rules to transition infrequently accessed objects to cheaper storage classes and expire old objects.'
      });
    }
    
    // Check for S3 Intelligent-Tiering opportunities
    recommendations.push({
      type: 'COST_OPTIMIZATION',
      service: 'S3',
      impact: 'LOW',
      title: 'Consider using S3 Intelligent-Tiering',
      description: 'S3 Intelligent-Tiering automatically moves objects between access tiers based on usage patterns, potentially reducing storage costs.',
      resources: s3Buckets.map(r => r.LogicalId),
      estimatedSavings: '5-15% of S3 storage costs',
      implementation: 'Enable S3 Intelligent-Tiering storage class for objects with unknown or changing access patterns.'
    });
  }
  
  // Check for DynamoDB optimization opportunities
  if (resources.DynamoDBTable && resources.DynamoDBTable.length > 0) {
    const dynamoTables = resources.DynamoDBTable;
    
    // Check for on-demand vs provisioned capacity
    const provisonedTables = dynamoTables.filter(table => {
      const billingMode = table.Properties?.BillingMode;
      return billingMode === 'PROVISIONED' || !billingMode;
    });
    
    if (provisonedTables.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'DynamoDB',
        impact: 'MEDIUM',
        title: 'Evaluate DynamoDB capacity mode',
        description: 'Consider switching between on-demand and provisioned capacity based on your usage patterns.',
        resources: provisonedTables.map(r => r.LogicalId),
        estimatedSavings: 'Varies based on usage patterns',
        implementation: 'For unpredictable workloads, use on-demand capacity. For predictable workloads with consistent usage, use provisioned capacity with auto-scaling.'
      });
    }
    
    // Check for DynamoDB Reserved Capacity opportunities
    if (provisonedTables.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'DynamoDB',
        impact: 'MEDIUM',
        title: 'Consider purchasing DynamoDB Reserved Capacity',
        description: 'For tables with predictable usage patterns, Reserved Capacity can provide significant savings.',
        resources: provisonedTables.map(r => r.LogicalId),
        estimatedSavings: 'Up to 50% compared to standard provisioned capacity',
        implementation: 'Analyze your DynamoDB usage patterns and purchase Reserved Capacity for stable workloads.'
      });
    }
  }
  
  // Check for Lambda optimization opportunities
  if (resources.LambdaFunction && resources.LambdaFunction.length > 0) {
    const lambdaFunctions = resources.LambdaFunction;
    
    // Check for oversized Lambda memory allocation
    const potentiallyOversizedLambdas = lambdaFunctions.filter(lambda => {
      const memorySize = lambda.Properties?.MemorySize;
      return memorySize && memorySize > 1024;
    });
    
    if (potentiallyOversizedLambdas.length > 0) {
      recommendations.push({
        type: 'COST_OPTIMIZATION',
        service: 'Lambda',
        impact: 'LOW',
        title: 'Optimize Lambda memory settings',
        description: `${potentiallyOversizedLambdas.length} Lambda functions have high memory allocations. Right-sizing memory can reduce costs.`,
        resources: potentiallyOversizedLambdas.map(r => r.LogicalId),
        estimatedSavings: 'Up to 40% of Lambda costs for optimized functions',
        implementation: 'Monitor Lambda execution metrics and adjust memory allocation based on actual usage requirements.'
      });
    }
    
    // Check for Lambda Provisioned Concurrency opportunities
    const highConcurrencyFunctions = lambdaFunctions.filter(lambda => {
      // Simple heuristic: functions with 3 seconds or higher timeout might be good candidates
      const timeout = lambda.Properties?.Timeout;
      return timeout && timeout >= 3;
    });
    
    if (highConcurrencyFunctions.length > 0) {
      recommendations.push({
        type: 'PERFORMANCE_OPTIMIZATION',
        service: 'Lambda',
        impact: 'LOW',
        title: 'Evaluate Lambda Provisioned Concurrency',
        description: 'For latency-sensitive Lambda functions, provisioned concurrency can eliminate cold starts.',
        resources: highConcurrencyFunctions.map(r => r.LogicalId),
        estimatedSavings: 'May increase costs but improve performance',
        implementation: 'Identify functions with strict latency requirements and configure provisioned concurrency.'
      });
    }
  }
  
  // General architecture recommendations
  recommendations.push({
    type: 'ARCHITECTURE_OPTIMIZATION',
    service: 'General',
    impact: 'MEDIUM',
    title: 'Implement auto-scaling for all compute resources',
    description: 'Ensure all compute resources (EC2, ECS, etc.) have appropriate auto-scaling configured to match capacity with demand.',
    resources: [],
    estimatedSavings: '10-30% of compute costs',
    implementation: 'Configure auto-scaling groups with appropriate metrics-based scaling policies.'
  });
  
  // Check for AWS Graviton opportunities if using EC2 or containers
  if ((resources.EC2Instance && resources.EC2Instance.length > 0) || 
      (resources.ECSCluster && resources.ECSCluster.length > 0)) {
    recommendations.push({
      type: 'COST_OPTIMIZATION',
      service: 'Compute',
      impact: 'HIGH',
      title: 'Consider AWS Graviton-based instances',
      description: 'AWS Graviton processors provide up to 40% better price-performance compared to x86-based instances.',
      resources: [],
      estimatedSavings: 'Up to 20% of overall compute costs',
      implementation: 'For supported workloads, transition to Graviton-based instance types for EC2, ECS, and other compute services.'
    });
  }
  
  return recommendations;
}

/**
 * Generate recommendations for multiple architectures
 * 
 * @param {Array} architectures - List of architecture analysis results
 * @returns {Array} List of recommendations
 */
function generateComparisonRecommendations(architectures) {
  const recommendations = [];
  
  if (!architectures || architectures.length < 2) {
    return recommendations;
  }
  
  // Sort architectures by total cost
  const sortedArchitectures = [...architectures].sort((a, b) => a.totalCost - b.totalCost);
  const cheapestArch = sortedArchitectures[0];
  const mostExpensiveArch = sortedArchitectures[sortedArchitectures.length - 1];
  
  // Calculate cost difference
  const costDifference = mostExpensiveArch.totalCost - cheapestArch.totalCost;
  const costDifferencePercentage = (costDifference / mostExpensiveArch.totalCost) * 100;
  
  if (costDifferencePercentage > 15) {
    recommendations.push({
      type: 'COMPARISON',
      impact: 'HIGH',
      title: `${cheapestArch.templateName} is significantly more cost-effective`,
      description: `${cheapestArch.templateName} is approximately ${costDifferencePercentage.toFixed(1)}% cheaper than ${mostExpensiveArch.templateName}`,
      services: ['Overall'],
      estimatedSavings: `$${costDifference.toFixed(2)} per month`,
      implementation: 'Consider adopting the more cost-effective architecture for production deployment.'
    });
  }
  
  // Compare service costs across architectures
  const allServices = new Set();
  architectures.forEach(arch => {
    Object.keys(arch.serviceCosts || {}).forEach(service => allServices.add(service));
  });
  
  allServices.forEach(service => {
    // Find architectures with the lowest and highest cost for this service
    let lowestCost = Infinity;
    let highestCost = 0;
    let lowestCostArch = null;
    let highestCostArch = null;
    
    architectures.forEach(arch => {
      const serviceCost = arch.serviceCosts?.[service] || 0;
      if (serviceCost < lowestCost) {
        lowestCost = serviceCost;
        lowestCostArch = arch;
      }
      if (serviceCost > highestCost) {
        highestCost = serviceCost;
        highestCostArch = arch;
      }
    });
    
    if (lowestCostArch && highestCostArch && lowestCostArch !== highestCostArch) {
      const serviceDifference = highestCost - lowestCost;
      const serviceDifferencePercentage = (serviceDifference / highestCost) * 100;
      
      if (serviceDifferencePercentage > 20 && serviceDifference > 10) {
        recommendations.push({
          type: 'SERVICE_COMPARISON',
          impact: 'MEDIUM',
          title: `${service} costs less in ${lowestCostArch.templateName}`,
          description: `${lowestCostArch.templateName} uses ${service} more cost-effectively than ${highestCostArch.templateName}`,
          services: [service],
          estimatedSavings: `$${serviceDifference.toFixed(2)} per month`,
          implementation: `Analyze how ${service} is configured in ${lowestCostArch.templateName} and apply similar optimizations to other architectures.`
        });
      }
    }
  });
  
  // Compare different service choices (e.g., serverless vs. containers)
  const serviceTypes = architectures.map(arch => {
    const hasContainers = arch.resources?.ECSCluster || arch.resources?.EKSCluster;
    const hasServerless = arch.resources?.LambdaFunction;
    const hasEC2 = arch.resources?.EC2Instance;
    
    return {
      name: arch.templateName,
      hasContainers,
      hasServerless,
      hasEC2,
      cost: arch.totalCost
    };
  });
  
  const containerArchs = serviceTypes.filter(a => a.hasContainers);
  const serverlessArchs = serviceTypes.filter(a => a.hasServerless);
  const ec2Archs = serviceTypes.filter(a => a.hasEC2);
  
  if (containerArchs.length > 0 && serverlessArchs.length > 0) {
    const avgContainerCost = containerArchs.reduce((sum, a) => sum + a.cost, 0) / containerArchs.length;
    const avgServerlessCost = serverlessArchs.reduce((sum, a) => sum + a.cost, 0) / serverlessArchs.length;
    
    if (Math.abs(avgContainerCost - avgServerlessCost) > 50) {
      const cheaperOption = avgContainerCost < avgServerlessCost ? 'container-based' : 'serverless';
      const expensiveOption = avgContainerCost < avgServerlessCost ? 'serverless' : 'container-based';
      
      recommendations.push({
        type: 'ARCHITECTURE_COMPARISON',
        impact: 'HIGH',
        title: `${cheaperOption.charAt(0).toUpperCase() + cheaperOption.slice(1)} architectures are more cost-effective`,
        description: `The ${cheaperOption} architectures are less expensive than ${expensiveOption} architectures for your workload profile.`,
        services: ['Compute'],
        estimatedSavings: `Approximately ${Math.abs(avgContainerCost - avgServerlessCost).toFixed(2)} per month`,
        implementation: `Consider standardizing on ${cheaperOption} architectures when possible for this workload type.`
      });
    }
  }
  
  return recommendations;
}

// Helper functions for calculating estimated savings

function calculateRightSizingSavings(oversizedInstances) {
  // Simplified calculation assuming 30% savings from right-sizing
  const estimatedInstanceCost = oversizedInstances.length * 150; // Rough estimate of monthly cost for larger instances
  return `Approximately $${(estimatedInstanceCost * 0.3).toFixed(2)} per month`;
}

function calculateSpotInstanceSavings(ec2Resources) {
  // Simplified calculation assuming 70% savings from Spot Instances
  const estimatedInstanceCost = ec2Resources.length * 100; // Rough estimate of monthly cost
  return `Up to $${(estimatedInstanceCost * 0.7).toFixed(2)} per month`;
}

function calculateReservedInstanceSavings(ec2Resources, serviceCosts) {
  // Simplified calculation assuming 40% savings from Reserved Instances
  const ec2Cost = serviceCosts?.EC2 || (ec2Resources.length * 100);
  return `Approximately $${(ec2Cost * 0.4).toFixed(2)} per month`;
}

function calculateS3LifecycleSavings(buckets) {
  // Simplified calculation assuming 15% savings from lifecycle policies
  return `Approximately 15% of S3 storage costs`;
}

module.exports = {
  generateRecommendations,
  generateComparisonRecommendations
}; 