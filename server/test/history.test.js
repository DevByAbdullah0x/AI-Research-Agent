import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from '../src/db/database.js';
import { extractTopicTags } from '../src/controllers/researchHistoryController.js';

describe('Persistent Research History & Archive', () => {
  const testRunId = `test-run-${randomUUID()}`;

  test('should extract topic tags from research query', () => {
    const query = 'Compare React and Vue performance metrics in production';
    const tags = extractTopicTags(query);
    assert.ok(tags.length > 0);
    assert.ok(tags.includes('React'));
    assert.ok(tags.includes('performance'));
  });

  test('should create and retrieve an archived research run', () => {
    const mockSources = [
      { title: 'React Documentation', url: 'https://react.dev', snippet: 'Fast virtual DOM', score: 0.95 }
    ];

    const run = database.createResearchRun({
      id: testRunId,
      query: 'Compare React and Vue performance metrics in production',
      depth: 'standard',
      answer: '# Performance Analysis\nReact offers superior ecosystem tooling...',
      sources: mockSources,
      topicTags: ['React', 'Vue', 'Performance']
    });

    assert.equal(run.id, testRunId);
    assert.equal(run.query, 'Compare React and Vue performance metrics in production');
    assert.deepEqual(run.sources, mockSources);
    assert.deepEqual(run.topic_tags, ['React', 'Vue', 'Performance']);
  });

  test('should search and filter research runs by keyword and topic', () => {
    const keywordResults = database.getResearchRuns({ search: 'React and Vue' });
    assert.ok(keywordResults.length > 0);
    assert.ok(keywordResults.some((r) => r.id === testRunId));

    const topicResults = database.getResearchRuns({ topic: 'Performance' });
    assert.ok(topicResults.length > 0);
    assert.ok(topicResults.some((r) => r.id === testRunId));

    const noMatches = database.getResearchRuns({ search: 'non_existent_topic_xyz_123' });
    assert.equal(noMatches.length, 0);
  });

  test('should update research run report and sources (for re-runs)', () => {
    const freshSources = [
      { title: 'Updated 2026 React Benchmarks', url: 'https://react.dev/benchmarks', snippet: 'Latest benchmarks', score: 0.99 }
    ];

    const updated = database.updateResearchRun(testRunId, {
      answer: '# Updated 2026 Performance Analysis\nFresh benchmarks indicate further gains.',
      sources: freshSources,
      depth: 'deep'
    });

    assert.equal(updated.depth, 'deep');
    assert.ok(updated.answer.includes('Updated 2026'));
    assert.equal(updated.sources.length, 1);
    assert.equal(updated.sources[0].title, 'Updated 2026 React Benchmarks');
  });

  test('should delete research run from archive', () => {
    const deleted = database.deleteResearchRun(testRunId);
    assert.equal(deleted, true);

    const fetched = database.getResearchRunById(testRunId);
    assert.equal(fetched, null);
  });
});

