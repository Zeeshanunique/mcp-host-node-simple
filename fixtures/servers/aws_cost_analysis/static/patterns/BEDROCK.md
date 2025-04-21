# Amazon Bedrock Architecture Patterns and Cost Factors

## Common Architecture Components

Amazon Bedrock applications typically involve these key components that impact costs:

### Foundation Models
- Amazon, Anthropic, Cohere, Meta, Stability AI models
- Each model has different pricing for input and output tokens
- Specialized models for text, image, embeddings

### Knowledge Base
- Requires Amazon OpenSearch Serverless (minimum 2 OCUs, $345.60/month minimum)
- Vector storage for embeddings
- Query processing infrastructure

### Agents
- Orchestration capabilities
- Action group integrations
- Memory management

### Guardrails
- Content filtering
- Topic detection
- Grounding mechanisms

## Knowledge Base Architecture Pattern

```
User Query → Bedrock Knowledge Base → OpenSearch Serverless → Foundation Model → Response
```

**Key Cost Considerations:**
- OpenSearch Serverless has a minimum capacity requirement (2 OCUs = $345.60/month minimum)
- Vector storage scales with document volume
- Foundation model costs apply for synthesizing responses
- Embedding generation fees apply
- Additional S3 storage costs for raw documents

## Agent Architecture Pattern

```
User Input → Bedrock Agent → Action Groups (Lambda, API Gateway) → Foundation Model → Response
```

**Key Cost Considerations:**
- Agent orchestration fees
- Foundation model costs included in agent request pricing
- Lambda and API Gateway costs for custom action groups
- Potential data transfer costs between services

## Best Practices for Cost Optimization

1. **Right-size foundation models:** Use smaller, more efficient models when full capabilities aren't needed
2. **Optimize prompts:** Reduce input token usage through efficient prompt engineering
3. **Implement caching:** Cache responses for common queries
4. **Monitor OCU utilization:** Adjust OpenSearch Serverless capacity as needed
5. **Use provisioned throughput:** For predictable workloads, consider provisioned options
6. **Batch processing:** Combine requests when possible to reduce API call overhead 