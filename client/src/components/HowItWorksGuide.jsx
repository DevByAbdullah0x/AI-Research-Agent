import { useState } from 'react';
import { MessageSquare, Search, FileText, Compass, X } from 'lucide-react';

export default function HowItWorksGuide() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const steps = [
    {
      num: '1',
      icon: MessageSquare,
      title: 'Ask or Attach',
      desc: 'Type any research topic or attach a PDF/Word file to ground the answer.'
    },
    {
      num: '2',
      icon: Search,
      title: 'Live Web & Vetting',
      desc: 'Search live web sources with Tavily and verify information across top domains.'
    },
    {
      num: '3',
      icon: FileText,
      title: 'Cited Brief',
      desc: 'Gemini streams an evidence-backed summary with direct source links.'
    }
  ];

  return (
    <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-stone-50/80 border border-surface-border shadow-warm-sm" data-purpose="onboarding-guide">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5 uppercase tracking-wide">
          <Compass className="w-3.5 h-3.5 text-stone-500" />
          <span>How Research Studio Works</span>
        </span>
        <button
          type="button"
          className="w-10 h-10 text-stone-400 hover:text-stone-700 p-1 rounded-md transition-colors cursor-pointer inline-flex items-center justify-center"
          onClick={() => setIsDismissed(true)}
          title="Dismiss this guide"
          aria-label="Dismiss guide"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div key={step.num} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-surface-borderLight shadow-warm-sm">
              <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 border border-stone-200/60 font-bold text-xs flex items-center justify-center shrink-0">
                {step.num}
              </div>
              <div>
                <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  <span>{step.title}</span>
                </h4>
                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
