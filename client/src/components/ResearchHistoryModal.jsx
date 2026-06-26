import { useState, useEffect } from 'react';
import MarkdownContent from './MarkdownContent.jsx';
import Sources from './Sources.jsx';
import {
  fetchResearchRuns,
  fetchResearchRun,
  rerunResearchRun,
  deleteResearchRun
} from '../services/researchApi.js';
import {
  Archive,
  X,
  Search,
  RotateCcw,
  MessageSquare,
  Trash2,
  FileText,
  Microscope,
  Zap,
  Compass
} from 'lucide-react';

export default function ResearchHistoryModal({ isOpen, onClose, onLoadIntoChat }) {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadRuns();
    }
  }, [isOpen, search, startDate, endDate]);

  async function loadRuns() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchResearchRuns({ search, startDate, endDate });
      setRuns(data);
      if (selectedRun) {
        const stillExists = data.find((r) => r.id === selectedRun.id);
        if (!stillExists) setSelectedRun(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectRun(runSummary) {
    try {
      const full = await fetchResearchRun(runSummary.id);
      setSelectedRun(full);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRerun(id) {
    setRerunning(true);
    setError('');
    try {
      const updated = await rerunResearchRun(id);
      setSelectedRun(updated);
      await loadRuns();
    } catch (err) {
      setError(err.message);
    } finally {
      setRerunning(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this completed research run from your persistent archive?')) return;
    try {
      await deleteResearchRun(id);
      setSelectedRun(null);
      await loadRuns();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 transition-all"
      onClick={onClose}
    >
      <div
        className="bg-surface-cream rounded-none sm:rounded-2xl border border-surface-border shadow-2xl max-w-5xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden text-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 sm:px-6 bg-white border-b border-surface-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">Persistent Research Archive</h2>
              <p className="text-xs text-stone-500">
                Search all past research briefs, or re-run them with fresh web sources.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="w-11 h-11 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 sm:px-6 bg-stone-50/80 border-b border-surface-border flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 text-xs">
          <div className="relative flex-1 w-full min-w-0 sm:min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              className="w-full min-h-11 pl-8 pr-3 py-1.5 bg-white border border-surface-border rounded-lg text-base sm:text-xs placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Search past research queries and briefs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-stone-600 font-medium">
              <span>From:</span>
              <input
                type="date"
                className="py-1 px-2 text-xs bg-white border border-surface-border rounded-md"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1 text-stone-600 font-medium">
              <span>To:</span>
              <input
                type="date"
                className="py-1 px-2 text-xs bg-white border border-surface-border rounded-md"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {(startDate || endDate || search) && (
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-md border border-brand-200"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearch('');
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Body Split */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Runs list */}
          <div className={`${selectedRun ? 'hidden md:block' : 'block'} w-full md:w-80 border-r border-surface-border overflow-y-auto p-3 space-y-2 bg-surface-sidebar shrink-0`}>
            {loading && <div className="text-xs text-stone-500 text-center py-6">Loading archive…</div>}
            {error && <div className="text-xs text-red-600 text-center py-4">{error}</div>}

            {!loading && runs.length === 0 ? (
              <div className="text-xs text-stone-400 text-center py-8">
                No past research runs match your filters.
              </div>
            ) : (
              runs.map((run) => {
                const isSelected = selectedRun?.id === run.id;
                return (
                  <div
                    key={run.id}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-orange-50/90 border-brand-300 shadow-warm-sm'
                        : 'bg-white hover:bg-white/90 border-surface-border hover:border-brand-200'
                    }`}
                    onClick={() => handleSelectRun(run)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          run.depth === 'deep'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : run.depth === 'quick'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-brand-50 text-brand-700 border border-brand-200'
                        }`}
                      >
                        {run.depth === 'deep' ? (
                          <>
                            <Microscope className="w-2.5 h-2.5 text-current" />
                            <span>Deep</span>
                          </>
                        ) : run.depth === 'quick' ? (
                          <>
                            <Zap className="w-2.5 h-2.5 text-current" />
                            <span>Quick</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-2.5 h-2.5 text-current" />
                            <span>Standard</span>
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        {new Date(run.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-stone-800 line-clamp-2 leading-snug">
                      {run.query}
                    </h4>

                    {run.topic_tags && run.topic_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {run.topic_tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] font-medium bg-stone-100 text-stone-600 px-1.5 py-0.2 rounded hover:bg-brand-50 hover:text-brand-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearch(tag);
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right: Selected Run Detail */}
          <div className={`${selectedRun ? 'block' : 'hidden md:block'} flex-1 overflow-y-auto p-4 sm:p-6 bg-white`}>
            {selectedRun ? (
              <div>
                <button type="button" onClick={() => setSelectedRun(null)} className="md:hidden min-h-11 mb-3 inline-flex items-center px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-lg">
                  ← Back to archive list
                </button>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-surface-border">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
                      {selectedRun.depth.toUpperCase()} RESEARCH
                    </span>
                    <span className="text-xs text-stone-400 font-mono ml-2">
                      Archived: {new Date(selectedRun.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-lg shadow-warm-sm transition-all disabled:opacity-50 cursor-pointer"
                      onClick={() => handleRerun(selectedRun.id)}
                      disabled={rerunning}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${rerunning ? 'animate-spin' : ''}`} />
                      <span>{rerunning ? 'Re-running…' : 'Re-run with Fresh Sources'}</span>
                    </button>

                    <button
                      type="button"
                      className="min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs rounded-lg border border-surface-border shadow-warm-sm transition-all cursor-pointer"
                      onClick={() => onLoadIntoChat(selectedRun)}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-stone-500" />
                      <span>Load in Chat</span>
                    </button>

                    <button
                      type="button"
                      className="w-11 h-11 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-xs cursor-pointer inline-flex items-center justify-center"
                      onClick={() => handleDelete(selectedRun.id)}
                      title="Delete from archive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h1 className="text-xl font-bold text-stone-900 font-display-serif mb-4 leading-tight">
                  {selectedRun.query}
                </h1>

                <article className="prose prose-stone max-w-none text-sm text-stone-800 leading-relaxed mb-8 markdown-rendered">
                  <MarkdownContent>{selectedRun.answer}</MarkdownContent>
                </article>

                {selectedRun.sources && selectedRun.sources.length > 0 && (
                  <Sources sources={selectedRun.sources} />
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400">
                <FileText className="w-10 h-10 text-stone-300 stroke-[1.5] mb-3" />
                <h3 className="text-sm font-bold text-stone-700">Select a Research Brief</h3>
                <p className="text-xs max-w-xs mt-1 text-stone-500">
                  Click any past research investigation on the left to inspect its full brief, sources, and credibility ratings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
