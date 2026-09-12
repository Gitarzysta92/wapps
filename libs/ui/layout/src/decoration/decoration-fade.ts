/** Publish scroll progress; the portal theme decides how much the canvases fade. */
export function createDecorationFade(host: HTMLElement): () => void {
  const view = host.ownerDocument.defaultView;
  if (!view) return () => undefined;
  // The theme opts into compositor-driven scroll timelines where the browser supports them.
  const style = view.getComputedStyle(host);
  if (style.getPropertyValue('--decoration-native-scroll').trim() === '1') return () => undefined;
  const property = '--decoration-fade-progress';
  let distance = Math.max(1, parseFloat(style.getPropertyValue('--decoration-fade-distance')) || 400);
  let frame: number | undefined;
  let previous = '';

  const update = () => {
    frame = undefined;
    const progress = Math.max(0, Math.min(1, view.scrollY / distance));
    // Smoothstep eases both ends and reverses naturally when scrolling back up.
    const value = String(progress * progress * (3 - 2 * progress));
    if (value === previous) return;
    previous = value;
    host.style.setProperty(property, value);
  };
  const schedule = () => {
    if (frame === undefined) frame = view.requestAnimationFrame(update);
  };
  view.addEventListener('scroll', schedule, { passive: true });
  const resize = () => {
    distance = Math.max(1, parseFloat(view.getComputedStyle(host).getPropertyValue('--decoration-fade-distance')) || 400);
    schedule();
  };
  view.addEventListener('resize', resize);
  update();

  return () => {
    view.removeEventListener('scroll', schedule);
    view.removeEventListener('resize', resize);
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    host.style.removeProperty(property);
  };
}
