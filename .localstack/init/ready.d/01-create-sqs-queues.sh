#!/bin/bash
# LocalStack initialization script: create SQS FIFO queues and DLQ
set -e

AWS_ENDPOINT=http://localhost:4566
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

export AWS_ENDPOINT_URL=$AWS_ENDPOINT
export AWS_REGION
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

awslocal sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true","VisibilityTimeout":"30","ReceiveMessageWaitTimeSeconds":"20","MaximumMessageSize":"262144","MessageRetentionPeriod":"86400"}' >/dev/null

awslocal sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true","VisibilityTimeout":"30","ReceiveMessageWaitTimeSeconds":"20","MaximumMessageSize":"262144","MessageRetentionPeriod":"604800"}' >/dev/null

awslocal sqs create-queue \
  --queue-name wager-events.fifo \
  --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true","VisibilityTimeout":"30","ReceiveMessageWaitTimeSeconds":"20","MaximumMessageSize":"262144","MessageRetentionPeriod":"86400"}' >/dev/null

echo "SQS queues created successfully."
