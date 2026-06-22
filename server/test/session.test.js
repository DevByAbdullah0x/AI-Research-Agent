import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from '../src/db/database.js';

describe('Conversation History & Sessions', () => {
  const testSessionId = `test-session-${randomUUID()}`;

  test('should create a new session', () => {
    const session = database.createSession({
      id: testSessionId,
      title: 'Quantum Computing Research'
    });

    assert.equal(session.id, testSessionId);
    assert.equal(session.title, 'Quantum Computing Research');
    assert.ok(session.created_at);
  });

  test('should list sessions including the created session', () => {
    const sessions = database.getSessions();
    const found = sessions.find((s) => s.id === testSessionId);
    assert.ok(found, 'Session should be found in session list');
    assert.equal(found.title, 'Quantum Computing Research');
  });

  test('should add messages and retrieve session with message history', () => {
    const userMsgId = randomUUID();
    const asstMsgId = randomUUID();

    database.createMessage({
      id: userMsgId,
      sessionId: testSessionId,
      role: 'user',
      content: 'What is quantum superposition?'
    });

    const mockSources = [
      { title: 'Quantum Physics Guide', url: 'https://example.com/quantum', snippet: 'Superposition explanation' }
    ];

    database.createMessage({
      id: asstMsgId,
      sessionId: testSessionId,
      role: 'assistant',
      content: 'Quantum superposition is a fundamental principle of quantum mechanics...',
      sources: mockSources
    });

    const sessionWithMessages = database.getSession(testSessionId);
    assert.ok(sessionWithMessages);
    assert.equal(sessionWithMessages.messages.length, 2);
    assert.equal(sessionWithMessages.messages[0].role, 'user');
    assert.equal(sessionWithMessages.messages[1].role, 'assistant');
    assert.deepEqual(sessionWithMessages.messages[1].sources, mockSources);
  });

  test('should update session title', () => {
    const updated = database.updateSessionTitle(testSessionId, 'Renamed Quantum Topic');
    assert.equal(updated.title, 'Renamed Quantum Topic');

    const fetched = database.getSession(testSessionId);
    assert.equal(fetched.title, 'Renamed Quantum Topic');
  });

  test('should delete session and cascade delete its messages', () => {
    const deleted = database.deleteSession(testSessionId);
    assert.equal(deleted, true);

    const fetched = database.getSession(testSessionId);
    assert.equal(fetched, null);

    const messages = database.getMessages(testSessionId);
    assert.equal(messages.length, 0);
  });
});

