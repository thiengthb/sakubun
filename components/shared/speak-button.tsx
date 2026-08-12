'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Google-Translate-style "slow on repeat": the first press plays at the user's default speed; pressing
// the SAME button again (within the idle window) plays slower, then alternates back to normal, etc.
const SLOW_FACTOR = 0.6; // slow = default × this (clamped to VOICEVOX's 0.5 floor)
const IDLE_RESET_MS = 6000; // after this long idle, the next press starts at normal again
// How long to wait for Web Speech to actually START before giving the button back (see the watchdog in
// `speakWebSpeech`). Generous: a slow device can take a moment to warm an OS voice, and cutting a real
// utterance short would be worse than the state this guards against.
const SPEECH_START_TIMEOUT_MS = 2500;

// Detect Web Speech support without a setState-in-effect (SSR snapshot = false, client = real check) —
// useSyncExternalStore reconciles the two without a hydration mismatch.
const noopSubscribe = () => () => {};
function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  );
}

/** Normalize a BCP-47-ish tag ("ja_JP", "ja-jp") to a lowercase "ja-..." prefix check. */
function matchesLang(voiceLang: string, target: string): boolean {
  const base = target.toLowerCase().split('-')[0];
  return voiceLang.toLowerCase().replace('_', '-').startsWith(base);
}

// Web Speech quality is entirely down to WHICH OS voice we pick — the default is often the worst
// (robotic eSpeak on Linux, legacy SAPI on Windows). Score the matching-language voices and pick the
// most natural one available: online/neural voices (Edge "… Online (Natural)", Google) beat offline
// ones, and named human voices beat generic/eSpeak engines. Higher score = better.
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (!v.localService) score += 6; // remote = the neural "Natural"/Google voices in Edge/Chrome
  if (/natural|neural/.test(name)) score += 5;
  if (/google/.test(name)) score += 4;
  // Known good named JA voices across Windows / macOS / iOS.
  if (/nanami|keita|haruka|ayumi|ichiro|kyoko|o-?ren|otoya|hattori|sayaka|mizuki/.test(name))
    score += 3;
  if (/espeak|festival|pico/.test(name)) score -= 6; // the tinny/robotic offline engines
  return score;
}

/** Best matching-language voice by quality score (null if none match). */
function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const matches = voices.filter((v) => matchesLang(v.lang, lang));
  if (matches.length === 0) return null;
  return matches.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best), matches[0]);
}

/**
 * Plays reference audio for a snippet of text. Defaults to Japanese. Two-tier by design:
 *   1. PRIMARY — the local VOICEVOX engine via `/api/tts`, played as a WAV in an <audio> element.
 *      Natural neural voice, identical on EVERY browser (no OS-voice dependency), fully local.
 *   2. FALLBACK — the browser's Web Speech API (borrowing an OS voice) when the engine is unreachable.
 *      Web Speech quality varies wildly by OS/browser (robotic eSpeak on Linux), so it's the backup,
 *      not the default; we still pick the most natural available voice for it.
 * A single button — no inline speed control (the default speed lives in Settings). Repeat-press slows
 * the playback Google-Translate-style. Renders nothing when the browser has no speechSynthesis (so a
 * fallback always exists). The app only SPEAKS reference audio; it never records the user.
 */
