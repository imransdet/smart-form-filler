(function (global) {
  let audioCtx = null;

  // Pure inline-style transitions instead of an injected <style>/@keyframes block:
  // many sites' CSP blocks inline stylesheets, which would silently kill the
  // animation with no error anywhere. Setting el.style.* directly is not subject
  // to a page's style-src CSP, so this works everywhere.
  function flashElement(el) {
    if (!el || !el.style) return;
    const prevTransition = el.style.transition;
    const prevBoxShadow = el.style.boxShadow;

    el.style.transition = "none";
    el.style.boxShadow = "0 0 0 3px rgba(13, 163, 75, 0.65)";
    void el.offsetWidth; // force reflow so the instant show isn't itself transitioned

    el.style.transition = "box-shadow 0.6s ease-out";
    el.style.boxShadow = "0 0 0 0 rgba(13, 163, 75, 0)";

    setTimeout(() => {
      el.style.transition = prevTransition;
      el.style.boxShadow = prevBoxShadow;
    }, 650);
  }

  // Synthesized soft keyboard key-press sound: a short low-passed noise "tap"
  // layered with a soft low thump — no audio file to ship.
  function playSuccessSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;

      const duration = 0.055;
      const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * duration));
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100, now);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.22, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start(now);
      noise.stop(now + duration);

      const thump = audioCtx.createOscillator();
      thump.type = "sine";
      thump.frequency.setValueAtTime(150, now);
      const thumpGain = audioCtx.createGain();
      thumpGain.gain.setValueAtTime(0.14, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      thump.connect(thumpGain);
      thumpGain.connect(audioCtx.destination);
      thump.start(now);
      thump.stop(now + 0.08);
    } catch (e) {
      // Web Audio unavailable or blocked by the browser's autoplay policy — fail silently.
    }
  }

  global.FF = global.FF || {};
  global.FF.feedback = { flashElement, playSuccessSound };
})(typeof window !== "undefined" ? window : self);
