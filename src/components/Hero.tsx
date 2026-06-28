export default function Hero() {
  return (
    <header className="pt-16 pb-10 sm:pt-24 sm:pb-14">
      <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl md:text-7xl">
        Harmonic Coach
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
        An AI lead-sheet tutor for harmonic understanding.
      </p>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted)]/90">
        Drop in the chords for any bar of a chart, and the coach explains the
        function, the voice leading, and how to practice it.
      </p>
    </header>
  );
}
