/**
 * Source Credibility Scoring & Filtering Service
 */

const ACADEMIC_DOMAINS = [
  'arxiv.org', 'nature.com', 'sciencedirect.com', 'ieee.org', 'springer.com',
  'ncbi.nlm.nih.gov', 'nih.gov', 'acm.org', 'jstor.org', 'wiley.com', 'cell.com'
];

const NEWS_DOMAINS = [
  'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com',
  'wsj.com', 'bloomberg.com', 'theguardian.com', 'economist.com', 'ft.com'
];

const DOCS_DOMAINS = [
  'developer.mozilla.org', 'react.dev', 'nodejs.org', 'docs.python.org',
  'docs.oracle.com', 'microsoft.com', 'cloud.google.com', 'aws.amazon.com',
  'github.com', 'gitlab.com', 'kubernetes.io', 'go.dev', 'rust-lang.org'
];

const FORUM_DOMAINS = [
  'reddit.com', 'quora.com', 'stackoverflow.com', 'stackexchange.com',
  'news.ycombinator.com', 'medium.com', 'twitter.com', 'x.com', 'facebook.com'
];

const WIKI_DOMAINS = [
  'wikipedia.org', 'fandom.com', 'wikihow.com', 'wikibooks.org'
];

const BLOG_PATTERNS = [
  '/blog/', '/post/', '/article/', 'blogspot.com', 'wordpress.com', 'substack.com'
];

export function classifyDomain(hostname, pathname = '') {
  const host = (hostname || '').toLowerCase().replace('www.', '');
  const path = (pathname || '').toLowerCase();

  if (host.endsWith('.edu') || host.endsWith('.gov') || host.endsWith('.ac.uk')) {
    return 'academic';
  }
  if (ACADEMIC_DOMAINS.some((d) => host.includes(d))) {
    return 'academic';
  }
  if (NEWS_DOMAINS.some((d) => host.includes(d))) {
    return 'news';
  }
  if (DOCS_DOMAINS.some((d) => host.includes(d))) {
    return 'official_docs';
  }
  if (FORUM_DOMAINS.some((d) => host.includes(d))) {
    return 'forum';
  }
  if (WIKI_DOMAINS.some((d) => host.includes(d))) {
    return 'wiki';
  }
  if (BLOG_PATTERNS.some((p) => host.includes(p) || path.includes(p))) {
    return 'blog';
  }
  return 'general_web';
}

export function calculateCredibility(source) {
  // If uploaded primary document
  if (source.isDocument || source.url?.startsWith('doc://')) {
    return {
      score: 95,
      category: 'Verified Document',
      domainType: 'document',
      reasoning: 'Uploaded primary research document.'
    };
  }

  let urlObj;
  try {
    urlObj = new URL(source.url);
  } catch {
    return {
      score: 50,
      category: 'Unknown',
      domainType: 'general_web',
      reasoning: 'Could not parse source URL structure.'
    };
  }

  let score = 45;
  const reasons = [];

  // Signal 1: HTTPS
  if (urlObj.protocol === 'https:') {
    score += 10;
    reasons.push('Secure HTTPS');
  } else {
    reasons.push('Insecure HTTP');
  }

  // Signal 2: Domain category & authority
  const domainType = classifyDomain(urlObj.hostname, urlObj.pathname);
  if (domainType === 'academic') {
    score += 35;
    reasons.push('Institutional/peer-reviewed domain');
  } else if (domainType === 'official_docs') {
    score += 30;
    reasons.push('Official engineering/technical documentation');
  } else if (domainType === 'news') {
    score += 25;
    reasons.push('Major recognized journalism outlet');
  } else if (domainType === 'wiki') {
    score += 10;
    reasons.push('Community encyclopedia');
  } else if (domainType === 'blog') {
    score += 5;
    reasons.push('Blog / editorial commentary');
  } else if (domainType === 'forum') {
    score -= 10;
    reasons.push('User-generated forum / community discussion');
  }

  // Signal 3: Author / byline detection
  const combinedText = `${source.title || ''} ${source.snippet || ''}`;
  const hasByline = /\b(by [A-Z][a-z]+|author:|written by|reported by)\b/i.test(combinedText);
  if (hasByline) {
    score += 10;
    reasons.push('Attributed author/byline');
  }

  // Signal 4: Publish date detection
  const hasDate = /\b(202[0-9]|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(combinedText) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(source.url);
  if (hasDate) {
    score += 10;
    reasons.push('Dated publication');
  }

  // Relevance bonus from search engine score
  if (typeof source.score === 'number' && source.score > 0.8) {
    score += 5;
  }

  // Clamp score between 15 and 99
  const finalScore = Math.max(15, Math.min(99, score));

  let category = 'Standard';
  if (finalScore >= 85) category = 'High Credibility';
  else if (finalScore >= 65) category = 'Moderate Credibility';
  else category = 'Caution / User-Generated';

  return {
    score: finalScore,
    category,
    domainType,
    reasoning: reasons.join(' · ')
  };
}

export function filterAndScoreSources(sources, { minCredibility = 0, excludeDomainTypes = [] } = {}) {
  const scoredSources = sources.map((source) => ({
    ...source,
    credibility: calculateCredibility(source)
  }));

  const minScore = Number(minCredibility) || 0;
  const excluded = Array.isArray(excludeDomainTypes) ? excludeDomainTypes : [];

  const filtered = scoredSources.filter((source) => {
    // Keep user uploaded documents
    if (source.isDocument || source.url?.startsWith('doc://')) {
      return true;
    }

    if (source.credibility.score < minScore) {
      return false;
    }

    if (excluded.includes(source.credibility.domainType)) {
      return false;
    }

    return true;
  });

  // If filtering eliminated all sources, preserve top scored sources rather than failing
  return filtered.length > 0 ? filtered : scoredSources.slice(0, 3);
}

