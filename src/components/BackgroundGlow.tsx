/** Soft pink glow fixed to the viewport; the page scrolls over it. Blooms in slowly on load. */
export function BackgroundGlow() {
  return (
    <div
      aria-hidden
      className="motion-glow pointer-events-none fixed top-0 left-1/2 -z-10 size-[1000px] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_50%,var(--color-glow)_0%,var(--color-paper)_62%)]"
    />
  )
}
