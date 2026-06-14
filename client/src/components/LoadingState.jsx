import { Loader2, Check } from 'lucide-react';

export default function LoadingState({ stage }) {
  const steps = [
    'Searching live web sources with Tavily…',
    'Analyzing content & extracting key findings…',
    'Synthesizing evidence-backed response with Gemini…'
  ];

  return (
    <section
      className="bg-surface-card rounded-2xl border border-surface-border shadow-warm-md p-6 mb-6 transition-all"
      aria-live="polite"
      data-purpose="loading-panel"
    >
      <div className="flex items-center gap-4 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-brand-200 flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200">
            Research In Progress
          </span>
          <h3 className="text-base font-bold text-stone-900 mt-1">{steps[stage] || steps[0]}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-stone-100">
        {steps.map((step, index) => {
          const isDone = index < stage;
          const isCurrent = index === stage;

          return (
            <div
              key={step}
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${
                isCurrent
                  ? 'bg-orange-50/80 border-brand-300 text-brand-800 font-semibold shadow-warm-sm'
                  : isDone
                  ? 'bg-stone-50 border-stone-200 text-stone-700'
                  : 'bg-stone-50/40 border-stone-100 text-stone-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-mono flex items-center justify-center shrink-0 ${
                  isCurrent
                    ? 'bg-brand-500 text-white font-bold'
                    : isDone
                    ? 'bg-emerald-500 text-white font-bold'
                    : 'bg-stone-200 text-stone-600'
                }`}
              >
                {isDone ? <Check className="w-3 h-3 text-white stroke-[3]" /> : index + 1}
              </span>
              <span className="truncate">{step.replace('…', '')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
