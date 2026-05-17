import { AppError } from './appError.js';
import { generateSubQueries } from './geminiService.js';

const TAVILY_URL = 'https://api.tavily.com/search';

function getErrorDetails(responseStatus) {
  if (responseStatus === 401 || responseStatus === 403) {
    return new AppError('The search service could not authenticate. Check the server Tavily API key.', 502, 'TAVILY_AUTH_ERROR');
  }
  if (responseStatus === 429) {
    return new AppError('The search service rate limit was reached. Please try again shortly.', 429, 'TAVILY_RATE_LIMIT');
  }
  return new AppError('The search service is temporarily unavailable. Please try again.', 502, 'TAVILY_ERROR');
}

async function executeSingleQuery(query, maxResults = 6, searchDepth = 'advanced') {
  let response;
  try {
    response = await fetch(TAVILY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false
      }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    throw new AppError('Could not reach the search service. Check your connection and try again.', 503, 'TAVILY_NETWORK_ERROR');
  }

  if (!response.ok) throw getErrorDetails(response.status);

  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((result) => ({
    title: result.title || new URL(result.url).hostname,
    url: result.url,
    snippet: result.content || 'No preview available.',
    score: result.score || 0.8
  }));
}

export async function searchWeb(query, depth = 'standard') {
  if (!process.env.TAVILY_API_KEY) {
    throw new AppError('Research is not configured: the server is missing its Tavily API key.', 503, 'TAVILY_NOT_CONFIGURED');
  }

  if (depth === 'quick') {
    const results = await executeSingleQuery(query, 3, 'basic');
    if (!results.length) {
      throw new AppError('No relevant web sources were found. Try broadening or rephrasing your question.', 404, 'NO_SOURCES_FOUND');
    }
    return results;
  }

  if (depth === 'deep') {
    // Generate clarifying/targeted sub-queries
    const subQueries = await generateSubQueries(query);
    const allQueries = [query, ...subQueries];

    // Execute queries in parallel
    const settled = await Promise.allSettled(
      allQueries.map((q) => executeSingleQuery(q, 5, 'advanced'))
    );

    const merged = [];
    const seenUrls = new Set();

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const item of res.value) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            merged.push(item);
          }
        }
      }
    }

    if (!merged.length) {
      throw new AppError('No relevant web sources were found. Try broadening or rephrasing your question.', 404, 'NO_SOURCES_FOUND');
    }

    // Sort by score descending and return up to 12 diverse sources
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));
    return merged.slice(0, 12);
  }

  // Standard depth (default)
  const results = await executeSingleQuery(query, 6, 'advanced');
  if (!results.length) {
    throw new AppError('No relevant web sources were found. Try broadening or rephrasing your question.', 404, 'NO_SOURCES_FOUND');
  }
  return results;
}
