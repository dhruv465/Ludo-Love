export function playSafeSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const tones = [720, 960];

    tones.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, now + index * 0.06);
      osc.connect(gain);
      osc.start(now + index * 0.06);
      osc.stop(now + index * 0.06 + 0.16);
    });

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  } catch {
    // Browser may block audio until a user gesture.
  }
}
