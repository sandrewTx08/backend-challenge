#!/bin/bash
set -e
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
awslocal sqs create-queue --queue-name wager-transactions.fifo --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}' >/dev/null 2>&1 || true
awslocal sqs create-queue --queue-name wager-transactions-dlq.fifo --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}' >/dev/null 2>&1 || true
awslocal sqs create-queue --queue-name wager-events.fifo --attributes '{"FifoQueue":"true","ContentBasedDeduplication":"true"}' >/dev/null 2>&1 || true
echo "SQS queues created"