export function SpeakButton({
  text,
  lang = 'ja-JP',
  label = 'Nghe',
  speaker,
  onProgress,
  rate = 1,
  playToken = null,
  className,
}: {
  text: string;
  lang?: string;
  label?: string;
  /** VOICEVOX speaker id (from the user's voice setting). Forwarded to `/api/tts` as `?speaker=`;
   * omitted → the route's default voice. Only affects the primary (VOICEVOX) path, not Web Speech. */
  speaker?: number;
  /** Playback progress 0→1 for a karaoke-style highlight: VOICEVOX reports currentTime/duration,
   * Web Speech reports word boundaries (charIndex/len). Fires 0 on start/stop/end. */
  onProgress?: (ratio: number) => void;
  /** Default playback speed (from the user's setting). 1 = natural. Sent to `/api/tts` as `?rate=`
   * (VOICEVOX speedScale — keeps pitch) and used as Web Speech `utterance.rate`. A repeat-press slows
   * it to `rate × SLOW_FACTOR`. */
  rate?: number;
  /**
   * AUTO-PLAY LATCH. `null` (default) = manual only, the historic behaviour. Any other value plays once,
   * as soon as that value CHANGES — so the caller expresses "read this now" by handing over a new token
   * (e.g. `${itemId}:answer`) and "don't" by handing over `null`.
   *
   * A token rather than a boolean because the interesting event is a TRANSITION, not a state: the group
   * flashcards read the term when a new card appears, and re-handing the same token (flipping back and
   * forth on one card) must NOT replay the audio. A boolean cannot tell those apart.
   *
   * Auto-play lives HERE rather than in a helper the caller could call, so the whole TTS path — VOICEVOX
   * first, Web Speech fallback, repeat-press slow-down, karaoke progress — has exactly one
   * implementation. A second one would drift, and it is the fallback that would rot unnoticed.
   */
  playToken?: string | number | null;
  className?: string;
}) {
  const supported = useSpeechSupported();
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // The <audio> element playing VOICEVOX output (the primary path). Held in a ref so a second click,
  // or unmount, can stop it. Web Speech has no element — it's cancelled via speechSynthesis.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Repeat-press slow-down bookkeeping (mutated only in the click handler, never during render).
  const lastPlayRef = useRef(0); // timestamp of the last play start
  const slowNextRef = useRef(false); // whether the NEXT (soon) press should play slow
  const playRateRef = useRef(rate); // the speed chosen for the in-flight play (read by the Web Speech path)

  // Voices load asynchronously (and change) — subscribe to `voiceschanged` and snapshot on mount.
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel(); // stop any in-flight utterance on unmount
      audioRef.current?.pause();
    };
  }, []);

  // Render whenever EITHER path can work. It used to be `if (!supported) return null` — which hid the
  // button on any browser without `speechSynthesis`, even though the PRIMARY path (VOICEVOX over
  // /api/tts) is a plain <audio> element that needs no speech API at all. Several mobile browsers and
  // most in-app webviews (Facebook, Zalo, …) have no speechSynthesis, so the button simply was not there
  // on the phone. Japanese always has the server path; other languages still depend on Web Speech.
  const canPlay = supported || lang.toLowerCase().startsWith('ja');

  const stopAll = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
    onProgress?.(0);
  };

  // Fallback path: the browser's Web Speech API, borrowing an OS voice (used when the VOICEVOX engine
  // is unreachable). Picks the most natural matching voice; warns only when the voice list is loaded
  // yet has no Japanese voice at all (the Ubuntu case) rather than playing a wrong-language voice.
  const speakWebSpeech = () => {
    // No speech API at all (mobile webviews): the VOICEVOX path already failed if we got here, so say so
    // instead of throwing on `window.speechSynthesis`.
    if (!supported) {
      toast.error('Không phát được âm thanh', {
        description: 'Trình duyệt này không hỗ trợ đọc, và giọng máy chủ đang không truy cập được.',
      });
      setSpeaking(false);
      onProgress?.(0);
      return;
    }
    const synth = window.speechSynthesis;
    // Firefox loads voices lazily and often DOESN'T fire `voiceschanged` before the first click, so
    // the mounted snapshot can still be empty here — re-query at click time and cache the result.
    const available = voices.length ? voices : synth.getVoices();
    if (available.length && available.length !== voices.length) setVoices(available);

    const voice = pickBestVoice(available, lang);
    if (!voice && available.length > 0 && lang.toLowerCase().startsWith('ja')) {
      toast.warning('Máy này chưa có giọng đọc tiếng Nhật', {
        description:
          'Chưa bật được giọng chất lượng cao (VOICEVOX) và trình duyệt cũng không có giọng tiếng Nhật. ' +
          'Trên Ubuntu/Linux: `sudo apt install speech-dispatcher espeak-ng` rồi mở lại trình duyệt. ' +
          'Máy có sẵn giọng (vd Windows/macOS) thì nút này vẫn chạy.',
        duration: 8000,
      });
      setSpeaking(false);
      return;
    }

    synth.cancel(); // stop any other utterance first (one voice at a time)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    // Neutral pitch; speed follows the play's chosen rate (Web Speech has no pitch-preserving stretch,
    // so a slower rate here does shift pitch slightly — VOICEVOX is the pitch-clean primary path).
    utterance.rate = playRateRef.current;
    utterance.pitch = 1;
    // Word-boundary events drive the karaoke highlight (charIndex → ratio). Not every engine fires them.
    utterance.onboundary = (e) =>
      onProgress?.(Math.min(1, text.length ? e.charIndex / text.length : 0));
    utterance.onend = () => {
      setSpeaking(false);
      onProgress?.(0);
    };
    utterance.onerror = () => {
      setSpeaking(false);
      onProgress?.(0);
    };
    // WATCHDOG on the fallback path. Web Speech may ACCEPT an utterance and then do nothing at all,
    // silently: iOS Safari discards the first utterance on a page that has had no user activation, and
    // several in-app webviews accept-and-drop when no voice matches the language. Neither case fires
    // `onstart`, `onend` OR `onerror` — so `speaking` stayed true with no event able to clear it, and
    // the button sat on its spinner until the user thought to press it a second time. That second press
    // was the ONLY exit from this state, which makes it a dead end for anyone who reads the spinner as
    // "it is working" and waits. NOT a reproduction of a reported bug: measured 2026-08-12, this
    // component plays correctly on Chromium-mobile at 390px even with ZERO Japanese voices installed
    // (the server path carries it). This closes the hole by inspection, not by symptom.
    const started = { current: false };
    utterance.onstart = () => {
      started.current = true;
    };
    setSpeaking(true);
    synth.speak(utterance);
    window.setTimeout(() => {
      if (started.current) return; // a real utterance is running — its own events own the state now
      setSpeaking(false);
      onProgress?.(0);
    }, SPEECH_START_TIMEOUT_MS);
  };

  /**
   * Start playback. `auto` marks a play the USER did not ask for right now (the auto-read latch below).
   *
   * An auto-play NEVER plays slow. "Slow on repeat" means *you asked to hear this again*, and the
   * bookkeeping behind it (`slowNextRef`) was global to the button, so auto-reads walked the alternation
   * by themselves: on the group flashcards, card 1 auto-read normal → armed slow → card 2 auto-read
   * SLOW, card 3 normal, card 4 slow (reported 2026-08-05 as "cứ cách một thẻ lại đọc chậm"). Two cards
   * are not a repeat of one another — they are different text, each heard for the first time.
   *
   * It still ARMS the alternation (`slowNextRef = true`), which is the useful half: the first thing you
   * do after an auto-read is press the button to hear the same term again, and that press SHOULD be slow.
   */
  const startPlay = (auto: boolean) => {
    // Pick the speed for THIS play: normal first, slow on an immediate repeat, alternating; a long idle
    // resets to normal. (Date.now / ref writes here are in an event handler, not render — allowed.)
    const now = Date.now();
    const fresh = now - lastPlayRef.current >= IDLE_RESET_MS;
    const playSlow = !auto && !fresh && slowNextRef.current;
    const thisRate = playSlow ? Math.max(0.5, Math.min(2, rate * SLOW_FACTOR)) : rate;
    slowNextRef.current = !playSlow; // normal → next slow; slow → next normal
    lastPlayRef.current = now;
    playRateRef.current = thisRate;

    // Japanese → prefer the local VOICEVOX engine (natural + identical on every browser). The spinner
    // shows while it synthesizes; on any failure (engine down / 503 / can't play) fall back to Web
    // Speech exactly once. Non-Japanese text goes straight to Web Speech (VOICEVOX is JA-only).
    onProgress?.(0); // reset the highlight at the start of playback
    if (lang.toLowerCase().startsWith('ja')) {
      setSpeaking(true);
      const speakerParam = speaker != null ? `&speaker=${speaker}` : '';
      const rateParam = thisRate !== 1 ? `&rate=${thisRate}` : '';
      const audio = new Audio(
        `/api/tts?text=${encodeURIComponent(text)}${speakerParam}${rateParam}`,
      );
      audioRef.current = audio;
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        audioRef.current = null;
        speakWebSpeech();
      };
      // Smooth karaoke sweep: highlight fraction = how far through the audio we are.
      audio.ontimeupdate = () => {
        if (audio.duration) onProgress?.(Math.min(1, audio.currentTime / audio.duration));
      };
      audio.onended = () => {
        audioRef.current = null;
        setSpeaking(false);
        onProgress?.(0);
      };
      audio.onerror = fallback;
      audio.play().catch(fallback);
      return;
    }
    speakWebSpeech();
  };

  /** The BUTTON's handler: press while playing = stop, otherwise play (slow if this is a repeat). */
  const toggle = () => {
    if (speaking) {
      stopAll();
      return;
    }
    startPlay(false);
  };

  /**
   * The AUTO-PLAY entry point (see `playToken`). A token change means "read THIS", so anything still
   * playing belongs to the text we just moved away from (the previous flashcard) — stop it and read the
   * new one, rather than skipping the new read or talking over it. `stopAll()` + `startPlay()` batch
   * into one render, so `speaking` ends up true either way.
   */
  const playFn = () => {
    if (speaking) stopAll();
    startPlay(true);
  };
  // AUTO-PLAY (see `playToken`). Two effects, and the order matters:
  //   1. keep a "latest" ref pointing at THIS render's `playFn` — assigning a ref during render is what
  //      the React Compiler forbids, so it happens in an effect that runs every render;
  //   2. when the token changes to something non-null, fire that ref.
  // Effects run in declaration order after the same render, so (1) is always current when (2) reads it.
  // `firedRef` starts as a sentinel, not the first token: a card that mounts WITH a token must read.
  const playRef = useRef<() => void>(() => {});
  const firedRef = useRef<string | number | null | undefined>(undefined);
  useEffect(() => {
    playRef.current = playFn;
  });
  useEffect(() => {
    if (playToken == null || playToken === firedRef.current) return;
    firedRef.current = playToken;
    playRef.current();
  }, [playToken]);

  // Moved BELOW the handlers (2026-08-05): the auto-play effects above close over `playFn`, and a `const`
  // that never got initialised because the component returned early is a TDZ ReferenceError inside the
  // effect. Returning here instead keeps every definition initialised on every render path.
  if (!canPlay || !text.trim()) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // cards toggle on click — don't collapse/expand when playing audio
        toggle();
      }}
      aria-label={speaking ? 'Dừng phát' : `${label} (phát âm)`}
      title={speaking ? 'Dừng' : `${label} · bấm lại để nghe chậm`}
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {speaking ? (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Volume2 className="size-3.5" aria-hidden />
      )}
    </button>
  );
}
