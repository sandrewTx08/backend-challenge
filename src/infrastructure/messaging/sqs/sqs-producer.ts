import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { MessagePublisher } from '../../../application/ports/message-publisher.port.js';

export class SqsProducer implements MessagePublisher {
  constructor(private readonly client: SQSClient) {}

  async publish(
    queueUrl: string,
    messageBody: string,
    messageGroupId: string,
    messageDeduplicationId: string,
  ): Promise<string> {
    const cmd = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
      MessageGroupId: messageGroupId,
      MessageDeduplicationId: messageDeduplicationId,
    });
    const res = await this.client.send(cmd);
    return res.MessageId ?? '';
  }
}
