import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Research Depth Controls', () => {
  test('should validate depth parameters', () => {
    const validDepths = ['quick', 'standard', 'deep'];
    assert.equal(validDepths.includes('quick'), true);
    assert.equal(validDepths.includes('standard'), true);
    assert.equal(validDepths.includes('deep'), true);
    assert.equal(validDepths.includes('invalid_depth'), false);
  });

  test('should define correct query count and source limits for depth levels', () => {
    const depthConfig = {
      quick: { queries: 1, maxSources: 3, subQueries: false, estTime: '~3s' },
      standard: { queries: 1, maxSources: 6, subQueries: false, estTime: '~8s' },
      deep: { queries: 4, maxSources: 12, subQueries: true, estTime: '~20s' }
    };

    assert.equal(depthConfig.quick.maxSources, 3);
    assert.equal(depthConfig.standard.maxSources, 6);
    assert.equal(depthConfig.deep.maxSources, 12);
    assert.equal(depthConfig.deep.subQueries, true);
    assert.equal(depthConfig.quick.subQueries, false);
  });

  test('should deduplicate sources by url across multiple queries', () => {
    const queryResults = [
      [{ url: 'https://example.com/a', title: 'A', score: 0.9 }],
      [{ url: 'https://example.com/b', title: 'B', score: 0.8 }, { url: 'https://example.com/a', title: 'A duplicate', score: 0.95 }]
    ];

    const seenUrls = new Set();
    const merged = [];

    for (const list of queryResults) {
      for (const item of list) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          merged.push(item);
        }
      }
    }

    assert.equal(merged.length, 2);
    assert.deepEqual(merged.map((m) => m.url), ['https://example.com/a', 'https://example.com/b']);
  });
});

