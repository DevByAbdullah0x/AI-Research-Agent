import { Globe, ExternalLink } from 'lucide-react';

function domain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export default function Sources({ sources }) {
  // Only display external live web sources; attached document sources are grounded via the attached file
  const webSources = (sources || []).filter(
    (source) => !source.isDocument && !source.url?.startsWith('doc://')
  );

  if (!webSources || webSources.length === 0) return null;

  return (
    <section className="mt-6 mb-8" data-purpose="sources-section">
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Evidence</span>
          <h3 className="text-base font-bold text-stone-900">Sources Consulted ({webSources.length})</h3>
        </div>
        <span className="text-xs text-stone-500 font-mono bg-white px-2.5 py-1 rounded-lg border border-surface-border shadow-warm-sm">
          Live Web Evidence
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {webSources.map((source, index) => {
          return (
            <div
              key={(source.url || index) + index}
              className="flex flex-col justify-between p-4 rounded-xl bg-surface-card border border-surface-border shadow-warm-sm hover:border-brand-400 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono bg-stone-100 text-stone-700">
                    <Globe className="w-3 h-3 text-stone-500 shrink-0" />
                  <span className="truncate">{domain(source.url)}</span>
                  </span>
                </div>

                <h4 className="text-xs font-bold text-stone-900 leading-snug line-clamp-2">
                  {source.title || domain(source.url)}
                </h4>

                {source.snippet && (
                  <p className="text-[11px] text-stone-500 mt-1.5 line-clamp-3 leading-relaxed">
                    {source.snippet}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                <a
                  className="min-h-10 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline inline-flex items-center gap-1"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
