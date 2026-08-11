// @ts-check

import { describe, expect, test } from 'bun:test';
import {
  ACTION_RECEIPT_TTL_MILLISECONDS,
  ActionReceiptError,
  ActionReceiptService,
} from '../../src/actions/receipt-service.js';
import { openRegistry, RegistryError } from '../../src/storage/registry.js';

describe('action receipts', () => {
  test('binds action, target, evidence, expiry, and completed replay', () => {
    const registry = openRegistry();
    const service = new ActionReceiptService({ registry });
    const now = new Date('2026-08-10T12:00:00.000Z');
    const receipt = service.preview(
      {
        action: 'claim.delete',
        targetType: 'claim',
        targetId: '11111111-1111-4111-8111-111111111111',
        evidence: { revision: 'abc', listeners: [] },
        idempotencyKey: 'delete-claim-once',
      },
      now,
    );

    expect(receipt).toMatchObject({
      state: 'pending',
      result: null,
      expiresAt: new Date(
        now.getTime() + ACTION_RECEIPT_TTL_MILLISECONDS,
      ).toISOString(),
    });

    let executions = 0;
    const first = service.execute(
      {
        receiptId: receipt.id,
        action: 'claim.delete',
        targetType: 'claim',
        targetId: '11111111-1111-4111-8111-111111111111',
        evidence: { listeners: [], revision: 'abc' },
      },
      () => {
        executions += 1;
        return { deleted: true };
      },
      new Date('2026-08-10T12:01:00.000Z'),
    );
    const replay = service.execute(
      {
        receiptId: receipt.id,
        action: 'claim.delete',
        targetType: 'claim',
        targetId: '11111111-1111-4111-8111-111111111111',
        evidence: { revision: 'changed' },
      },
      () => {
        executions += 1;
        return { deleted: false };
      },
      new Date('2026-08-10T12:02:00.000Z'),
    );

    expect(first).toEqual({
      changed: true,
      replayed: false,
      result: { deleted: true },
    });
    expect(replay).toEqual({
      changed: false,
      replayed: true,
      result: { deleted: true },
    });
    expect(() =>
      service.execute(
        {
          receiptId: receipt.id,
          action: 'port.reclaim',
          targetType: 'port',
          targetId: '8080',
          evidence: {},
        },
        () => ({ reclaimed: true }),
        new Date('2026-08-10T12:02:00.000Z'),
      ),
    ).toThrow('does not match');
    expect(executions).toBe(1);
    registry.close();
  });

  test('rejects expired, mismatched, and conflicting idempotency evidence', () => {
    const registry = openRegistry();
    const service = new ActionReceiptService({ registry });
    const now = new Date('2026-08-10T12:00:00.000Z');
    const receipt = service.preview(
      {
        action: 'port.reclaim',
        targetType: 'port',
        targetId: '8080',
        evidence: { pid: 123 },
        idempotencyKey: 'reclaim-8080',
      },
      now,
    );

    expect(() =>
      service.execute(
        {
          receiptId: receipt.id,
          action: 'port.reclaim',
          targetType: 'port',
          targetId: '8080',
          evidence: { pid: 124 },
        },
        () => ({ reclaimed: true }),
        new Date('2026-08-10T12:01:00.000Z'),
      ),
    ).toThrow(ActionReceiptError);
    expect(() =>
      service.execute(
        {
          receiptId: receipt.id,
          action: 'port.reclaim',
          targetType: 'port',
          targetId: '8080',
          evidence: { pid: 123 },
        },
        () => ({ reclaimed: true }),
        new Date('2026-08-10T12:06:00.000Z'),
      ),
    ).toThrow('expired');
    expect(() =>
      service.preview(
        {
          action: 'port.reclaim',
          targetType: 'port',
          targetId: '443',
          evidence: { pid: 456 },
          idempotencyKey: 'reclaim-8080',
        },
        now,
      ),
    ).toThrow(RegistryError);
    registry.close();
  });

  test('admits only one executor and resets a failed execution for retry', () => {
    const registry = openRegistry();
    const service = new ActionReceiptService({ registry });
    const now = new Date('2026-08-10T12:00:00.000Z');
    const input = {
      action: 'settings.update',
      targetType: 'settings',
      targetId: 'server',
      evidence: { revision: 'before' },
    };
    const receipt = service.preview(input, now);

    expect(() =>
      service.execute(
        { receiptId: receipt.id, ...input },
        () => {
          expect(() =>
            service.execute(
              { receiptId: receipt.id, ...input },
              () => ({ changed: true }),
              now,
            ),
          ).toThrow('already in progress');
          throw new Error('effect failed');
        },
        now,
      ),
    ).toThrow('effect failed');
    expect(registry.getActionReceipt(receipt.id)?.state).toBe('pending');
    expect(
      service.execute(
        { receiptId: receipt.id, ...input },
        () => ({ changed: true }),
        now,
      ),
    ).toMatchObject({ changed: true, replayed: false });
    registry.close();
  });

  test('awaits asynchronous effects and replays the durable result before evidence checks', async () => {
    const registry = openRegistry();
    const service = new ActionReceiptService({ registry });
    const now = new Date('2026-08-10T12:00:00.000Z');
    const input = {
      action: 'stack.apply',
      targetType: 'stack-root',
      targetId: '/tmp/project',
      evidence: { fingerprint: 'before' },
    };
    const receipt = service.preview(input, now);
    let executions = 0;
    const first = await service.executeAsync(
      { receiptId: receipt.id, ...input },
      async () => {
        executions += 1;
        await Bun.sleep(1);
        return { saved: true, stackId: '11111111-1111-4111-8111-111111111111' };
      },
      now,
    );
    const replay = await service.executeAsync(
      { receiptId: receipt.id, ...input, evidence: { fingerprint: 'changed' } },
      async () => {
        executions += 1;
        return { saved: false };
      },
      new Date('2026-08-10T12:10:00.000Z'),
    );

    expect(first).toMatchObject({ changed: true, replayed: false });
    expect(replay).toEqual({ changed: false, replayed: true, result: first.result });
    expect(executions).toBe(1);
    registry.close();
  });
});
