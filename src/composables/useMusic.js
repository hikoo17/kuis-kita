import { ref } from 'vue'
import { getAudioContext } from './useSound'
import { useSettings } from './useSettings'

/**
 * Gentle looping background music, synthesized with the Web Audio API.
 * No audio files: the loop is built from a chord progression plus a sparse
 * melody, so it stays small and can be turned on/off instantly.
 *
 * Design notes:
 * - The whole music runs through one "bus" gain node, so muting is a smooth
 *   fade instead of a hard cut (already scheduled notes fade with it).
 * - A low-pass filter keeps it warm and non-fatiguing on cheap classroom speakers.
 * - A lookahead scheduler queues bars slightly ahead of time for a steady tempo.
 */

const BEAT = 60 / 128 // 128 BPM: upbeat, game-show energy
const BAR = BEAT * 4

// I – V – vi – IV in C major: pleasant, neutral, loops well.
const PROGRESSION = [
  { bass: 130.81, chord: [261.63, 329.63, 392.0], sparkle: [523.25, 659.25] }, // C
  { bass: 196.0, chord: [293.66, 392.0, 493.88], sparkle: [587.33, 783.99] }, // G
  { bass: 220.0, chord: [261.63, 329.63, 440.0], sparkle: [523.25, 659.25] }, // Am
  { bass: 174.61, chord: [261.63, 349.23, 440.0], sparkle: [523.25, 698.46] }, // F
]

const MAX_LEVEL = 0.55

let bus = null
let timer = null
let nextBarTime = 0
let barIndex = 0
let playing = false

const isPlaying = ref(false)

function levelFor(volume) {
  const value = Number(volume)
  const safe = Number.isFinite(value) ? value : 45
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

function scheduleBar(ctx, at, index) {
  const { bass, chord, sparkle } = PROGRESSION[index]
  const eighth = BEAT / 2

  // Four-on-the-floor kick.
  for (let beat = 0; beat < 4; beat += 1) {
    kick(ctx, { at: at + beat * BEAT })
  }

  // Hats on every offbeat.
  for (let beat = 0; beat < 4; beat += 1) {
    hat(ctx, { at: at + beat * BEAT + eighth })
  }

  // Driving eighth-note bass: root with octave and fifth jumps.
  const steps = [1, 1, 2, 1, 1, 1, 1.5, 2]
  steps.forEach((mult, i) => {
    pluckNote(ctx, {
      freq: bass * mult,
      at: at + i * eighth,
      duration: 0.2,
      volume: 0.05,
      type: 'sine',
    })
  })

  // Chord stabs on beats 2 and 4.
  ;[1, 3].forEach((beat) => {
    chord.forEach((freq) => {
      pluckNote(ctx, { freq, at: at + beat * BEAT, duration: 0.22, volume: 0.035 })
    })
  })

  // Lead motif: opening note on beat 1, answer on beat 3.
  pluckNote(ctx, { freq: sparkle[0], at, duration: 0.4, volume: 0.05 })
  pluckNote(ctx, { freq: sparkle[1], at: at + BEAT * 2, duration: 0.4, volume: 0.045 })
}

export function useMusic() {
  const { settings } = useSettings()

  function queueBars(ctx) {
    // Queue anything that starts within the next second.
    const horizon = ctx.currentTime + 1
    while (nextBarTime < horizon) {
      scheduleBar(ctx, nextBarTime, barIndex)
      nextBarTime += BAR
      barIndex = (barIndex + 1) % PROGRESSION.length
    }
  }

  function start() {
    const ctx = getAudioContext()
    if (!ctx) return

    const gainNode = getBus(ctx)
    const now = ctx.currentTime

    // Fade in (or just re-target the volume if it is already running).
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(Math.max(gainNode.gain.value, 0.0001), now)
    gainNode.gain.linearRampToValueAtTime(levelFor(settings.value.musicVolume), now + 1.4)

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
    else start()
    return playing
  }

  return { isPlaying, start, stop, toggle }
}
