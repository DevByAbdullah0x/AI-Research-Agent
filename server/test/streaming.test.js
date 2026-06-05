import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Streaming Responses & Cancellation', () => {
  test('should parse SSE data events correctly', () => {
    const rawSseChunk = `event: stage\ndata: {"stage":0,"text":"Searching the web…"}\n\nevent: token\ndata: {"token":"Hello "}\n\nevent: token\ndata: {"token":"world!"}\n\n`;

    const events = [];
    const blocks = rawSseChunk.split('\n\n').filter(Boolean);

    for (const block of blocks) {
      const lines = block.split('\n');
      let eventType = 'message';
      let data = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          data = JSON.parse(line.slice(6));
        }
      }

      if (data !== null) {
        events.push({ type: eventType, data });
      }
    }

    assert.equal(events.length, 3);
    assert.equal(events[0].type, 'stage');
    assert.equal(events[0].data.stage, 0);
    assert.equal(events[1].type, 'token');
    assert.equal(events[1].data.token, 'Hello ');
    assert.equal(events[2].type, 'token');
    assert.equal(events[2].data.token, 'world!');
  });

  test('should handle abort signal cancellation', async () => {
    const abortController = new AbortController();
    let aborted = false;

    abortController.signal.addEventListener('abort', () => {
      aborted = true;
    });

    // Simulate in-flight streaming
    abortController.abort();

    assert.equal(aborted, true);
    assert.equal(abortController.signal.aborted, true);
  });
});

