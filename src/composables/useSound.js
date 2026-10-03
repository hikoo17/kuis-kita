import { useSettings } from './useSettings'

/**
 * Lightweight sound effects built with the Web Audio API.
 * No audio files to download, nothing to bundle, works offline.
 * The AudioContext is created on the first user click (browser autoplay rules).
 */
let audioContext = null

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null

  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
  return audioContext
}

/**
 * Play a single tone with a short attack/decay envelope.
 * The envelope matters: without it every note starts with an audible click.
 */
function tone(ctx, { freq, duration = 0.18, type = 'sine', volume = 0.2, delay = 0, endFreq = null }) {
  const startAt = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, startAt)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), startAt + duration)

  const attack = Math.min(0.02, duration * 0.25)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), startAt + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.05)
}

/** Small helper for arpeggios / chord stabs. */
function sequence(ctx, notes, { step = 0.09, duration = 0.3, type = 'triangle', volume = 0.28, delay = 0 } = {}) {
  notes.forEach((freq, index) => {
    tone(ctx, { freq, duration, type, volume, delay: delay + index * step })
  })
}

const SOUND_PLAYERS = {
  // Menus & navigation
  select: (ctx, v) => tone(ctx, { freq: 880, duration: 0.09, type: 'triangle', volume: v * 0.3 }),
  click: (ctx, v) => tone(ctx, { freq: 620, duration: 0.06, type: 'triangle', volume: v * 0.16 }),
  next: (ctx, v) => tone(ctx, { freq: 340, duration: 0.18, type: 'sine', volume: v * 0.24, endFreq: 560 }),
  start: (ctx, v) => {
    tone(ctx, { freq: 300, duration: 0.22, type: 'sine', volume: v * 0.22, endFreq: 900 })
    sequence(ctx, [659.25, 880], { step: 0.1, duration: 0.22, volume: v * 0.2 })
  },
  retry: (ctx, v) => sequence(ctx, [440, 523.25], { step: 0.08, duration: 0.16, volume: v * 0.2 }),

  // Answers — kept positive, never harsh
  correct: (ctx, v) => {
    sequence(ctx, [523.25, 659.25, 783.99, 1046.5], { step: 0.085, duration: 0.36, volume: v * 0.3 })
    sequence(ctx, [261.63, 329.63, 392], { step: 0.085, duration: 0.4, type: 'sine', volume: v * 0.12 })
  },
  streak: (ctx, v) => {
    sequence(ctx, [880, 1046.5, 1244.5], { step: 0.08, duration: 0.14, volume: v * 0.24 })
  },

  // Turn countdown: 3 - 2 - 1 - go!
  countTick: (ctx, v) => tone(ctx, { freq: 660, duration: 0.12, type: 'triangle', volume: v * 0.3 }),
  countGo: (ctx, v) => {
    sequence(ctx, [880, 1174.66], { step: 0.09, duration: 0.35, volume: v * 0.3 })
  },

  // Clear fail sting for wrong answers and timeouts.
  fail: (ctx, v) => {
    sequence(ctx, [392.0, 329.63, 261.63], { step: 0.16, duration: 0.32, volume: v * 0.28 })
  },

  // Session
  finish: (ctx, v) => {
    sequence(ctx, [523.25, 659.25, 783.99, 1046.5], { step: 0.13, duration: 0.5, volume: v * 0.26 })
    sequence(ctx, [1046.5, 1318.51, 1567.98], {
      delay: 0.55,
      duration: 1.2,
      type: 'sine',
      volume: v * 0.14,
    })
  },

  // Teacher dashboard feedback
  success: (ctx, v) => sequence(ctx, [659.25, 987.77], { step: 0.09, duration: 0.24, volume: v * 0.24 }),
  error: (ctx, v) => tone(ctx, { freq: 220, duration: 0.28, type: 'sine', volume: v * 0.24 }),
}

export function useSound() {
  const { settings } = useSettings()

  function play(name, { force = false } = {}) {
    if (!force && !settings.value.soundEnabled) return

    const volume = Number(settings.value.soundVolume)
    if (Number.isFinite(volume) && volume <= 0) return

    const player = SOUND_PLAYERS[name]
    if (!player) return

    const ctx = getAudioContext()
    if (!ctx) return

    const gain = Math.max(0, Math.min(1, (Number.isFinite(volume) ? volume : 100) / 100)) * 1.15

    try {
      player(ctx, gain)
    } catch {
      // Audio problems must never break the quiz.
    }
  }

  return { play }
}
