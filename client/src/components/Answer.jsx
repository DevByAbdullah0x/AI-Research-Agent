import MarkdownContent from './MarkdownContent.jsx';
import { Zap, FileText } from 'lucide-react';

export default function Answer({ result, isStreaming = false }) {
  return (
    <section className="bg-surface-card rounded-2xl border border-surface-border shadow-warm-md p-4 sm:p-6 mb-6 transition-all min-w-0" data-purpose="answer-panel">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-surface-borderLight">
        <div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
            {isStreaming ? (
              <>
                <Zap className="w-3 h-3 text-brand-600" />
                <span>Live Synthesis</span>
              </>
            ) : (
              <>
                <FileText className="w-3 h-3 text-brand-600" />
                <span>Research Brief</span>
              </>
            )}
          </span>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-stone-900 mt-1.5 font-display-serif overflow-wrap-anywhere">
            {result.query}
          </h2>
        </div>
        {isStreaming && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Streaming token-by-token…
          </span>
        )}
      </div>

      <article className="prose prose-stone max-w-none text-stone-800 text-sm md:text-base leading-relaxed space-y-4 markdown-rendered">
        <MarkdownContent>{result.answer}</MarkdownContent>
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-brand-500 animate-pulse ml-0.5 align-middle" />
        )}
      </article>
    </section>
  );
}
