import { GoogleGenAI } from '@google/genai';
import { AppError } from './appError.js';

export function buildPrompt(query, sources = [], history = []) {
  const docSources = sources.filter((s) => s.isDocument || s.url?.startsWith('doc://'));
  const webSources = sources.filter((s) => !s.isDocument && !s.url?.startsWith('doc://'));

  const contextSections = [];

  if (docSources.length > 0) {
    const docContext = docSources.map((source, index) => [
      `DOCUMENT EXCERPT ${index + 1}: ${source.title || source.filename}`,
      `CITATION LINK: ${source.url}`,
      `CONTENT:\n${source.snippet}`
    ].join('\n')).join('\n\n---\n\n');

    contextSections.push(`PRIMARY ATTACHED DOCUMENTS (Uploaded by User):\n${docContext}`);
  }

  if (webSources.length > 0) {
    const webContext = webSources.map((source, index) => [
      `WEB SOURCE ${index + 1}: ${source.title}`,
      `URL: ${source.url}`,
      `CONTENT:\n${source.snippet}`
    ].join('\n')).join('\n\n---\n\n');

    contextSections.push(`EXTERNAL LIVE WEB SOURCES:\n${webContext}`);
  }

  const context = contextSections.length > 0
    ? contextSections.join('\n\n====================\n\n')
    : 'No research sources were found.';

  let historyContext = '';
  if (Array.isArray(history) && history.length > 0) {
    const formattedHistory = history
      .slice(-6) // Include up to last 6 turns for context
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    historyContext = `\n\nPRIOR CONVERSATION CONTEXT:\n${formattedHistory}\n`;
  }

  return `You are an expert web and document research assistant. Answer the user's question thoroughly using only support from the research context below. Do not invent facts or sources.

CRITICAL INSTRUCTIONS FOR ATTACHED DOCUMENTS:
- The section labeled "PRIMARY ATTACHED DOCUMENTS" contains excerpts from documents uploaded directly by the user.
- When the user asks "what's in the file?", "summarize the document", "explain this file", or any question referring to "the file", "the document", "the PDF", "the upload", or "this attachment", they are referring EXCLUSIVELY to their uploaded document(s).
- NEVER confuse external web articles or web search results with the user's uploaded file. Do NOT cite or describe external web articles (such as essays, blogs, news, or general web pages) as the user's file.
- If primary attached documents are present, base your answer directly and comprehensively on the content of the attached document. Detail its subject matter, key sections, core concepts, and practical takeaways.
- If the user asks about an attached file but no documents are present in "PRIMARY ATTACHED DOCUMENTS", state clearly that no document is attached in the current session and invite them to upload one.

STYLE AND CITATION GUIDELINES:
- Begin with a direct, comprehensive summary answer.
- Organize detailed evidence with clear section headings, structured bullet points, and comparative details where applicable.
- Always cite claims inline using clean Markdown links with descriptive anchor text (e.g. [Document.pdf, p. 2](doc://Document.pdf#page=2) or [Source Name](https://...)). Never paste raw, naked URLs into the prose.
- Provide a concluding takeaway or next steps section.
- Ensure the answer is completely finished with no cutoffs or incomplete sentences.${historyContext}

USER QUESTION:
${query}

RESEARCH CONTEXT:
${context}`;
}

function getStatus(error) {
  return Number(error?.status || error?.response?.status) || null;
}

function isTransient(error) {
  const status = getStatus(error);
  if (!status) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('overloaded') || msg.includes('unavailable') || msg.includes('timeout') || msg.includes('fetch failed')) {
      return true;
    }
  }
  return !status || [429, 500, 502, 503, 504].includes(status);
}

function classifyGeminiError(error) {
  const status = getStatus(error);
  if (status === 429) return new AppError('The AI service rate limit was reached. Please wait a moment and try again.', 429, 'GEMINI_RATE_LIMIT');
  if (status === 401 || status === 403) return new AppError('The AI service could not authenticate. Check the server Gemini API key.', 502, 'GEMINI_AUTH_ERROR');
  if (status === 400 || status === 404) return new AppError('The AI service rejected the configured model or request. Check GEMINI_MODEL in server/.env.', 502, 'GEMINI_REQUEST_ERROR');
  if (status && status >= 500) return new AppError('The AI service is temporarily unavailable. Please try again in a moment.', 503, 'GEMINI_UNAVAILABLE');
  return new AppError('The AI service could not generate a response. Please try again.', 502, 'GEMINI_ERROR');
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function getCandidateModels() {
  const configured = (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim();
  const models = [configured, 'gemini-3.6-flash', 'gemini-flash-latest'];
  return [...new Set(models.filter(Boolean))];
}

export async function generateResearchAnswer(query, sources, history = []) {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('Research is not configured: the server is missing its Gemini API key.', 503, 'GEMINI_NOT_CONFIGURED');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = getCandidateModels();
  let lastError = null;

  for (const model of models) {
    const request = {
      model,
      contents: buildPrompt(query, sources, history),
      config: { temperature: 0.2, maxOutputTokens: 8192 }
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await ai.models.generateContent(request);
        if (!response.text?.trim()) {
          throw new AppError('The AI service returned an empty response. Please try again.', 502, 'GEMINI_EMPTY_RESPONSE');
        }
        return response.text.trim();
      } catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
        if (attempt < 2 && isTransient(error)) {
          await wait(800 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw classifyGeminiError(lastError);
}

export async function streamResearchAnswer(query, sources, history = [], onChunk, abortSignal) {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('Research is not configured: the server is missing its Gemini API key.', 503, 'GEMINI_NOT_CONFIGURED');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = getCandidateModels();
  let lastError = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (abortSignal?.aborted) return '';

      const request = {
        model,
        contents: buildPrompt(query, sources, history),
        config: { temperature: 0.2, maxOutputTokens: 8192 }
      };

      let fullText = '';
      let hasEmittedTokens = false;

      try {
        const responseStream = await ai.models.generateContentStream(request);
        for await (const chunk of responseStream) {
          if (abortSignal?.aborted) break;
          const text = chunk.text || '';
          if (text) {
            hasEmittedTokens = true;
            fullText += text;
            onChunk(text);
          }
        }
        return fullText;
      } catch (error) {
        if (abortSignal?.aborted) return '';
        lastError = error;

        // If tokens were already sent to the user, we cannot restart the stream mid-sentence
        if (hasEmittedTokens) {
          throw classifyGeminiError(error);
        }

        if (attempt < 2 && isTransient(error)) {
          await wait(800 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw classifyGeminiError(lastError);
}

export async function generateSubQueries(query) {
  if (!process.env.GEMINI_API_KEY) {
    return [query];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Break this research question into 3 distinct, specific search sub-queries to explore different perspectives, technical details, or recent findings:
Question: "${query}"

Return ONLY a valid JSON array of 3 strings. Example: ["query 1", "query 2", "query 3"]`;

  const models = getCandidateModels();
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.1, responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text?.trim() || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3).map((q) => String(q).trim()).filter(Boolean);
      }
    } catch (err) {
      console.warn(`Sub-query generation with ${model} fallback:`, err.message);
    }
  }

  return [
    `${query} overview and fundamentals`,
    `${query} best practices and tradeoffs`,
    `${query} real world benchmarks and examples`
  ];
}
