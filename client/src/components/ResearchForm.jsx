import { useEffect, useState, useRef } from 'react';
import {
  Paperclip,
  FileText,
  X,
  Zap,
  Compass,
  Microscope,
  SlidersHorizontal,
  Square,
  ArrowRight,
  Loader2,
  Mic,
  MicOff
} from 'lucide-react';

export default function ResearchForm({
  query,
  onQueryChange,
  onSubmit,
  isLoading,
  isStreaming,
  onStop,
  depth,
  onDepthChange,
  minCredibility,
  onMinCredibilityChange,
  excludeDomainTypes,
  onExcludeDomainTypesChange,
  documents = [],
  onUploadDocument,
  onDeleteDocument
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const domainOptions = [
    { id: 'forum', label: 'Forums & Social' },
    { id: 'commercial', label: 'Commercial (.com)' },
    { id: 'unknown', label: 'Unverified domains' }
  ];

  function toggleDomainType(type) {
    if (excludeDomainTypes.includes(type)) {
      onExcludeDomainTypesChange(excludeDomainTypes.filter((t) => t !== type));
    } else {
      onExcludeDomainTypesChange([...excludeDomainTypes, type]);
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setIsUploading(true);
    try {
      await onUploadDocument(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && !isStreaming && query.trim()) {
        onSubmit(e);
      }
    }
  }

  function toggleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    setVoiceError('');
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    let baseQuery = query;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      onQueryChange(`${baseQuery}${baseQuery && transcript ? ' ' : ''}${transcript}`.trimStart());
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        setVoiceError(event.error === 'not-allowed' ? 'Microphone permission was not granted.' : 'Voice input could not be started.');
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <section
      className="bg-surface-card rounded-2xl border border-surface-border shadow-warm-lg transition-all duration-200 focus-within:border-brand-400 focus-within:shadow-glow overflow-hidden"
      data-purpose="compact-research-composer"
    >
      {/* Grounding Attachment Chips (only if documents are attached) */}
      {documents.length > 0 && (
        <div
          className="px-3.5 py-1.5 flex flex-wrap items-center gap-1.5 border-b border-stone-100 bg-stone-50/50 text-xs"
          data-purpose="attachment-tray"
        >
          <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
            <Paperclip className="w-3 h-3 text-stone-400" />
            <span>Grounding ({documents.length}):</span>
          </span>

          {documents.map((doc) => {
            const displayName = doc.filename || doc.name || 'Document';
            const pageCount = doc.page_count || doc.total_pages || 1;

            return (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-brand-200 text-stone-700 rounded-md text-[11px] font-medium shadow-warm-sm"
              >
                <FileText className="w-3 h-3 text-brand-500 shrink-0" />
                <span className="font-mono truncate max-w-[110px] sm:max-w-[180px]" title={displayName}>
                  {displayName}
                </span>
                <span className="text-[10px] text-stone-400 font-mono">({pageCount}p)</span>
                <button
                  className="min-w-8 min-h-8 -mr-1 inline-flex items-center justify-center text-stone-400 hover:text-red-500 ml-0.5 cursor-pointer"
                  title="Remove attachment"
                  type="button"
                  onClick={() => onDeleteDocument(doc.id)}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Expandable Sources Filter Drawer (only if toggled) */}
      {showFilters && (
        <div className="px-4 py-3 bg-stone-50/90 border-b border-stone-100 text-xs flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-stone-700 text-[11px]">Exclude:</span>
            {domainOptions.map((opt) => (
              <label
                key={opt.id}
                className="inline-flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-surface-border text-stone-600 text-[11px]"
              >
                <input
                  type="checkbox"
                  checked={excludeDomainTypes.includes(opt.id)}
                  onChange={() => toggleDomainType(opt.id)}
                  className="rounded text-brand-500 focus:ring-brand-400 h-3 w-3"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Main Input Form */}
      <form className="p-3" data-purpose="query-input-form" onSubmit={onSubmit}>
        <textarea
          id="query"
          className="w-full resize-none border-0 p-0 text-stone-800 placeholder-stone-400 text-base focus:ring-0 leading-relaxed bg-transparent font-normal outline-none max-h-32"
          placeholder="Type here..."
          rows="2"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading || isStreaming}
          maxLength={1000}
        />

        {uploadError && (
          <div className="mt-1 text-xs text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200">
            ⚠️ {uploadError}
          </div>
        )}

        {voiceError && (
          <div className="mt-1 text-xs text-amber-700 bg-amber-50 p-1.5 rounded-lg border border-amber-200" role="status">
            {voiceError}
          </div>
        )}

        {/* Integrated Clean Toolbar: Mode Switcher + Attach + Submit */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-stone-100 gap-2">
          {/* Left: Mode selector & Attach */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Attach Document Button */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.txt,.md,.docx"
              onChange={handleFileSelect}
              disabled={isUploading || isLoading || isStreaming}
            />
            <button
              className="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-brand-600 bg-stone-100/80 hover:bg-brand-50 border border-stone-200/80 rounded-lg transition-colors cursor-pointer"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading || isStreaming}
              title="Attach PDF or document to ground answer"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-500" />
              ) : (
                <Paperclip className="w-3.5 h-3.5 text-stone-500" />
              )}
              <span className="hidden sm:inline text-[11px]">{isUploading ? 'Uploading…' : 'Attach'}</span>
            </button>

            <button
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                isListening
                  ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                  : 'text-stone-600 hover:text-brand-600 bg-stone-100/80 hover:bg-brand-50 border-stone-200/80'
              }`}
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading || isStreaming}
              title={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              aria-pressed={isListening}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isListening ? 'Listening…' : 'Voice'}</span>
            </button>

            {/* Depth Mode Segmented Pills (Ultra-Compact) */}
            <div className="inline-flex p-0.5 bg-stone-100 rounded-lg border border-stone-200/60 text-xs">
              <button
                type="button"
                onClick={() => onDepthChange('quick')}
                disabled={isLoading || isStreaming}
                className={`min-h-[34px] inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  depth === 'quick'
                    ? 'bg-white text-stone-900 shadow-sm font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Quick Brief: 1 query · 3 sources · ~3s"
              >
                <Zap className="w-3 h-3 text-current" />
                <span className="hidden sm:inline">Quick</span>
              </button>
              <button
                type="button"
                onClick={() => onDepthChange('standard')}
                disabled={isLoading || isStreaming}
                className={`min-h-[34px] inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  depth === 'standard'
                    ? 'bg-white text-stone-900 shadow-sm font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Standard Deep Dive: 2 queries · 6 sources · ~8s"
              >
                <Compass className="w-3 h-3 text-current" />
                <span className="hidden sm:inline">Standard</span>
              </button>
              <button
                type="button"
                onClick={() => onDepthChange('deep')}
                disabled={isLoading || isStreaming}
                className={`min-h-[34px] inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  depth === 'deep'
                    ? 'bg-white text-stone-900 shadow-sm font-bold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Deep Investigation: 4 queries · up to 12 sources · ~18s"
              >
                <Microscope className="w-3 h-3 text-current" />
                <span className="hidden sm:inline">Deep</span>
              </button>
            </div>

            {/* Filters toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-[38px] inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] transition-colors border cursor-pointer ${
                showFilters || excludeDomainTypes.length > 0
                  ? 'bg-orange-50 text-brand-700 border-brand-300 font-semibold'
                  : 'text-stone-500 hover:text-stone-700 border-transparent hover:border-stone-200'
              }`}
              title="Credibility scoring and domain filters"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Filters</span>
            </button>
          </div>

          {/* Right: Submit Button & Char Count */}
          <div className="flex items-center gap-2">
            {query.length > 0 && (
              <span className="text-[10px] font-mono text-stone-400 hidden sm:inline">
                {query.length}/1000
              </span>
            )}

            {isStreaming ? (
              <button
                className="min-h-11 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl shadow-warm-sm transition-all cursor-pointer"
                type="button"
                onClick={onStop}
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold text-xs rounded-xl shadow-warm-sm hover:shadow-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                type="submit"
                disabled={isLoading || !query.trim()}
                title="Start research (Enter)"
              >
                <span>{isLoading ? 'Researching…' : 'Research'}</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
