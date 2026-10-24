import { Controller, Get } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { SQSClient, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

@Controller('health')
export class HealthController {
  constructor(
    private readonly em: EntityManager,
    private readonly sqsClient: SQSClient,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const checks: Record<string, string> = {};
    // DB check
    try {
      await this.em.getConnection().execute('SELECT 1');
      checks.postgres = 'ok';
    } catch (e) {
      checks.postgres = 'fail';
    }
    // SQS check
    try {
      const qUrl = process.env.SQS_QUEUE_URL;
      if (qUrl) {
        await this.sqsClient.send(
          new GetQueueAttributesCommand({ QueueUrl: qUrl, AttributeNames: ['QueueArn'] }),
        );
        checks.sqs = 'ok';
      } else {
        checks.sqs = 'skipped';
      }
    } catch (e) {
      checks.sqs = 'fail';
    }
    // Keyclock
    try {
      const jwksUri = process.env.KEYCLOAK_JWKS_URI;
      if (jwksUri) {
        const res = await fetch(jwksUri);
        if ((await res.body?.json()).keys.at(0)) {
          checks.keycloak = 'ok';
        } else {
          checks.keycloak = 'fail';
        }
      } else {
        checks.keycloak = 'skipped';
      }
    } catch (e) {
      checks.keycloak = 'fail';
    }
    
    const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'skipped');
    return { status: allOk ? 'ready' : 'not_ready', checks };
  }
}
