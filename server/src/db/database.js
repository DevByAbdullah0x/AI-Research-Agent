import { firestoreDb } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Cloud Firestore Database Service
 * Replaces SQLite with fully-persistent cloud storage
 */
export const database = {
  // ==========================================
  // Session Methods
  // ==========================================
  async getSessions(userId = null) {
    try {
      let queryRef = firestoreDb.collection('sessions');
      if (userId) {
        queryRef = queryRef.where('userId', '==', userId);
      }

      const snapshot = await queryRef.get();
      const sessions = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          user_id: data.userId || null,
          title: data.title || 'Untitled Session',
          created_at: data.createdAt || new Date().toISOString(),
          updated_at: data.updatedAt || new Date().toISOString(),
          message_count: typeof data.messageCount === 'number' ? data.messageCount : 0
        };
      });

      // Sort by updated_at descending in memory
      sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      return sessions;
    } catch (err) {
      console.error('[Firestore] Failed to get sessions:', err.message);
      return [];
    }
  },

  async getSession(id, userId = null) {
    try {
      const docRef = firestoreDb.collection('sessions').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) {
        return null;
      }

      // Fetch nested messages subcollection
      const messagesSnap = await docRef.collection('messages').get();
      const messages = messagesSnap.docs.map((m) => {
        const mData = m.data();
        return {
          id: m.id,
          session_id: id,
          role: mData.role,
          content: mData.content,
          sources: mData.sources || null,
          created_at: mData.createdAt || new Date().toISOString()
        };
      });

      // Sort messages chronologically
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return {
        id: doc.id,
        user_id: data.userId || null,
        title: data.title || 'Untitled Session',
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: data.updatedAt || new Date().toISOString(),
        messages
      };
    } catch (err) {
      console.error(`[Firestore] Failed to get session ${id}:`, err.message);
      return null;
    }
  },

  async createSession({ id, title, userId = null }) {
    const now = new Date().toISOString();
    const sessionData = {
      userId: userId || null,
      title: title || 'New Research Session',
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    };

    await firestoreDb.collection('sessions').doc(id).set(sessionData);
    return {
      id,
      user_id: userId || null,
      title: sessionData.title,
      created_at: now,
      updated_at: now,
      message_count: 0
    };
  },

  async updateSessionTitle(id, title, userId = null) {
    try {
      const docRef = firestoreDb.collection('sessions').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) return null;

      const now = new Date().toISOString();
      await docRef.update({
        title,
        updatedAt: now
      });

      return {
        id,
        user_id: data.userId || null,
        title,
        created_at: data.createdAt,
        updated_at: now
      };
    } catch (err) {
      console.error(`[Firestore] Failed to update session title ${id}:`, err.message);
      return null;
    }
  },

  async touchSession(id) {
    try {
      const now = new Date().toISOString();
      await firestoreDb.collection('sessions').doc(id).update({
        updatedAt: now
      });
    } catch {}
  },

  async deleteSession(id, userId = null) {
    try {
      const docRef = firestoreDb.collection('sessions').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return false;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) return false;

      // 1. Delete all messages in subcollection
      const messagesSnap = await docRef.collection('messages').get();
      const batch = firestoreDb.batch();
      messagesSnap.docs.forEach((m) => batch.delete(m.ref));
      batch.delete(docRef);
      await batch.commit();

      // 2. Delete attached documents for this session
      try {
        const docsSnap = await firestoreDb.collection('documents').where('sessionId', '==', id).get();
        if (!docsSnap.empty) {
          const docBatch = firestoreDb.batch();
          for (const d of docsSnap.docs) {
            const chunksSnap = await d.ref.collection('chunks').get();
            chunksSnap.docs.forEach((c) => docBatch.delete(c.ref));
            docBatch.delete(d.ref);
          }
          await docBatch.commit();
        }
      } catch (docErr) {
        console.warn(`[Firestore] Error cleaning documents for session ${id}:`, docErr.message);
      }

      return true;
    } catch (err) {
      console.error(`[Firestore] Failed to delete session ${id}:`, err.message);
      return false;
    }
  },

  // ==========================================
  // Message Methods
  // ==========================================
  async getMessages(sessionId) {
    try {
      const messagesSnap = await firestoreDb
        .collection('sessions')
        .doc(sessionId)
        .collection('messages')
        .get();

      const messages = messagesSnap.docs.map((m) => {
        const data = m.data();
        return {
          id: m.id,
          session_id: sessionId,
          role: data.role,
          content: data.content,
          sources: data.sources || null,
          created_at: data.createdAt || new Date().toISOString()
        };
      });

      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return messages;
    } catch (err) {
      console.error(`[Firestore] Failed to get messages for session ${sessionId}:`, err.message);
      return [];
    }
  },

  async createMessage({ id, sessionId, role, content, sources = null }) {
    const now = new Date().toISOString();
    const sessionRef = firestoreDb.collection('sessions').doc(sessionId);
    const msgRef = sessionRef.collection('messages').doc(id);

    await msgRef.set({
      role,
      content,
      sources: sources || null,
      createdAt: now
    });

    try {
      await sessionRef.set(
        {
          updatedAt: now,
          messageCount: FieldValue.increment(1)
        },
        { merge: true }
      );
    } catch {}

    return {
      id,
      session_id: sessionId,
      role,
      content,
      sources,
      created_at: now
    };
  },

  // ==========================================
  // Document Methods
  // ==========================================
  async createDocument({ id, sessionId = null, filename, mimeType, fileSize, pageCount = 1 }) {
    const now = new Date().toISOString();
    const docData = {
      sessionId,
      filename,
      mimeType,
      fileSize,
      pageCount,
      createdAt: now
    };

    await firestoreDb.collection('documents').doc(id).set(docData);
    return {
      id,
      session_id: sessionId,
      filename,
      mime_type: mimeType,
      file_size: fileSize,
      page_count: pageCount,
      created_at: now
    };
  },

  async getDocuments(sessionId = null) {
    if (!sessionId) return [];
    try {
      const snap = await firestoreDb.collection('documents').where('sessionId', '==', sessionId).get();
      const docs = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          session_id: data.sessionId,
          filename: data.filename,
          mime_type: data.mimeType,
          file_size: data.fileSize,
          page_count: data.pageCount || 1,
          created_at: data.createdAt || new Date().toISOString()
        };
      });

      docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return docs;
    } catch (err) {
      console.error(`[Firestore] Failed to get documents for session ${sessionId}:`, err.message);
      return [];
    }
  },

  async deleteDocument(id) {
    try {
      const docRef = firestoreDb.collection('documents').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return false;

      // Delete subcollection chunks
      const chunksSnap = await docRef.collection('chunks').get();
      const batch = firestoreDb.batch();
      chunksSnap.docs.forEach((c) => batch.delete(c.ref));
      batch.delete(docRef);
      await batch.commit();

      return true;
    } catch (err) {
      console.error(`[Firestore] Failed to delete document ${id}:`, err.message);
      return false;
    }
  },

  async createDocumentChunk({ id, documentId, pageNumber, chunkIndex, chunkText, embedding = null }) {
    await firestoreDb
      .collection('documents')
      .doc(documentId)
      .collection('chunks')
      .doc(id)
      .set({
        pageNumber,
        chunkIndex,
        chunkText,
        embedding: embedding || null
      });
  },

  async getDocumentChunks(documentId) {
    try {
      const snap = await firestoreDb
        .collection('documents')
        .doc(documentId)
        .collection('chunks')
        .get();

      const chunks = snap.docs.map((c) => ({
        id: c.id,
        document_id: documentId,
        page_number: c.data().pageNumber,
        chunk_index: c.data().chunkIndex,
        chunk_text: c.data().chunkText,
        embedding: c.data().embedding
      }));

      chunks.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0));
      return chunks;
    } catch (err) {
      console.error(`[Firestore] Failed to get chunks for document ${documentId}:`, err.message);
      return [];
    }
  },

  async getAllDocumentChunks(sessionId = null) {
    if (!sessionId) return [];
    try {
      const docsSnap = await firestoreDb.collection('documents').where('sessionId', '==', sessionId).get();
      const allChunks = [];

      for (const d of docsSnap.docs) {
        const docData = d.data();
        const chunksSnap = await d.ref.collection('chunks').get();
        chunksSnap.docs.forEach((c) => {
          const cData = c.data();
          allChunks.push({
            id: c.id,
            document_id: d.id,
            filename: docData.filename,
            mime_type: docData.mimeType,
            page_number: cData.pageNumber,
            chunk_index: cData.chunkIndex,
            chunk_text: cData.chunkText
          });
        });
      }

      return allChunks;
    } catch (err) {
      console.error(`[Firestore] Failed to get all document chunks for session ${sessionId}:`, err.message);
      return [];
    }
  },

  // ==========================================
  // Research Runs (Archive & History)
  // ==========================================
  async createResearchRun({ id, sessionId = null, query, depth = 'standard', answer, sources, topicTags = [], userId = null }) {
    const now = new Date().toISOString();
    const runData = {
      userId: userId || null,
      sessionId,
      query,
      depth,
      answer,
      sources: sources || [],
      topicTags: topicTags || [],
      createdAt: now,
      updatedAt: now
    };

    await firestoreDb.collection('research_runs').doc(id).set(runData);
    return {
      id,
      user_id: userId || null,
      session_id: sessionId,
      query,
      depth,
      answer,
      sources,
      topic_tags: topicTags,
      created_at: now,
      updated_at: now
    };
  },

  async getResearchRuns({ userId = null, search = '', topic = '', startDate = '', endDate = '', limit = 50 } = {}) {
    try {
      let queryRef = firestoreDb.collection('research_runs');
      if (userId) {
        queryRef = queryRef.where('userId', '==', userId);
      }

      const snapshot = await queryRef.get();
      let runs = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          user_id: data.userId || null,
          session_id: data.sessionId || null,
          query: data.query,
          depth: data.depth,
          topic_tags: data.topicTags || [],
          created_at: data.createdAt,
          updated_at: data.updatedAt
        };
      });

      if (search) {
        const s = search.toLowerCase();
        runs = runs.filter((r) => (r.query || '').toLowerCase().includes(s));
      }

      if (topic) {
        runs = runs.filter((r) => Array.isArray(r.topic_tags) && r.topic_tags.includes(topic));
      }

      if (startDate) {
        runs = runs.filter((r) => r.created_at >= startDate);
      }

      if (endDate) {
        runs = runs.filter((r) => r.created_at <= endDate);
      }

      runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return runs.slice(0, Number(limit) || 50);
    } catch (err) {
      console.error('[Firestore] Failed to get research runs:', err.message);
      return [];
    }
  },

  async getResearchRunById(id, userId = null) {
    try {
      const doc = await firestoreDb.collection('research_runs').doc(id).get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) return null;

      return {
        id: doc.id,
        user_id: data.userId || null,
        session_id: data.sessionId || null,
        query: data.query,
        depth: data.depth,
        answer: data.answer,
        sources: data.sources || [],
        topic_tags: data.topicTags || [],
        created_at: data.createdAt,
        updated_at: data.updatedAt
      };
    } catch (err) {
      console.error(`[Firestore] Failed to get research run ${id}:`, err.message);
      return null;
    }
  },

  async updateResearchRun(id, { answer, sources, depth }, userId = null) {
    try {
      const docRef = firestoreDb.collection('research_runs').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) return null;

      const now = new Date().toISOString();
      await docRef.update({
        answer,
        sources: sources || [],
        depth,
        updatedAt: now
      });

      return this.getResearchRunById(id, userId);
    } catch (err) {
      console.error(`[Firestore] Failed to update research run ${id}:`, err.message);
      return null;
    }
  },

  async deleteResearchRun(id, userId = null) {
    try {
      const docRef = firestoreDb.collection('research_runs').doc(id);
      const doc = await docRef.get();
      if (!doc.exists) return false;

      const data = doc.data();
      if (userId && data.userId && data.userId !== userId) return false;

      await docRef.delete();
      return true;
    } catch (err) {
      console.error(`[Firestore] Failed to delete research run ${id}:`, err.message);
      return false;
    }
  },

  // ==========================================
  // OTP Authentication Storage
  // ==========================================
  async saveOtp(email, codeHash, expiresAt) {
    try {
      const normalized = email.trim().toLowerCase();
      await firestoreDb.collection('otps').doc(normalized).set({
        email: normalized,
        codeHash,
        expiresAt: Number(expiresAt)
      });
    } catch (err) {
      console.warn('[Firestore] Failed to save OTP:', err.message);
    }
  },

  async getOtp(email) {
    try {
      const normalized = email.trim().toLowerCase();
      const doc = await firestoreDb.collection('otps').doc(normalized).get();
      if (!doc.exists) return null;

      const data = doc.data();
      return {
        email: data.email,
        code_hash: data.codeHash,
        expires_at: data.expiresAt
      };
    } catch (err) {
      console.warn('[Firestore] Failed to get OTP:', err.message);
      return null;
    }
  },

  async deleteOtp(email) {
    try {
      const normalized = email.trim().toLowerCase();
      await firestoreDb.collection('otps').doc(normalized).delete();
    } catch (err) {
      console.warn('[Firestore] Failed to delete OTP:', err.message);
    }
  }
};
