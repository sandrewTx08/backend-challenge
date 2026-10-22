export interface MessagePublisher {
  publish(
    queueUrl: string,
    messageBody: string,
    messageGroupId: string,
    messageDeduplicationId: string,
  ): Promise<string>;
}

export interface MessagePublisherPort extends MessagePublisher {}
