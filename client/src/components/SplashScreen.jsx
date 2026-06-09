import { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 1800);
    const completeTimer = window.setTimeout(onComplete, 2250);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  function skip() {
    setIsLeaving(true);
    window.setTimeout(onComplete, 250);
  }

  return (
    <section
      className={`fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#050505] px-6 text-[#fffaf4] transition-opacity duration-500 ${isLeaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      aria-label="AI Research Agent welcome screen"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,107,43,0.12),transparent_32%)]" />
      <div className="relative flex w-full max-w-2xl flex-col items-center text-center animate-[pulse_2s_ease-in-out_infinite]">
        <img
          src="/logo.png"
          alt="AI Research Agent"
          className="mb-8 w-40 sm:w-48 rounded-[2rem] shadow-[0_0_52px_rgba(255,107,43,0.18)]"
        />
        <h1 className="text-4xl font-extrabold tracking-[0.04em] sm:text-6xl md:text-7xl">
          <span className="bg-gradient-to-b from-[#ffb04a] to-[#ff5d16] bg-clip-text text-transparent">AI</span>{' '}
          <span>RESEARCH</span>
        </h1>
        <div className="mt-3 flex w-full max-w-md items-center gap-3 text-[#ff8b32]">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#ff7a26]" />
          <span className="text-xl font-semibold tracking-[0.5em] sm:text-2xl">AGENT</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#ff7a26]" />
        </div>
        <p className="mt-8 text-xs font-medium uppercase tracking-[0.22em] text-stone-400 sm:text-sm">
          Evidence-first web research
        </p>
      </div>
      <button
        type="button"
        onClick={skip}
        className="absolute bottom-6 right-6 min-h-11 rounded-full border border-white/15 px-4 text-xs font-semibold text-stone-300 transition hover:border-brand-400 hover:text-white"
      >
        Skip intro
      </button>
    </section>
  );
}
