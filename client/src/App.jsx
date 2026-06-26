import { useEffect, useState, useRef } from 'react';
import {
  streamResearch,
  fetchSessions,
  createSession,
  fetchSession,
  updateSessionTitle,
  deleteSession,
  uploadDocument,
  fetchDocuments,
  deleteDocument,
  setAuthTokenGetter
} from './services/researchApi.js';
import { useAuth } from './context/AuthContext.jsx';
import AuthModal from './components/AuthModal.jsx';
import ResearchForm from './components/ResearchForm.jsx';
import LoadingState from './components/LoadingState.jsx';
import Answer from './components/Answer.jsx';
import Sources from './components/Sources.jsx';
import SessionSidebar from './components/SessionSidebar.jsx';
import HowItWorksGuide from './components/HowItWorksGuide.jsx';
import SplashScreen from './components/SplashScreen.jsx';
import { PanelLeftOpen, Globe, LogIn, LogOut } from 'lucide-react';

const STORAGE_SESSIONS = 'ai_research_sessions_v2';
const STORAGE_ACTIVE_ID = 'ai_research_active_id_v2';
const STORAGE_PREFIX_SESSION = 'ai_research_session_data_v2_';

function getStorageKey(uid, key) {
  return `${key}_${uid || 'guest'}`;
}

