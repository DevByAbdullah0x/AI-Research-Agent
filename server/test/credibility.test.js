import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDomain,
  calculateCredibility,
  filterAndScoreSources
} from '../src/services/credibilityService.js';

describe('Source Credibility Filtering & Scoring', () => {
  test('should classify domains accurately based on patterns and TLDs', () => {
    assert.equal(classifyDomain('mit.edu'), 'academic');
    assert.equal(classifyDomain('arxiv.org'), 'academic');
    assert.equal(classifyDomain('nih.gov'), 'academic');
    assert.equal(classifyDomain('reuters.com'), 'news');
    assert.equal(classifyDomain('developer.mozilla.org'), 'official_docs');
    assert.equal(classifyDomain('reddit.com'), 'forum');
    assert.equal(classifyDomain('en.wikipedia.org'), 'wiki');
    assert.equal(classifyDomain('techblog.substack.com'), 'blog');
    assert.equal(classifyDomain('randomsite.com', '/blog/my-post'), 'blog');
  });

  test('should score high credibility for official/academic sources and lower for forums', () => {
    const academicSource = {
      url: 'https://arxiv.org/abs/2401.12345',
      title: 'Neural Networks Advances by John Doe (2025)',
      snippet: 'Published by Dr. Doe in January 2025 detailing neural architectures.',
      score: 0.95
    };

    const forumSource = {
      url: 'http://reddit.com/r/technology/post',
      title: 'What do you think of this framework?',
      snippet: 'Just my quick thoughts on reddit.',
      score: 0.6
    };

    const docSource = {
      url: 'doc://quarterly_report.pdf#page=1',
      title: 'quarterly_report.pdf',
      isDocument: true
    };

    const academicScore = calculateCredibility(academicSource);
    const forumScore = calculateCredibility(forumSource);
    const docScore = calculateCredibility(docSource);

    assert.ok(academicScore.score >= 85, `Expected academic score >= 85, got ${academicScore.score}`);
    assert.ok(forumScore.score < 60, `Expected forum score < 60, got ${forumScore.score}`);
    assert.equal(docScore.score, 95);
    assert.ok(academicScore.reasoning.includes('HTTPS'));
  });

  test('should filter sources below threshold and exclude requested domain types', () => {
    const sources = [
      { url: 'https://react.dev/reference', title: 'React Docs', snippet: 'Official reference 2025' },
      { url: 'https://tech-rant.substack.com', title: 'Opinion Post', snippet: 'My opinion on code' },
      { url: 'http://reddit.com/r/webdev', title: 'Reddit Thread', snippet: 'Discussion thread' }
    ];

    // Filter with minCredibility = 70
    const highCred = filterAndScoreSources(sources, { minCredibility: 70 });
    assert.ok(highCred.length > 0);
    assert.ok(highCred.every((s) => s.credibility.score >= 70));

    // Filter with domain exclusion: exclude 'forum' and 'blog'
    const excluded = filterAndScoreSources(sources, {
      excludeDomainTypes: ['forum', 'blog']
    });
    assert.equal(excluded.some((s) => s.credibility.domainType === 'forum'), false);
    assert.equal(excluded.some((s) => s.credibility.domainType === 'blog'), false);
  });
});

