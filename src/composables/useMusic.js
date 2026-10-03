import { ref } from 'vue'
import { getAudioContext } from './useSound'
import { useSettings } from './useSettings'

/**
 * Gentle looping background music, synthesized with the Web Audio API.
 * No audio files: each loop is built from a chord progression plus a sparse
 * melody, so it stays small and can be turned on/off instantly.
 *
 * Two tracks are available:
 * - "menu": calm 112 BPM C–G–Am–F, played while the class is thinking
 *   (after the material is picked, before a student answers).
 * - "game": driving 140 BPM Em–C–G–D with a backbeat snare, played during
 *   the actual answering session.
 *
 * Design notes:
 * - The whole music runs through one "bus" gain node, so muting is a smooth
 *   fade instead of a hard cut (already scheduled notes fade with it).
 * - A low-pass filter keeps it warm and non-fatiguing on cheap classroom speakers.
 * - A lookahead scheduler queues bars slightly ahead of time for a steady tempo.
 * - Switching tracks keeps the same bus, so the change happens at the next bar.
 */

const TRACKS = {
  menu: {
    beat: 60 / 112, // relaxed: thinking music
    snare: false,
    // I – V – vi – IV in C major: pleasant, neutral, loops well.
    progression: [
      { bass: 130.81, chord: [261.63, 329.63, 392.0], sparkle: [523.25, 659.25] }, // C
      { bass: 196.0, chord: [293.66, 392.0, 493.88], sparkle: [587.33, 783.99] }, // G
      { bass: 220.0, chord: [261.63, 329.63, 440.0], sparkle: [523.25, 659.25] }, // Am
      { bass: 174.61, chord: [261.63, 349.23, 440.0], sparkle: [523.25, 698.46] }, // F
    ],
  },
  game: {
    beat: 60 / 140, // upbeat: answering music
    snare: true,
    // vi – I – V – II (Em–C–G–D): more forward-leaning, game-show energy.
    progression: [
      { bass: 164.81, chord: [329.63, 392.0, 493.88], sparkle: [659.25, 987.77] }, // Em
      { bass: 130.81, chord: [261.63, 329.63, 392.0], sparkle: [523.25, 783.99] }, // C
      { bass: 196.0, chord: [293.66, 392.0, 493.88], sparkle: [587.33, 783.99] }, // G
      { bass: 146.83, chord: [293.66, 369.99, 440.0], sparkle: [587.33, 739.99] }, // D
    ],
  },
}

const MAX_LEVEL = 0.8

let bus = null
let timer = null
let nextBarTime = 0
let barIndex = 0
let playing = false
let active = TRACKS.menu

const isPlaying = ref(false)
const currentTrack = ref('menu')

function trackConfig(name) {
  return TRACKS[name] ?? TRACKS.menu
}

function levelFor(volume) {
  const value = Number(volume)
  const safe = Number.isFinite(value) ? value : 80
  return Math.max(0, Math.min(1, safe / 100)) * MAX_LEVEL
}

function getBus(ctx) {
  if (bus) return bus

  const gain = ctx.createGain()
  gain.gain.value = 0

  // Warm, low-passed tone: soft on laptop/projector speakers.
  // (Kept high enough that the hi-hats still shimmer through.)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 8500
  filter.Q.value = 0.6

  gain.connect(filter).connect(ctx.destination)
  bus = gain
  return bus
}

/** Short bell-like note for bass lines, stabs and melody. */
function pluckNote(ctx, { freq, at, duration = 0.9, volume = 0.06, type = 'triangle' }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = freq

  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)

  osc.connect(gain).connect(bus)
  osc.start(at)
  osc.stop(at + duration + 0.05)
}

/** Soft four-on-the-floor kick: sine drop, no click. */
function kick(ctx, { at, volume = 0.11 }) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, at)
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.1)

  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)

  osc.connect(gain).connect(bus)
  osc.start(at)
  osc.stop(at + 0.16)
}

let noiseBuffer = null

function getNoiseBuffer(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer
  const length = Math.floor(ctx.sampleRate * 0.1)
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

/** Very quiet offbeat hi-hat. */
function hat(ctx, { at, volume = 0.016 }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)

  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = 7000

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)

  src.connect(filter).connect(gain).connect(bus)
  src.start(at)
  src.stop(at + 0.06)
}

