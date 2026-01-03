export function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}

export function playTone(on: boolean) { 
  if (!on) return; 
  try {
      const ctx = new (window as any).AudioContext(); 
      const o = ctx.createOscillator(); 
      const g = ctx.createGain(); 
      o.type = 'sine'; 
      o.frequency.value = 660; 
      o.connect(g); 
      g.connect(ctx.destination); 
      g.gain.setValueAtTime(0.02, ctx.currentTime); 
      o.start(); 
      setTimeout(() => { o.stop(); ctx.close(); }, 120); 
  } catch (e) {
      console.error("[Audio] Play tone failed", e);
  }
}
