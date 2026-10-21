export type Earcon = 'listen' | 'heard' | 'done' | 'error'

// Short tones in place of spoken prompts, like the chime a smart speaker plays when it starts listening.
const TONES: Record<Earcon, Array<{ hz: number; ms: number }>> = {
  listen: [{ hz: 660, ms: 80 }, { hz: 880, ms: 110 }],
  heard: [{ hz: 520, ms: 70 }],
  done: [{ hz: 880, ms: 80 }, { hz: 600, ms: 120 }],
  error: [{ hz: 300, ms: 120 }, { hz: 240, ms: 160 }],
}

const GAP_MS = 20

export const earconDurationMs = (kind: Earcon): number => TONES[kind].reduce((total, tone) => total + tone.ms + GAP_MS, 0)

export function createEarcons(getVolume: () => number) {
  let context: AudioContext | null = null

  const ensure = (): AudioContext => {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    context ??= new Context!()
    if (context.state === 'suspended') void context.resume()
    return context
  }

  return {
    // Runs inside a tap so the phone lets the tones play later.
    unlock() {
      try { ensure() } catch { /* no audio available */ }
    },
    play(kind: Earcon) {
      try {
        const audio = ensure()
        let start = audio.currentTime + 0.01
        for (const tone of TONES[kind]) {
          const seconds = tone.ms / 1000
          const oscillator = audio.createOscillator()
          const gain = audio.createGain()
          oscillator.type = 'sine'
          oscillator.frequency.value = tone.hz
          gain.gain.setValueAtTime(0, start)
          gain.gain.linearRampToValueAtTime(0.2 * Math.min(1, Math.max(0.2, getVolume())), start + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds)
          oscillator.connect(gain).connect(audio.destination)
          oscillator.start(start)
          oscillator.stop(start + seconds + 0.02)
          start += seconds + GAP_MS / 1000
        }
      } catch {
        // A missing chime never matters more than the conversation.
      }
    },
  }
}