function getStoredSessions(uid) {
  try {
    const raw = localStorage.getItem(getStorageKey(uid, STORAGE_SESSIONS));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredSessions(uid, sessions) {
  try {
    localStorage.setItem(getStorageKey(uid, STORAGE_SESSIONS), JSON.stringify(sessions));
  } catch {}
}

function getStoredSession(uid, id) {
  try {
    const raw = localStorage.getItem(getStorageKey(uid, STORAGE_PREFIX_SESSION + id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(uid, id, data) {
  try {
    localStorage.setItem(getStorageKey(uid, STORAGE_PREFIX_SESSION + id), JSON.stringify(data));
  } catch {}
}

function removeStoredSession(uid, id) {
  try {
    localStorage.removeItem(getStorageKey(uid, STORAGE_PREFIX_SESSION + id));
  } catch {}
}

export default function App() {
  const { user, loading: authLoading, getIdToken, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [query, setQuery] = useState('');
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stage, setStage] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );

  // Depth setting (Quick / Standard / Deep)
  const [depth, setDepth] = useState('standard');

  // Credibility filtering settings
  const [minCredibility, setMinCredibility] = useState(0);
  const [excludeDomainTypes, setExcludeDomainTypes] = useState([]);

  // Streaming partial display state
  const [streamingState, setStreamingState] = useState({
    query: '',
    tokens: '',
    sources: []
  });

  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Documents attached to research
  const [documents, setDocuments] = useState([]);

  // Register token getter for all API calls
  useEffect(() => {
    setAuthTokenGetter(getIdToken);
  }, [getIdToken]);

  // Load user-scoped session list, archive count, and documents
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      const uid = user.uid;
      const cached = getStoredSessions(uid);
      setSessions(cached);

      const savedActiveId = localStorage.getItem(getStorageKey(uid, STORAGE_ACTIVE_ID));
      if (savedActiveId) {
        setActiveSessionId(savedActiveId);
        setActiveSession(getStoredSession(uid, savedActiveId));
      }

      loadSessions();
      loadDocuments(savedActiveId);
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setActiveSession(null);
      setDocuments([]);
    }
  }, [user?.uid, authLoading]);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) setSidebarOpen(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const textarea = document.getElementById('query');
        if (textarea) {
          textarea.focus();
          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // When active session ID changes, load full session messages and documents
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    if (!activeSessionId) {
      try {
        localStorage.removeItem(getStorageKey(uid, STORAGE_ACTIVE_ID));
      } catch {}
      setActiveSession(null);
      setDocuments([]);
      return;
    }

    try {
      localStorage.setItem(getStorageKey(uid, STORAGE_ACTIVE_ID), activeSessionId);
    } catch {}

    const local = getStoredSession(uid, activeSessionId);
    if (local) {
      setActiveSession(local);
    }
    loadSessionDetails(activeSessionId);
    loadDocuments(activeSessionId);
  }, [activeSessionId, user?.uid]);

  // Auto-scroll when messages update or streaming tokens arrive
  useEffect(() => {
    if (messagesEndRef.current && (activeSession?.messages?.length > 0 || isStreaming)) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages?.length, isStreaming, streamingState.tokens]);


  async function loadDocuments(sessionId = activeSessionId) {
    if (!user || !sessionId) {
      setDocuments([]);
      return;
    }
    try {
      const docs = await fetchDocuments(sessionId);
      setDocuments(docs || []);
    } catch (err) {
      console.warn('Failed to load documents:', err);
    }
  }

  async function handleUploadDocument(file) {
    if (!user) {
      setAuthModalOpen(true);
      return null;
    }

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const newSession = await createSession(file.name);
      currentSessionId = newSession.id;
      setActiveSessionId(newSession.id);
      setActiveSession(newSession);
      setStoredSession(user.uid, newSession.id, newSession);
      setSessions((prev) => {
        const next = [newSession, ...prev];
        setStoredSessions(user.uid, next);
        return next;
      });
    }
    const doc = await uploadDocument(file, currentSessionId);
    await loadDocuments(currentSessionId);
    return doc;
  }

  async function handleDeleteDocument(docId) {
    await deleteDocument(docId);
    if (activeSessionId) {
      await loadDocuments(activeSessionId);
    } else {
      setDocuments([]);
    }
  }

  async function loadSessions() {
    if (!user) return;
    try {
      const data = await fetchSessions();
      if (Array.isArray(data)) {
        setSessions((prev) => {
          const map = new Map();
          prev.forEach((s) => map.set(s.id, s));
          data.forEach((s) => map.set(s.id, { ...map.get(s.id), ...s }));
          const merged = Array.from(map.values());
          setStoredSessions(user.uid, merged);
          return merged;
        });
      }
    } catch (err) {
      console.warn('Failed to load sessions from server:', err);
    }
  }

  async function loadSessionDetails(id) {
    if (!user) return;
    try {
      const session = await fetchSession(id);
      if (session) {
        setActiveSession((prev) => {
          if (prev?.id === id && (prev?.messages?.length || 0) > (session.messages?.length || 0)) {
            const merged = { ...session, messages: prev.messages };
            setStoredSession(user.uid, id, merged);
            return merged;
          }
          setStoredSession(user.uid, id, session);
          return session;
        });
      }
    } catch (err) {
      console.warn('Could not sync session from server:', err);
    }
  }

  async function handleSelectSession(id) {
    if (isStreaming) handleStopStream();
    setError('');
    setDocuments([]);
    setActiveSessionId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  function handleNewSession() {
    if (isStreaming) handleStopStream();
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    try {
      localStorage.removeItem(getStorageKey(user.uid, STORAGE_ACTIVE_ID));
    } catch {}
    setActiveSessionId(null);
    setActiveSession(null);
    setDocuments([]);
    setQuery('');
    setError('');
    setStreamingState({ query: '', tokens: '', sources: [] });
    if (window.innerWidth < 768) setSidebarOpen(false);
  }

  async function handleRenameSession(id, newTitle) {
    if (!user) return;
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
      setStoredSessions(user.uid, next);
      return next;
    });
    if (activeSession?.id === id) {
      setActiveSession((prev) => {
        const next = prev ? { ...prev, title: newTitle } : prev;
        if (next) setStoredSession(user.uid, id, next);
        return next;
      });
    }
    try {
      await updateSessionTitle(id, newTitle);
    } catch (err) {
      console.warn('Server rename non-fatal:', err);
    }
  }

  async function handleDeleteSession(id) {
    if (isStreaming) handleStopStream();
    if (user) {
      removeStoredSession(user.uid, id);
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        setStoredSessions(user.uid, next);
        return next;
      });
    }
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setActiveSession(null);
    }
    try {
      await deleteSession(id);
    } catch (err) {
      console.warn('Server delete non-fatal:', err);
    }
  }

  function handleStopStream() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsLoading(false);
    loadSessions();
    if (activeSessionId) loadSessionDetails(activeSessionId);
  }

  async function handleLogout() {
    if (isStreaming) handleStopStream();
    await logout();
    setSessions([]);
    setActiveSessionId(null);
    setActiveSession(null);
    setDocuments([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!query.trim() || isLoading) return;

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    const queryText = query.trim();
    setQuery('');
    setError('');
    setStage(0);
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingState({
      query: queryText,
      tokens: '',
      sources: []
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let targetSessionId = activeSessionId;

    try {
      await streamResearch(
        {
          query: queryText,
          sessionId: activeSessionId,
          depth,
          minCredibility,
          excludeDomainTypes
        },
        {
          signal: controller.signal,
          onSession: (id) => {
            targetSessionId = id;
          },
          onStage: ({ stage: currentStage }) => {
            setStage(currentStage);
          },
          onSources: (sources) => {
            setStreamingState((prev) => ({ ...prev, sources }));
          },
          onToken: (token) => {
            setStreamingState((prev) => ({ ...prev, tokens: prev.tokens + token }));
          },
          onComplete: async (data) => {
            const userMsg = {
              id: 'user-' + Date.now(),
              role: 'user',
              content: queryText,
              sources: null,
              created_at: new Date().toISOString()
            };
            const assistantMsg = {
              id: data?.messageId || 'assistant-' + Date.now(),
              role: 'assistant',
              content: data?.answer || streamingState.tokens,
              sources: data?.sources || streamingState.sources,
              created_at: new Date().toISOString()
            };

            const targetId = targetSessionId || activeSessionId || 'session-' + Date.now();

            setActiveSession((prev) => {
              const prevMessages = (prev?.id === targetId ? prev?.messages : []) || [];
              const updated = {
                id: targetId,
                title: prev?.title || queryText.slice(0, 50),
                messages: [...prevMessages, userMsg, assistantMsg]
              };
              setStoredSession(user.uid, targetId, updated);
              return updated;
            });

            setActiveSessionId(targetId);
            setSessions((prev) => {
              const exists = prev.some((s) => s.id === targetId);
              const next = exists
                ? prev.map((s) => (s.id === targetId ? { ...s, title: s.title || queryText.slice(0, 50), message_count: (s.message_count || 0) + 2 } : s))
                : [{ id: targetId, title: queryText.slice(0, 50), message_count: 2 }, ...prev];
              setStoredSessions(user.uid, next);
              return next;
            });

            setIsStreaming(false);
            setIsLoading(false);
            setStreamingState({ query: '', tokens: '', sources: [] });
          },
          onError: (err) => {
            setError(err.message);
            setIsStreaming(false);
            setIsLoading(false);
          }
        }
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || 'Streaming failed.');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
      setIsStreaming(false);
    }
  }

  const messages = activeSession?.messages || [];

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="w-full h-screen overflow-hidden flex bg-surface-cream text-stone-800 font-sans antialiased selection:bg-brand-100 selection:text-brand-700">
        {/* Left Sidebar Navigation (Scrolls Independently) */}
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((prev) => !prev)}
          user={user}
          onLogout={handleLogout}
          onOpenAuth={() => setAuthModalOpen(true)}
        />

        {/* Main Content Area */}
        <main className="relative flex-1 flex flex-col h-screen overflow-hidden min-w-0">
          {/* Top Sticky Navigation Bar */}
          <header
            className="flex items-center justify-between px-3 sm:px-6 md:px-8 py-2.5 bg-white/80 backdrop-blur-md border-b border-surface-border z-10 shrink-0 select-none"
            data-purpose="top-navigation"
          >
            {/* Agent Status Indicator & Sidebar Toggle */}
            <div className="flex items-center gap-2.5">
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="w-10 h-10 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl border border-surface-border bg-white shadow-warm-sm transition-colors cursor-pointer flex items-center justify-center shrink-0 min-w-[40px] min-h-[40px]"
                  title="Open sidebar"
                  aria-label="Open sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-50 border border-surface-border shadow-warm-sm">
                <span className="text-xs font-bold text-stone-900 tracking-tight">AI Research Agent</span>
                <span className="hidden sm:inline text-stone-300">|</span>
                <span className="hidden sm:flex text-[11px] font-medium text-stone-500 items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-stone-400" />
                  <span>Tavily + Gemini</span>
                </span>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2.5">
              {/* Keyboard Shortcut Hint */}
              <span
                className="hidden md:inline-flex items-center px-2 py-1 text-[11px] font-mono font-medium text-stone-400 bg-stone-100 rounded border border-surface-border cursor-pointer hover:bg-stone-200 transition-colors"
                onClick={() => {
                  const textarea = document.getElementById('query');
                  if (textarea) textarea.focus();
                }}
                title="Focus search input (⌘K or Ctrl+K)"
              >
                ⌘K
              </span>

              {/* Auth Profile / Sign In CTA */}
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white border border-surface-border shadow-warm-sm">
                    <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {user.email ? user.email[0].toUpperCase() : 'U'}
                    </div>
                    <span className="hidden sm:inline-block text-xs font-medium text-stone-700 max-w-[130px] truncate" title={user.email}>
                      {user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-red-600 hover:bg-red-50 rounded-xl border border-surface-border transition min-h-[36px] flex items-center justify-center cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-black text-white rounded-xl shadow-warm-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In / Register</span>
                </button>
              )}
            </div>
          </header>

          {/* Scrollable Content Viewport (Scrolls Independently) */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 scroll-smooth"
            data-purpose="scrollable-content-area"
          >
            <div className="max-w-4xl mx-auto w-full pb-48 sm:pb-44">
              {/* Hero Header Block (when no active messages and not streaming) */}
              {messages.length === 0 && !isStreaming ? (
                <div className="pt-4 pb-8">
                  <section className="text-center mb-8" data-purpose="hero-header">
                    {/* Tagline badge */}
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs font-bold tracking-widest uppercase mb-4 shadow-warm-sm">
                      <span>Evidence-First Web Research</span>
                    </div>
                    {/* Big Bold Title with Editorial Styling */}
                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-stone-900 leading-[1.15]">
                      Ask better questions.<br />
                      <span className="font-display-serif italic font-normal text-brand-500 text-4xl sm:text-5xl md:text-6xl tracking-normal">
                        Get grounded answers.
                      </span>
                    </h2>
                    {/* Subtitle */}
                    <p className="mt-4 text-stone-600 text-sm sm:text-base md:text-lg max-w-xl mx-auto font-normal text-balance leading-relaxed">
                      Search the live web with Tavily and turn the findings into a clear, source-backed research brief with Gemini.
                    </p>
                  </section>

                  {/* 3-Step Visual Onboarding Guide on New/Empty Chat */}
                  <HowItWorksGuide />
                </div>
              ) : (
                <div className="mb-6 flex items-center gap-2.5 p-3.5 bg-white/90 backdrop-blur-sm rounded-xl border border-surface-border shadow-warm-sm">
                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200/80 text-[11px] font-bold uppercase tracking-wider">
                    Active Session
                  </span>
                  <span className="text-xs font-semibold text-stone-800 truncate">
                    {activeSession?.title || 'Current Investigation'}
                  </span>
                </div>
              )}

              {/* Message History Feed */}
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div key={message.id} className="mb-6">
                    {isUser ? (
                      <div className="flex justify-end mb-4">
                        <div className="max-w-[90%] sm:max-w-[85%] bg-brand-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-warm-sm text-sm font-medium leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Answer
                          result={{
                            query: '',
                            answer: message.content
                          }}
                          isStreaming={false}
                        />
                        {message.sources && message.sources.length > 0 && (
                          <Sources sources={message.sources} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Live Streaming Assistant Output */}
              {isStreaming && (
                <div className="mb-6">
                  {streamingState.query && (
                    <div className="flex justify-end mb-4">
                      <div className="max-w-[90%] sm:max-w-[85%] bg-brand-500 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-warm-sm text-sm font-medium leading-relaxed">
                        {streamingState.query}
                      </div>
                    </div>
                  )}

                  <div>
                    {streamingState.tokens ? (
                      <div>
                        <Answer
                          result={{ query: streamingState.query, answer: streamingState.tokens }}
                          isStreaming={true}
                        />
                        {streamingState.sources.length > 0 && <Sources sources={streamingState.sources} />}
                      </div>
                    ) : (
                      <LoadingState stage={stage} />
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs" role="alert">
                  <span className="text-red-500 shrink-0 mt-0.5 text-base">⚠️</span>
                  <div>
                    <strong className="block font-semibold">Research unavailable</strong>
                    <p className="mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Auto-scroll target anchor */}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom-Docked Persistent Composer Panel (ChatGPT / Claude / Gemini Style) */}
          <div
            className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none bg-gradient-to-t from-surface-cream via-surface-cream/90 to-transparent pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-6 md:px-8"
            data-purpose="bottom-docked-composer"
          >
            <div className="max-w-4xl mx-auto w-full pointer-events-auto">
              <ResearchForm
                query={query}
                onQueryChange={setQuery}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                isStreaming={isStreaming}
                onStop={handleStopStream}
                depth={depth}
                onDepthChange={setDepth}
                minCredibility={minCredibility}
                onMinCredibilityChange={setMinCredibility}
                excludeDomainTypes={excludeDomainTypes}
                onExcludeDomainTypesChange={setExcludeDomainTypes}
                documents={documents}
                onUploadDocument={handleUploadDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>
          </div>
        </main>

        {/* Authentication Modal */}
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
      </div>
    </>
  );
}
