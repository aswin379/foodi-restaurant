"use client"

import { useEffect, useRef, useState } from "react"
import { BellRing, Volume2, VolumeX } from "lucide-react"

import { Button } from "@/components/ui/button"

const SOUND_PREFERENCE_KEY = "foodi.orders.alarmSound"
const REPEAT_MS = 4000

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === "on"
  } catch {
    return false
  }
}

function writeSoundPreference(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, on ? "on" : "off")
  } catch {
    // Storage can be unavailable (private mode); the setting then lasts for this page only.
  }
}

/** Two-note chime generated in the browser, so no audio file is needed. */
function chime(audio: AudioContext) {
  const start = audio.currentTime
  for (const [offset, frequency] of [
    [0, 880],
    [0.22, 660],
  ] as const) {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = "sine"
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + 0.55)
  }
}

/**
 * New-order alarm (PRD §4.2, §7): a flashing banner until the orders are
 * acknowledged, plus an optional repeating chime. Browsers only allow sound
 * after the user turns it on, so the chime is opt-in with a visible toggle;
 * phones also vibrate. Acknowledging is per browser tab.
 */
export function NewOrderAlarm({ pendingReferences }: { pendingReferences: { id: string; reference: string }[] }) {
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set())
  const [soundOn, setSoundOn] = useState(false)
  // Audio can only start from a click, even when sound was left on last time.
  const [audioReady, setAudioReady] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const vibratedRef = useRef<Set<string>>(new Set())

  const unacknowledged = pendingReferences.filter((order) => !acknowledged.has(order.id))
  const ringing = unacknowledged.length > 0

  // The stored preference is read after mount; audio still needs a click to start.
  useEffect(() => {
    const timer = setTimeout(() => setSoundOn(readSoundPreference()), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ringing || !soundOn) return
    const play = () => {
      const audio = audioRef.current
      if (audio && audio.state === "running") chime(audio)
    }
    play()
    const timer = setInterval(play, REPEAT_MS)
    return () => clearInterval(timer)
  }, [ringing, soundOn])

  useEffect(() => {
    const fresh = unacknowledged.filter((order) => !vibratedRef.current.has(order.id))
    if (fresh.length === 0) return
    for (const order of fresh) vibratedRef.current.add(order.id)
    // Browsers only allow vibration after the user has interacted with the page.
    if (typeof navigator !== "undefined" && "vibrate" in navigator && navigator.userActivation?.hasBeenActive) {
      navigator.vibrate([200, 100, 200])
    }
  }, [unacknowledged])

  const startAudio = () => {
    audioRef.current ??= new AudioContext()
    void audioRef.current.resume()
    setAudioReady(true)
  }

  const toggleSound = () => {
    const next = !soundOn
    if (next) startAudio()
    setSoundOn(next)
    writeSoundPreference(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={soundOn}
          onClick={toggleSound}
        >
          {soundOn ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
          Alarm sound: {soundOn ? "on" : "off"}
        </Button>
        {soundOn && !audioReady ? (
          <Button type="button" variant="ghost" size="sm" onClick={startAudio}>
            Allow sound on this page
          </Button>
        ) : null}
      </div>

      {ringing ? (
        <div
          role="alert"
          className="relative flex flex-col gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Only this ring flashes, so the text stays fully readable. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[10px] ring-4 ring-inset ring-amber-400/70 motion-safe:animate-pulse"
          />
          <p className="flex items-start gap-2 text-sm font-semibold">
            <BellRing aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              {unacknowledged.length === 1
                ? `New order ${unacknowledged[0].reference} is waiting`
                : `${unacknowledged.length} new orders are waiting: ${unacknowledged.map((order) => order.reference).join(", ")}`}
            </span>
          </p>
          <Button
            type="button"
            className="h-11 shrink-0"
            onClick={() =>
              setAcknowledged(new Set([...acknowledged, ...unacknowledged.map((order) => order.id)]))
            }
          >
            Acknowledge
          </Button>
        </div>
      ) : null}
    </div>
  )
}
