import { useState, useMemo, useEffect } from 'react';
import {
  PanelLeftClose,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2
} from 'lucide-react';

export default function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  isOpen,
  onToggle,
  user,
  onLogout,
  onOpenAuth
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  // Close context menu on outside click or Escape key
  useEffect(() => {
    function handleClickOutside() {
      setMenuOpenId(null);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setMenuOpenId(null);
    }
    if (menuOpenId) {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('click', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [menuOpenId]);

  function startEditing(session, event) {
    event.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  }

  function handleRenameSubmit(sessionId, event) {
    event.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  }

  function handleDelete(sessionId, event) {
    event.stopPropagation();
    if (window.confirm('Delete this research session and its history?')) {
      onDeleteSession(sessionId);
    }
  }

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Group sessions by Today, Yesterday, Previous 7 Days, Older
  const groupedSessions = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfLast7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: []
    };

    filteredSessions.forEach((session) => {
      const rawDate = session.updated_at || session.created_at;
      const iso = rawDate ? (rawDate.includes('T') ? rawDate : rawDate.replace(' ', 'T') + 'Z') : null;
      const time = iso ? new Date(iso).getTime() : Date.now();

      if (time >= startOfToday) {
        groups.today.push(session);
      } else if (time >= startOfYesterday) {
        groups.yesterday.push(session);
      } else if (time >= startOfLast7Days) {
        groups.last7Days.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  }, [filteredSessions]);

  function formatDate(rawDate) {
    if (!rawDate) return '';
    const iso = rawDate.includes('T') ? rawDate : rawDate.replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
  }

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-30 bg-stone-900/40 backdrop-blur-sm md:hidden" onClick={onToggle} />
      <aside
      className="fixed inset-y-0 left-0 z-40 w-[85vw] max-w-xs border-r border-surface-border bg-white flex flex-col h-[100dvh] shadow-2xl select-none md:relative md:z-30 md:w-72 lg:w-80 md:max-w-none md:shadow-none md:shrink-0 md:h-screen md:sticky md:top-0"
      data-purpose="sidebar-navigation"
    >
      {/* Brand / Workspace Header */}
      <div className="p-4 pb-3 border-b border-surface-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="AI Research Agent Logo"
              className="w-8 h-8 rounded-lg object-cover shrink-0 shadow-warm-sm"
            />
            <div>
              <h1 className="text-sm font-bold tracking-tight text-stone-900 leading-none">AI RESEARCH AGENT</h1>
              <p className="text-[11px] text-stone-500 font-medium mt-0.5">Tavily + Gemini</p>
            </div>
          </div>
          <button
            className="w-11 h-11 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse sidebar"
            type="button"
            onClick={onToggle}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="space-y-1.5">
          {/* New Chat Primary CTA */}
          <button
            className="w-full min-h-11 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold text-sm shadow-warm-md hover:shadow-glow transition-all duration-150 transform active:scale-[0.99] cursor-pointer"
            type="button"
            onClick={onNewSession}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Research</span>
          </button>
        </div>
      </div>

      {/* Search in Chats */}
      <div className="px-4 py-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="w-full min-h-11 pl-8 pr-3 py-1.5 text-base md:text-xs bg-stone-50 border border-surface-border rounded-lg text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white transition-all"
            placeholder="Search sessions..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* History List with Scroll */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4 bg-white" data-purpose="chat-history-list">
        {sessions.length === 0 ? (
          <div className="text-xs text-stone-400 text-center py-6 px-4">
            No saved sessions yet. Start a research query to create one.
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="text-xs text-stone-400 text-center py-6 px-4">
            No sessions match "{searchQuery}".
          </div>
        ) : (
          <>
            {/* Section: Today */}
            {groupedSessions.today.length > 0 && (
              <div>
                <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Today</div>
                <div className="space-y-1">
                  {groupedSessions.today.map((session) => renderSessionItem(session))}
                </div>
              </div>
            )}

            {/* Section: Yesterday */}
            {groupedSessions.yesterday.length > 0 && (
              <div>
                <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Yesterday</div>
                <div className="space-y-1">
                  {groupedSessions.yesterday.map((session) => renderSessionItem(session))}
                </div>
              </div>
            )}

            {/* Section: Previous 7 Days */}
            {groupedSessions.last7Days.length > 0 && (
              <div>
                <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Previous 7 Days</div>
                <div className="space-y-1">
                  {groupedSessions.last7Days.map((session) => renderSessionItem(session))}
                </div>
              </div>
            )}

            {/* Section: Older */}
            {groupedSessions.older.length > 0 && (
              <div>
                <div className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">Older</div>
                <div className="space-y-1">
                  {groupedSessions.older.map((session) => renderSessionItem(session))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar Footer: User Profile */}
      <div className="p-3 border-t border-surface-border bg-stone-50/70 shrink-0">
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-surface-border shadow-warm-sm">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-medium text-stone-700 truncate" title={user.email}>
                {user.email}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-[11px] font-semibold text-stone-500 hover:text-red-600 transition shrink-0 px-2 py-1 hover:bg-red-50 rounded-lg cursor-pointer"
              title="Sign Out"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              onOpenAuth?.();
              if (window.innerWidth < 768) onToggle?.();
            }}
            className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-warm-sm transition cursor-pointer"
          >
            <span>Sign In / Register</span>
          </button>
        )}
      </div>
      </aside>
    </>
  );

  function renderSessionItem(session) {
    const isActive = session.id === activeSessionId;
    const isEditing = session.id === editingId;
    const isMenuOpen = menuOpenId === session.id;

    if (isEditing) {
      return (
        <form
          key={session.id}
          className="px-3 py-2 bg-white rounded-xl border border-brand-300 shadow-warm-sm"
          onSubmit={(e) => handleRenameSubmit(session.id, e)}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            className="w-full text-xs font-semibold text-stone-900 border-0 p-0 focus:ring-0 outline-none"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            autoFocus
            onBlur={(e) => handleRenameSubmit(session.id, e)}
            maxLength={60}
          />
        </form>
      );
    }

    if (isActive) {
      return (
        <div
          key={session.id}
          className="group relative flex flex-col px-3 py-2 rounded-xl bg-orange-50/90 border border-brand-200 shadow-warm-sm transition-colors cursor-pointer"
          onClick={() => onSelectSession(session.id)}
        >
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-brand-500 rounded-r-full"></div>
          <div className="flex items-center justify-between pl-0.5">
            <span className="text-xs font-semibold text-stone-900 truncate pr-2" title={session.title}>
              {session.title}
            </span>

            {/* Three Dots Context Menu (ChatGPT / Claude style) */}
            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(isMenuOpen ? null : session.id);
                }}
                className={`p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer ${
                  isMenuOpen ? 'opacity-100 bg-stone-200/60 text-stone-700' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="More options"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-7 z-40 w-32 py-1 bg-white rounded-xl border border-surface-border shadow-warm-lg text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 hover:text-stone-900 flex items-center gap-2 font-medium cursor-pointer"
                    onClick={(e) => {
                      setMenuOpenId(null);
                      startEditing(session, e);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 text-stone-500" />
                    <span>Rename</span>
                  </button>
                  <div className="my-1 border-t border-stone-100" />
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium cursor-pointer"
                    onClick={(e) => {
                      setMenuOpenId(null);
                      handleDelete(session.id, e);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-brand-700/80 pl-0.5 font-mono">
            <span className="inline-flex items-center gap-1 font-medium font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
              Active
            </span>
            <span>•</span>
            <span className="text-stone-400">{formatDate(session.updated_at || session.created_at)}</span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={session.id}
        className="group relative flex flex-col px-3 py-2 rounded-xl text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 border border-transparent hover:border-stone-200/60 transition-all cursor-pointer"
        onClick={() => onSelectSession(session.id)}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium truncate group-hover:font-semibold pr-2" title={session.title}>
            {session.title}
          </span>

          {/* Three Dots Context Menu (ChatGPT / Claude style) */}
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : session.id);
              }}
              className={`p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer ${
                isMenuOpen ? 'opacity-100 bg-stone-200/60 text-stone-700' : 'opacity-0 group-hover:opacity-100'
              }`}
              title="More options"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 top-7 z-40 w-32 py-1 bg-white rounded-xl border border-surface-border shadow-warm-lg text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 hover:text-stone-900 flex items-center gap-2 font-medium cursor-pointer"
                  onClick={(e) => {
                    setMenuOpenId(null);
                    startEditing(session, e);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 text-stone-500" />
                  <span>Rename</span>
                </button>
                <div className="my-1 border-t border-stone-100" />
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium cursor-pointer"
                  onClick={(e) => {
                    setMenuOpenId(null);
                    handleDelete(session.id, e);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-stone-400 font-mono">
          <span>{formatDate(session.updated_at || session.created_at)}</span>
        </div>
      </div>
    );
  }
}
