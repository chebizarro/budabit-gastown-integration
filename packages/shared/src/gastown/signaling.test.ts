import { describe, it, expect } from 'vitest';
import { createEvent } from 'budabit-sdk';
import {
  createLogStatusEvent,
  createLifecycleEvent,
  createProtocolEvent,
  createWorkItemEvent,
  validateEvent,
} from './signaling.js';
import {
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_WORK_ITEM,
} from './kinds.js';

describe('createLogStatusEvent', () => {
  it('creates a kind 30315 event with correct tags', () => {
    const e = createLogStatusEvent(
      'gastown', 'polecat', 'Toast', 'sling', 'feed',
      { issue: 'gt-42', branch: 'main' },
      { issueId: 'gt-42', branch: 'feat/auth' },
    );

    expect(e.kind).toBe(KIND_LOG_STATUS);

    const tagMap = new Map(e.tags.map(t => [t[0], t[1]]));
    expect(tagMap.get('gt')).toBe('1');
    expect(tagMap.get('rig')).toBe('gastown');
    expect(tagMap.get('role')).toBe('polecat');
    expect(tagMap.get('actor')).toBe('Toast');
    expect(tagMap.get('type')).toBe('sling');
    expect(tagMap.get('visibility')).toBe('feed');
    expect(tagMap.get('t')).toBe('gt-42');
    expect(tagMap.get('branch')).toBe('feat/auth');

    const content = JSON.parse(e.content);
    expect(content.schema).toBe('gt/log@1');
    expect(content.type).toBe('sling');
    expect(content.payload.issue).toBe('gt-42');
  });
});

describe('createLifecycleEvent', () => {
  it('creates a kind 30316 event with d tag', () => {
    const e = createLifecycleEvent(
      'gastown', 'polecat', 'Toast', 'toast-1', 'busy',
      { currentIssue: 'gt-42', model: 'claude-4' },
    );

    expect(e.kind).toBe(KIND_LIFECYCLE);

    const tagMap = new Map(e.tags.map(t => [t[0], t[1]]));
    expect(tagMap.get('d')).toBe('gastown/polecat/toast-1');
    expect(tagMap.get('instance')).toBe('toast-1');
    expect(tagMap.get('status')).toBe('busy');
    expect(tagMap.get('t')).toBe('gt-42');
    expect(tagMap.get('model')).toBe('claude-4');

    const content = JSON.parse(e.content);
    expect(content.schema).toBe('gt/lifecycle@1');
    expect(content.status).toBe('busy');
  });
});

describe('createProtocolEvent', () => {
  it('creates a kind 30320 event with routing tags', () => {
    const e = createProtocolEvent(
      'gastown', 'refinery', 'Refinery', 'MERGE_READY', 'witness',
      { issue_id: 'gt-42', branch: 'feat/auth' },
      { issueId: 'gt-42' },
    );

    expect(e.kind).toBe(KIND_GT_PROTOCOL_EVENT);

    const tagMap = new Map(e.tags.map(t => [t[0], t[1]]));
    expect(tagMap.get('msg_type')).toBe('MERGE_READY');
    expect(tagMap.get('from')).toBe('Refinery');
    expect(tagMap.get('to')).toBe('witness');
    expect(tagMap.get('t')).toBe('gt-42');
  });
});

describe('createWorkItemEvent', () => {
  it('creates a kind 30325 event with queue tags', () => {
    const e = createWorkItemEvent(
      'gastown', 'deacon', 'Deacon', 'build', 'Build gt-42',
      { command: 'make test' },
      { issueId: 'gt-42', priority: 'high' },
    );

    expect(e.kind).toBe(KIND_GT_WORK_ITEM);

    const tagMap = new Map(e.tags.map(t => [t[0], t[1]]));
    expect(tagMap.get('queue')).toBe('build');
    expect(tagMap.get('status')).toBe('available');
    expect(tagMap.get('t')).toBe('gt-42');
    expect(tagMap.get('priority')).toBe('high');

    const content = JSON.parse(e.content);
    expect(content.queue).toBe('build');
    expect(content.subject).toBe('Build gt-42');
    expect(content.claimed_by).toBeNull();
  });
});

describe('validateEvent', () => {
  it('accepts valid GT events', () => {
    const e = createLogStatusEvent('rig', 'polecat', 'a', 'sling', 'feed', {});
    expect(validateEvent(e)).toBe(true);
  });

  it('rejects events with disallowed kinds', () => {
    const e = createEvent(99999, 'bad', []);
    expect(validateEvent(e)).toBe(false);
  });

  it('rejects events with stale timestamps', () => {
    const e = createEvent(1, 'test', []);
    e.created_at = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    expect(validateEvent(e)).toBe(false);
  });

  it('rejects events with content > 100KB', () => {
    const e = createEvent(1, 'x'.repeat(100001), []);
    expect(validateEvent(e)).toBe(false);
  });

  it('rejects events with > 100 tags', () => {
    const tags = Array.from({ length: 101 }, (_, i) => ['t', String(i)]);
    const e = createEvent(1, 'test', tags);
    expect(validateEvent(e)).toBe(false);
  });

  it('accepts custom allowed kinds', () => {
    const e = createEvent(42, 'custom', []);
    expect(validateEvent(e, [42])).toBe(true);
  });
});
