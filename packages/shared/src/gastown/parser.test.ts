import { describe, it, expect } from 'vitest';
import { parseGTEvent, deduplicateReplaceable, sortByTimestamp } from './parser.js';
import type { GTNostrEvent, ParsedGTEvent } from './types.js';

function makeEvent(overrides: Partial<GTNostrEvent> = {}): GTNostrEvent {
  return {
    id: 'abc123',
    kind: 30315,
    pubkey: 'deadbeef',
    created_at: 1700000000,
    content: JSON.stringify({ schema: 'gt/log@1', type: 'sling', source: 'gt', payload: {} }),
    tags: [
      ['gt', '1'],
      ['rig', 'gastown'],
      ['role', 'polecat'],
      ['actor', 'Toast'],
      ['type', 'sling'],
      ['visibility', 'feed'],
    ],
    ...overrides,
  };
}

describe('parseGTEvent', () => {
  it('parses a valid GT event', () => {
    const raw = makeEvent();
    const parsed = parseGTEvent(raw);

    expect(parsed).not.toBeNull();
    expect(parsed!.kind).toBe(30315);
    expect(parsed!.tags.gt).toBe('1');
    expect(parsed!.tags.rig).toBe('gastown');
    expect(parsed!.tags.role).toBe('polecat');
    expect(parsed!.tags.actor).toBe('Toast');
    expect(parsed!.tags.type).toBe('sling');
    expect(parsed!.tags.visibility).toBe('feed');
    expect(parsed!.data).toEqual({ schema: 'gt/log@1', type: 'sling', source: 'gt', payload: {} });
  });

  it('returns null for events without gt tag', () => {
    const raw = makeEvent({ tags: [['rig', 'gastown']] });
    expect(parseGTEvent(raw)).toBeNull();
  });

  it('handles non-JSON content gracefully', () => {
    const raw = makeEvent({ content: 'not json' });
    const parsed = parseGTEvent(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.data).toBe('not json');
  });

  it('extracts d tag for replaceable events', () => {
    const raw = makeEvent({
      kind: 30316,
      tags: [['gt', '1'], ['d', 'gastown/polecat/Toast']],
    });
    const parsed = parseGTEvent(raw);
    expect(parsed!.dTag).toBe('gastown/polecat/Toast');
  });

  it('extracts all correlation tags', () => {
    const raw = makeEvent({
      tags: [
        ['gt', '1'],
        ['t', 'gt-123'],
        ['convoy', 'convoy-1'],
        ['session', 'sess-abc'],
        ['branch', 'polecat/toast-gt123'],
        ['mr', '!42'],
        ['queue', 'build'],
        ['msg_type', 'MERGE_READY'],
        ['from', 'refinery'],
        ['to', 'witness'],
        ['priority', 'high'],
      ],
    });
    const parsed = parseGTEvent(raw);
    expect(parsed!.tags.issueId).toBe('gt-123');
    expect(parsed!.tags.convoyId).toBe('convoy-1');
    expect(parsed!.tags.sessionId).toBe('sess-abc');
    expect(parsed!.tags.branch).toBe('polecat/toast-gt123');
    expect(parsed!.tags.mr).toBe('!42');
    expect(parsed!.tags.queue).toBe('build');
    expect(parsed!.tags.msgType).toBe('MERGE_READY');
    expect(parsed!.tags.from).toBe('refinery');
    expect(parsed!.tags.to).toBe('witness');
    expect(parsed!.tags.priority).toBe('high');
  });

  it('produces ISO timestamp from created_at', () => {
    const raw = makeEvent({ created_at: 1700000000 });
    const parsed = parseGTEvent(raw);
    expect(parsed!.timestamp).toBe(new Date(1700000000 * 1000).toISOString());
  });
});

describe('deduplicateReplaceable', () => {
  it('keeps the latest event per kind:dTag', () => {
    const older: ParsedGTEvent = {
      raw: makeEvent({ id: 'old', created_at: 100 }),
      kind: 30316,
      dTag: 'gastown/polecat/Toast',
      data: { status: 'ready' },
      tags: { gt: '1' },
      timestamp: new Date(100000).toISOString(),
    };
    const newer: ParsedGTEvent = {
      raw: makeEvent({ id: 'new', created_at: 200 }),
      kind: 30316,
      dTag: 'gastown/polecat/Toast',
      data: { status: 'busy' },
      tags: { gt: '1' },
      timestamp: new Date(200000).toISOString(),
    };

    const result = deduplicateReplaceable([older, newer]);
    expect(result).toHaveLength(1);
    expect(result[0].raw.id).toBe('new');
  });

  it('keeps events with different dTags', () => {
    const a: ParsedGTEvent = {
      raw: makeEvent({ id: 'a', created_at: 100 }),
      kind: 30316,
      dTag: 'rig1/polecat/Toast',
      data: {},
      tags: { gt: '1' },
      timestamp: '',
    };
    const b: ParsedGTEvent = {
      raw: makeEvent({ id: 'b', created_at: 100 }),
      kind: 30316,
      dTag: 'rig2/polecat/Butter',
      data: {},
      tags: { gt: '1' },
      timestamp: '',
    };

    const result = deduplicateReplaceable([a, b]);
    expect(result).toHaveLength(2);
  });
});

describe('sortByTimestamp', () => {
  it('sorts newest first', () => {
    const events: ParsedGTEvent[] = [
      { raw: makeEvent({ created_at: 100 }), kind: 30315, data: {}, tags: {}, timestamp: '' },
      { raw: makeEvent({ created_at: 300 }), kind: 30315, data: {}, tags: {}, timestamp: '' },
      { raw: makeEvent({ created_at: 200 }), kind: 30315, data: {}, tags: {}, timestamp: '' },
    ];

    const sorted = sortByTimestamp(events);
    expect(sorted[0].raw.created_at).toBe(300);
    expect(sorted[1].raw.created_at).toBe(200);
    expect(sorted[2].raw.created_at).toBe(100);
  });

  it('does not mutate the original array', () => {
    const events: ParsedGTEvent[] = [
      { raw: makeEvent({ created_at: 200 }), kind: 30315, data: {}, tags: {}, timestamp: '' },
      { raw: makeEvent({ created_at: 100 }), kind: 30315, data: {}, tags: {}, timestamp: '' },
    ];

    const sorted = sortByTimestamp(events);
    expect(sorted).not.toBe(events);
    expect(events[0].raw.created_at).toBe(200);
  });
});
