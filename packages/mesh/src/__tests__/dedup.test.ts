import { DedupCache, packetKey } from '../dedup';

describe('DedupCache', () => {
  it('reports the first sighting only', () => {
    const d = new DedupCache({ ttlMs: 1000, maxEntries: 10, now: () => 0 });
    expect(d.checkAndAdd('a')).toBe(true);
    expect(d.checkAndAdd('a')).toBe(false);
    expect(d.checkAndAdd('a')).toBe(false);
    expect(d.checkAndAdd('b')).toBe(true);
    expect(d.has('a')).toBe(true);
  });

  it('forgets keys after the TTL', () => {
    let t = 0;
    const d = new DedupCache({ ttlMs: 1000, maxEntries: 10, now: () => t });
    d.checkAndAdd('a');
    t = 999;
    expect(d.checkAndAdd('a')).toBe(false);
    t = 999 + 1000;
    expect(d.has('a')).toBe(false);
    expect(d.checkAndAdd('a')).toBe(true);
  });

  it('a repeat does not extend the window', () => {
    let t = 0;
    const d = new DedupCache({ ttlMs: 1000, maxEntries: 10, now: () => t });
    d.checkAndAdd('a');
    t = 900;
    d.checkAndAdd('a');
    t = 1000;
    expect(d.checkAndAdd('a')).toBe(true);
  });

  it('evicts the oldest entries beyond maxEntries', () => {
    const d = new DedupCache({ ttlMs: 1e9, maxEntries: 3, now: () => 0 });
    for (const k of ['a', 'b', 'c', 'd']) d.checkAndAdd(k);
    expect(d.size).toBe(3);
    expect(d.has('a')).toBe(false);
    expect(d.has('d')).toBe(true);
    d.clear();
    expect(d.size).toBe(0);
  });

  it('prunes expired entries as new ones arrive', () => {
    let t = 0;
    const d = new DedupCache({ ttlMs: 10, maxEntries: 100, now: () => t });
    for (let i = 0; i < 50; i++) d.checkAndAdd(`k${i}`);
    t = 100;
    d.checkAndAdd('fresh');
    expect(d.size).toBe(1);
  });

  it('packetKey treats ids as unsigned 32-bit', () => {
    expect(packetKey(-1, 5)).toBe(packetKey(0xffffffff, 5));
    expect(packetKey(1, 2)).not.toBe(packetKey(2, 1));
  });
});
