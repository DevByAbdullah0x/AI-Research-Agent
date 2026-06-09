import { Zap, Microscope, GraduationCap, ShieldCheck, Lightbulb, ArrowRight } from 'lucide-react';

export default function QuickStartCards({ onSelectPrompt }) {
  const suggestions = [
    {
      icon: Zap,
      badge: 'Quick Comparison',
      title: 'Compare React 19 vs Next.js 15',
      desc: 'Architecture, performance tradeoffs, and SSR rendering in production.',
      query:
        'Compare React 19 and Next.js 15 for building production enterprise web applications. Include key differences, SSR vs CSR tradeoffs, and ecosystem adoption.',
      depth: 'standard'
    },
    {
      icon: Microscope,
      badge: 'Deep Dive',
      title: 'Solid-State Battery Breakthroughs',
      desc: 'Latest 2025–2026 commercial milestones, energy density, and automakers.',
      query:
        'What are the most recent breakthroughs in solid-state battery technology in 2025 and 2026? Cover energy density improvements, commercial timelines, and leading manufacturers.',
      depth: 'deep'
    },
    {
      icon: GraduationCap,
      badge: 'Opportunities',
      title: 'Computer Science Scholarships',
      desc: 'High-value scholarships, eligibility criteria, and upcoming deadlines.',
      query:
        'What are the top prestigious scholarships and grants available for computer science undergraduate students in 2026? Detail awards, requirements, and deadlines.',
      depth: 'standard'
    },
    {
      icon: ShieldCheck,
      badge: 'Tech & Security',
      title: 'Post-Quantum Cryptography',
      desc: 'NIST standardized algorithms and migration roadmap for web security.',
      query:
        'Explain the current state of Post-Quantum Cryptography (PQC) standards finalized by NIST, including ML-KEM and migration challenges for TLS.',
      depth: 'standard'
    }
  ];

  return (
    <div className="mb-8" data-purpose="example-prompts-section">
      <div className="flex items-center gap-1.5 mb-3 px-1">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
          Try an example research prompt:
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {suggestions.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              className="group flex flex-col text-left p-4 rounded-xl bg-surface-card border border-surface-border hover:border-brand-300 shadow-warm-sm hover:shadow-warm-md transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer"
              onClick={() => onSelectPrompt(item.query, item.depth)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-stone-100 group-hover:bg-brand-50 text-[11px] font-semibold text-stone-600 group-hover:text-brand-700 transition-colors">
                  <Icon className="w-3 h-3 text-stone-500 group-hover:text-brand-600" />
                  <span>{item.badge}</span>
                </span>
                <span className="text-xs text-stone-400 group-hover:text-brand-500 font-medium transition-colors flex items-center gap-1">
                  <span>Use prompt</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 group-hover:text-brand-600 transition-colors leading-snug">
                {item.title}
              </h4>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                {item.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
