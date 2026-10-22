import { Migration } from '@mikro-orm/migrations';

export class Migration20250101000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY,
        player_id VARCHAR(256) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance_amount NUMERIC(20,2) NOT NULL,
        balance_currency VARCHAR(3) NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_wallets_player_currency UNIQUE (player_id, currency),
        CONSTRAINT chk_wallets_balance_nonnegative CHECK (balance_amount >= 0),
        CONSTRAINT chk_wallets_version_positive CHECK (version >= 1)
      );
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS wager_transactions (
        id UUID PRIMARY KEY,
        provider_id VARCHAR(128) NOT NULL,
        external_transaction_id VARCHAR(256) NOT NULL,
        idempotency_key VARCHAR(512) NOT NULL UNIQUE,
        payload_hash VARCHAR(128) NOT NULL,
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        player_id VARCHAR(256) NOT NULL,
        round_id VARCHAR(256) NOT NULL,
        game_id VARCHAR(256) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        money_amount NUMERIC(20,2) NOT NULL,
        money_currency VARCHAR(3) NOT NULL,
        reference_external_transaction_id VARCHAR(256),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        status VARCHAR(32) NOT NULL,
        reference_transaction_id UUID,
        failure_code VARCHAR(64),
        processed_at TIMESTAMPTZ,
        CONSTRAINT chk_wager_money_positive CHECK (money_amount >= 0)
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_wager_provider_external
        ON wager_transactions (provider_id, external_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_wager_wallet_status
        ON wager_transactions (wallet_id, status);
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
        id UUID PRIMARY KEY,
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        transaction_id UUID NOT NULL,
        direction VARCHAR(8) NOT NULL,
        money_amount NUMERIC(20,2) NOT NULL,
        money_currency VARCHAR(3) NOT NULL,
        balance_before_amount NUMERIC(20,2) NOT NULL,
        balance_before_currency VARCHAR(3) NOT NULL,
        balance_after_amount NUMERIC(20,2) NOT NULL,
        balance_after_currency VARCHAR(3) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_ledger_direction CHECK (direction IN ('DEBIT','CREDIT')),
        CONSTRAINT chk_ledger_money_nonnegative CHECK (money_amount >= 0),
        CONSTRAINT chk_ledger_balance_before_nonnegative CHECK (balance_before_amount >= 0),
        CONSTRAINT chk_ledger_balance_after_nonnegative CHECK (balance_after_amount >= 0)
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created
        ON wallet_ledger_entries (wallet_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_ledger_transaction
        ON wallet_ledger_entries (transaction_id);
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY,
        message_id VARCHAR(256) NOT NULL,
        consumer_name VARCHAR(128) NOT NULL,
        payload_hash VARCHAR(128) NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        CONSTRAINT uq_inbox_consumer_message UNIQUE (consumer_name, message_id)
      );
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS outbox_messages (
        id UUID PRIMARY KEY,
        aggregate_id UUID NOT NULL,
        event_type VARCHAR(128) NOT NULL,
        payload JSONB NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ
      );
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS idx_outbox_pending
        ON outbox_messages (published_at, next_attempt_at);
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS mikro_orm_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS outbox_messages;');
    this.addSql('DROP TABLE IF EXISTS inbox_messages;');
    this.addSql('DROP TABLE IF EXISTS wallet_ledger_entries;');
    this.addSql('DROP TABLE IF EXISTS wager_transactions;');
    this.addSql('DROP TABLE IF EXISTS wallets;');
  }
}
