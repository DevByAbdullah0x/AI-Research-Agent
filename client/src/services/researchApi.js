let tokenGetter = null;

export function setAuthTokenGetter(fn) {
  tokenGetter = fn;
}

async function getAuthHeaders(existingHeaders = {}) {
  const headers = { ...existingHeaders };
  if (tokenGetter) {
    try {
      const token = await tokenGetter();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Failed to retrieve auth token:', e);
    }
  }
  return headers;
}

export async function research({ query, sessionId }) {
  let response;
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    response = await fetch('/api/research', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, sessionId })
    });
  } catch {
    throw new Error('Could not reach the API. Make sure the backend is running.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Research could not be completed.');
  return data;
}

export async function streamResearch(
  { query, sessionId, depth, minCredibility, excludeDomainTypes },
  { onSession, onStage, onSources, onToken, onComplete, onError, signal }
) {
  let response;
  try {
    const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
    response = await fetch('/api/research/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, sessionId, depth, minCredibility, excludeDomainTypes }),
      signal
    });
  } catch (error) {
    if (signal?.aborted) return;
    throw new Error('Could not reach the API. Make sure the backend is running.');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        let event = 'message';
        let dataStr = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6);
          }
        }

        if (!dataStr) continue;
        let data;
        try {
          data = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (event === 'session') onSession?.(data.sessionId);
        else if (event === 'stage') onStage?.(data);
        else if (event === 'sources') onSources?.(data.sources);
        else if (event === 'token') onToken?.(data.token);
        else if (event === 'complete') onComplete?.(data);
        else if (event === 'error') {
          onError?.(new Error(data.error));
          throw new Error(data.error);
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    throw err;
  }
}

export async function fetchSessions() {
  const headers = await getAuthHeaders();
  const response = await fetch('/api/sessions', { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not load sessions.');
  return data.sessions;
}

export async function createSession(title) {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch('/api/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not create session.');
  return data.session;
}

export async function fetchSession(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/sessions/${id}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not load session.');
  return data.session;
}

export async function updateSessionTitle(id, title) {
  const headers = await getAuthHeaders({ 'Content-Type': 'application/json' });
  const response = await fetch(`/api/sessions/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ title })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not update session title.');
  return data.session;
}

export async function deleteSession(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/sessions/${id}`, {
    method: 'DELETE',
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not delete session.');
  return true;
}

export async function uploadDocument(file, sessionId = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (sessionId) {
    formData.append('sessionId', sessionId);
  }

  const headers = await getAuthHeaders();
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    headers,
    body: formData
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to upload and process document.');
  return data.document;
}

export async function fetchDocuments(sessionId = null) {
  const headers = await getAuthHeaders();
  const url = sessionId ? `/api/documents?sessionId=${encodeURIComponent(sessionId)}` : '/api/documents';
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not load documents.');
  return data.documents || [];
}

export async function deleteDocument(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not delete document.');
  return true;
}

export async function fetchResearchRuns({ search = '', topic = '', startDate = '', endDate = '' } = {}) {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (topic) params.append('topic', topic);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`/api/research/runs?${params.toString()}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not load research archive.');
  return data.runs || [];
}

export async function fetchResearchRun(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/research/runs/${id}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not load research run.');
  return data.run;
}

export async function rerunResearchRun(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/research/runs/${id}/rerun`, {
    method: 'POST',
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Failed to re-run research.');
  return data.run;
}

export async function deleteResearchRun(id) {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/research/runs/${id}`, {
    method: 'DELETE',
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Could not delete research run.');
  return true;
}