/** Soft backbeat snare (band-passed noise) — used by the "game" track. */
function snare(ctx, { at, volume = 0.05 }) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1800
  filter.Q.value = 0.9

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, at)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)

  src.connect(filter).connect(gain).connect(bus)
  src.start(at)
  src.stop(at + 0.2)
}

function scheduleBar(ctx, at, index, cfg) {
  const beat = cfg.beat
  const eighth = beat / 2
  const bar = cfg.progression[index % cfg.progression.length]

  // Four-on-the-floor kick.
  for (let b = 0; b < 4; b += 1) {
    kick(ctx, { at: at + b * beat })
  }

  // Hats on every offbeat.
  for (let b = 0; b < 4; b += 1) {
    hat(ctx, { at: at + b * beat + eighth })
  }

  // Backbeat snare on 2 and 4 (game track only).
  if (cfg.snare) {
    snare(ctx, { at: at + beat })
    snare(ctx, { at: at + 3 * beat })
  }

  // Driving eighth-note bass: root with octave and fifth jumps.
  const steps = [1, 1, 2, 1, 1, 1, 1.5, 2]
  steps.forEach((mult, i) => {
    pluckNote(ctx, {
      freq: bar.bass * mult,
      at: at + i * eighth,
      duration: 0.2,
      volume: 0.05,
      type: 'sine',
    })
  })

  // Chord stabs on beats 2 and 4.
  ;[1, 3].forEach((b) => {
    bar.chord.forEach((freq) => {
      pluckNote(ctx, { freq, at: at + b * beat, duration: 0.22, volume: 0.035 })
    })
  })

  // Lead motif: opening note on beat 1, answer on beat 3.
  pluckNote(ctx, { freq: bar.sparkle[0], at, duration: 0.4, volume: 0.05 })
  pluckNote(ctx, { freq: bar.sparkle[1], at: at + beat * 2, duration: 0.4, volume: 0.045 })
}

export function useMusic() {
  const { settings } = useSettings()

  function queueBars(ctx) {
    // Queue anything that starts within the next second.
    const horizon = ctx.currentTime + 1
    while (nextBarTime < horizon) {
      scheduleBar(ctx, nextBarTime, barIndex, active)
      nextBarTime += active.beat * 4
      barIndex += 1
    }
  }

  /**
   * Play a track ("menu" or "game"). Calling it again with the same track is a
   * no-op; calling it with a different track switches at the next bar.
   */
  function start(name = 'menu') {
    const ctx = getAudioContext()
    if (!ctx) return

    if (playing && currentTrack.value === name) return

    const cfg = trackConfig(name)
    const gainNode = getBus(ctx)
    const now = ctx.currentTime

    // Fade in (or just re-target the volume if it is already running).
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now)
    gainNode.gain.linearRampToValueAtTime(levelFor(settings.value.musicVolume), now + 1.4)

    active = cfg
    currentTrack.value = name

    // Already running: the new progression takes over at the next queued bar.
    if (playing) return

    playing = true
    isPlaying.value = true
    barIndex = 0
    nextBarTime = now + 0.2

    queueBars(ctx)
    timer = window.setInterval(() => {
      // Keep the volume in sync with the slider, smoothly.
      gainNode.gain.setTargetAtTime(levelFor(settings.value.musicVolume), ctx.currentTime, 0.3)
      queueBars(ctx)
    }, 250)
  }

  function stop() {
    const ctx = getAudioContext()
    if (timer) {
      window.clearInterval(timer)
      timer = null
    }
    playing = false
    isPlaying.value = false

    if (bus && ctx) {
      const now = ctx.currentTime
      bus.gain.cancelScheduledValues(now)
      bus.gain.setValueAtTime(Math.max(bus.gain.value, 0.0001), now)
      // Fade out; notes already queued fade together with the bus.
      bus.gain.linearRampToValueAtTime(0.0001, now + 0.9)
    }
  }

  function toggle() {
    if (playing) stop()
    else start('menu')
    return playing
  }

  return { isPlaying, currentTrack, start, stop, toggle }
}
