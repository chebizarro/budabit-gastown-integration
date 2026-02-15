import { describe, it, expect } from 'vitest';
import {
  activityLogFilter,
  lifecycleFilter,
  convoyFilter,
  issueFilter,
  protocolFilter,
  workItemFilter,
  groupDefFilter,
  queueDefFilter,
  channelDefFilter,
  allStateFilter,
  dmGiftWrapFilter,
  dmFilter,
  channelCreateFilter,
  channelMetaFilter,
  channelMessageFilter,
  allChannelMetaFilter,
} from './filters.js';
import {
  KIND_LOG_STATUS,
  KIND_LIFECYCLE,
  KIND_GT_CONVOY_STATE,
  KIND_GT_BEADS_ISSUE_STATE,
  KIND_GT_PROTOCOL_EVENT,
  KIND_GT_WORK_ITEM,
  KIND_GT_GROUP_DEF,
  KIND_GT_QUEUE_DEF,
  KIND_GT_CHANNEL_DEF,
  KIND_DM,
  KIND_GIFT_WRAP,
  KIND_CHANNEL_CREATE,
  KIND_CHANNEL_META,
  KIND_CHANNEL_MESSAGE,
} from './kinds.js';

describe('filter builders', () => {
  it('all filters include #gt protocol version', () => {
    const filters = [
      activityLogFilter(),
      lifecycleFilter(),
      convoyFilter(),
      issueFilter(),
      protocolFilter(),
      workItemFilter(),
      groupDefFilter(),
      queueDefFilter(),
      channelDefFilter(),
      allStateFilter(),
    ];
    for (const f of filters) {
      expect(f['#gt']).toEqual(['1']);
    }
  });

  describe('activityLogFilter', () => {
    it('sets correct kind', () => {
      const f = activityLogFilter();
      expect(f.kinds).toEqual([KIND_LOG_STATUS]);
    });

    it('applies rig filter', () => {
      const f = activityLogFilter({ rig: 'gastown' });
      expect(f['#rig']).toEqual(['gastown']);
    });

    it('applies visibility filter', () => {
      const f = activityLogFilter({ visibility: ['feed', 'both'] });
      expect(f['#visibility']).toEqual(['feed', 'both']);
    });

    it('applies since and limit', () => {
      const f = activityLogFilter({ since: 1700000000, limit: 50 });
      expect(f.since).toBe(1700000000);
      expect(f.limit).toBe(50);
    });
  });

  describe('lifecycleFilter', () => {
    it('sets correct kind', () => {
      expect(lifecycleFilter().kinds).toEqual([KIND_LIFECYCLE]);
    });

    it('applies role filter', () => {
      expect(lifecycleFilter({ role: 'polecat' })['#role']).toEqual(['polecat']);
    });

    it('applies authors filter', () => {
      expect(lifecycleFilter({ authors: ['pk1'] }).authors).toEqual(['pk1']);
    });
  });

  describe('convoyFilter', () => {
    it('sets correct kind', () => {
      expect(convoyFilter().kinds).toEqual([KIND_GT_CONVOY_STATE]);
    });

    it('applies convoy id via d tag', () => {
      expect(convoyFilter({ convoyId: 'c-1' })['#d']).toEqual(['c-1']);
    });
  });

  describe('issueFilter', () => {
    it('sets correct kind', () => {
      expect(issueFilter().kinds).toEqual([KIND_GT_BEADS_ISSUE_STATE]);
    });

    it('applies all filters', () => {
      const f = issueFilter({ issueId: 'gt-42', rig: 'r1', status: 'open', type: 'bug', limit: 10 });
      expect(f['#d']).toEqual(['gt-42']);
      expect(f['#rig']).toEqual(['r1']);
      expect(f['#status']).toEqual(['open']);
      expect(f['#type']).toEqual(['bug']);
      expect(f.limit).toBe(10);
    });
  });

  describe('protocolFilter', () => {
    it('sets correct kind', () => {
      expect(protocolFilter().kinds).toEqual([KIND_GT_PROTOCOL_EVENT]);
    });

    it('applies msg_type and routing', () => {
      const f = protocolFilter({ msgType: 'MERGE_READY', to: 'witness', from: 'refinery' });
      expect(f['#msg_type']).toEqual(['MERGE_READY']);
      expect(f['#to']).toEqual(['witness']);
      expect(f['#from']).toEqual(['refinery']);
    });
  });

  describe('workItemFilter', () => {
    it('sets correct kind', () => {
      expect(workItemFilter().kinds).toEqual([KIND_GT_WORK_ITEM]);
    });

    it('applies queue and status', () => {
      const f = workItemFilter({ queue: 'build', status: 'available' });
      expect(f['#queue']).toEqual(['build']);
      expect(f['#status']).toEqual(['available']);
    });
  });

  describe('definition filters', () => {
    it('groupDefFilter sets correct kind and name', () => {
      const f = groupDefFilter({ name: 'dev-team' });
      expect(f.kinds).toEqual([KIND_GT_GROUP_DEF]);
      expect(f['#d']).toEqual(['dev-team']);
    });

    it('queueDefFilter sets correct kind and name', () => {
      const f = queueDefFilter({ name: 'merge' });
      expect(f.kinds).toEqual([KIND_GT_QUEUE_DEF]);
      expect(f['#d']).toEqual(['merge']);
    });

    it('channelDefFilter sets correct kind and name', () => {
      const f = channelDefFilter({ name: 'ops' });
      expect(f.kinds).toEqual([KIND_GT_CHANNEL_DEF]);
      expect(f['#d']).toEqual(['ops']);
    });
  });

  describe('allStateFilter', () => {
    it('includes all replaceable state kinds', () => {
      const f = allStateFilter();
      expect(f.kinds).toContain(KIND_LIFECYCLE);
      expect(f.kinds).toContain(KIND_GT_CONVOY_STATE);
      expect(f.kinds).toContain(KIND_GT_BEADS_ISSUE_STATE);
      expect(f.kinds).toContain(KIND_GT_GROUP_DEF);
      expect(f.kinds).toContain(KIND_GT_QUEUE_DEF);
      expect(f.kinds).toContain(KIND_GT_CHANNEL_DEF);
    });

    it('does NOT include append-only kinds', () => {
      const f = allStateFilter();
      expect(f.kinds).not.toContain(KIND_LOG_STATUS);
      expect(f.kinds).not.toContain(KIND_GT_PROTOCOL_EVENT);
      expect(f.kinds).not.toContain(KIND_GT_WORK_ITEM);
    });
  });

  // --- NIP-17 DM filters ---

  describe('dmGiftWrapFilter', () => {
    it('uses kind 1059 (gift wrap)', () => {
      const f = dmGiftWrapFilter({ recipientPubkey: 'abc123' });
      expect(f.kinds).toEqual([KIND_GIFT_WRAP]);
    });

    it('filters by recipient pubkey via #p tag', () => {
      const f = dmGiftWrapFilter({ recipientPubkey: 'abc123' });
      expect(f['#p']).toEqual(['abc123']);
    });

    it('does NOT include #gt tag (standard Nostr, not GT-specific)', () => {
      const f = dmGiftWrapFilter({ recipientPubkey: 'abc' });
      expect(f['#gt']).toBeUndefined();
    });

    it('applies since and limit', () => {
      const f = dmGiftWrapFilter({ recipientPubkey: 'abc', since: 1000, limit: 50 });
      expect(f.since).toBe(1000);
      expect(f.limit).toBe(50);
    });
  });

  describe('dmFilter', () => {
    it('uses kind 14', () => {
      expect(dmFilter().kinds).toEqual([KIND_DM]);
    });

    it('applies authors filter', () => {
      expect(dmFilter({ authors: ['pk1'] }).authors).toEqual(['pk1']);
    });

    it('does NOT include #gt tag', () => {
      expect(dmFilter()['#gt']).toBeUndefined();
    });
  });

  // --- NIP-28 Channel filters ---

  describe('channelCreateFilter', () => {
    it('uses kind 40', () => {
      expect(channelCreateFilter().kinds).toEqual([KIND_CHANNEL_CREATE]);
    });

    it('applies since', () => {
      expect(channelCreateFilter({ since: 5000 }).since).toBe(5000);
    });
  });

  describe('channelMetaFilter', () => {
    it('uses kind 41', () => {
      expect(channelMetaFilter().kinds).toEqual([KIND_CHANNEL_META]);
    });

    it('filters by channel id via #e tag', () => {
      expect(channelMetaFilter({ channelId: 'chan-1' })['#e']).toEqual(['chan-1']);
    });
  });

  describe('channelMessageFilter', () => {
    it('uses kind 42', () => {
      const f = channelMessageFilter({ channelId: 'chan-1' });
      expect(f.kinds).toEqual([KIND_CHANNEL_MESSAGE]);
    });

    it('filters by channel id via #e tag', () => {
      const f = channelMessageFilter({ channelId: 'chan-1' });
      expect(f['#e']).toEqual(['chan-1']);
    });

    it('applies since and limit', () => {
      const f = channelMessageFilter({ channelId: 'chan-1', since: 1000, limit: 100 });
      expect(f.since).toBe(1000);
      expect(f.limit).toBe(100);
    });
  });

  describe('allChannelMetaFilter', () => {
    it('includes kind 40 and 41', () => {
      const f = allChannelMetaFilter();
      expect(f.kinds).toContain(KIND_CHANNEL_CREATE);
      expect(f.kinds).toContain(KIND_CHANNEL_META);
    });

    it('applies since', () => {
      expect(allChannelMetaFilter({ since: 2000 }).since).toBe(2000);
    });
  });
});
