'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/core/utils';
import { ttsUrl } from '@/lib/japanese/tts-url';

const SLOW_FACTOR = 0.6; // slow = default × this (clamped to VOICEVOX's 0.5 floor)
const IDLE_RESET_MS = 6000; // after this long idle, the next press starts at normal again
const SPEECH_START_TIMEOUT_MS = 2500;
const AUDIO_START_TIMEOUT_MS = 9000;

const noopSubscribe = () => () => {};
function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
    () => false,
  );
}

function matchesLang(voiceLang: string, target: string): boolean {
  const base = target.toLowerCase().split('-')[0];
  return voiceLang.toLowerCase().replace('_', '-').startsWith(base);
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (!v.localService) score += 6; // remote = the neural "Natural"/Google voices in Edge/Chrome
  if (/natural|neural/.test(name)) score += 5;
  if (/google/.test(name)) score += 4;
  if (/nanami|keita|haruka|ayumi|ichiro|kyoko|o-?ren|otoya|hattori|sayaka|mizuki/.test(name))
    score += 3;
  if (/espeak|festival|pico/.test(name)) score -= 6; // the tinny/robotic offline engines
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const matches = voices.filter((v) => matchesLang(v.lang, lang));
  if (matches.length === 0) return null;
  return matches.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best), matches[0]);
}

export function SpeakButton({
  text,
  lang = 'ja-JP',
  label = 'Nghe',
  speaker,
  onProgress,
  rate = 1,
  playToken = null,
  stopToken = null,
  onDone,
  onManualPlay,
  className,
}: {
  text: string;
  lang?: string;
  label?: string;
  speaker?: number;
  onProgress?: (ratio: number) => void;
  rate?: number;
  playToken?: string | number | null;
  /** A new value stops this button's playback, as a press on it would. */
  stopToken?: string | number | null;
  /** A play ended by itself: true when it was heard to the end, false when nothing could play. A
   * stop (a press, stopToken) calls nothing. Hội thoại's whole-script listening (K6c) moves on. */
  onDone?: (heard: boolean) => void;
  /** The learner pressed this button to play (not playToken). */
  onManualPlay?: () => void;
  className?: string;
}) {
  const supported = useSpeechSupported();
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firedRef = useRef<string | number | null | undefined>(undefined); // the playToken played last
  const lastPlayRef = useRef(0); // timestamp of the last play start
  const slowNextRef = useRef(false); // whether the NEXT (soon) press should play slow
  const playRateRef = useRef(rate); // the speed chosen for the in-flight play (read by the Web Speech path)
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  const done = (heard: boolean) => onDoneRef.current?.(heard);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel(); // stop any in-flight utterance on unmount
      audioRef.current?.pause();
      audioRef.current = null;
      // A remount (React's dev double mount, or a line that just opened) plays its token again.
      firedRef.current = undefined;
    };
  }, []);

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

  const speakWebSpeech = () => {
    if (!supported) {
      toast.error('Không phát được âm thanh', {
        description: 'Trình duyệt này không hỗ trợ đọc, và giọng máy chủ đang không truy cập được.',
      });
      setSpeaking(false);
      onProgress?.(0);
      done(false);
      return;
    }
    const synth = window.speechSynthesis;
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
      done(false);
      return;
    }

    synth.cancel(); // stop any other utterance first (one voice at a time)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    if (voice) utterance.voice = voice;
    utterance.rate = playRateRef.current;
    utterance.pitch = 1;
    utterance.onboundary = (e) =>
      onProgress?.(Math.min(1, text.length ? e.charIndex / text.length : 0));
    let ended = false;
    utterance.onend = () => {
      ended = true;
      setSpeaking(false);
      onProgress?.(0);
      done(true);
    };
    utterance.onerror = (e) => {
      setSpeaking(false);
      onProgress?.(0);
      // cancel() (a stop, or the next line taking over) is not a failure.
      if (!ended && e.error !== 'canceled' && e.error !== 'interrupted') done(false);
    };
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
      done(false);
    }, SPEECH_START_TIMEOUT_MS);
  };

  const startPlay = (auto: boolean) => {
    const now = Date.now();
    const fresh = now - lastPlayRef.current >= IDLE_RESET_MS;
    const playSlow = !auto && !fresh && slowNextRef.current;
    const thisRate = playSlow ? Math.max(0.5, Math.min(2, rate * SLOW_FACTOR)) : rate;
    slowNextRef.current = !playSlow; // normal → next slow; slow → next normal
    lastPlayRef.current = now;
    playRateRef.current = thisRate;

    onProgress?.(0); // reset the highlight at the start of playback
    if (lang.toLowerCase().startsWith('ja')) {
      setSpeaking(true);
      const audio = new Audio(ttsUrl(text, speaker, thisRate));
      audioRef.current = audio;
      let fellBack = false;
      const fallback = () => {
        // Stopped on purpose (a press, the next line, an unmount): play() rejects, but that is no
        // reason to read the line aloud another way.
        if (fellBack || audioRef.current !== audio) return;
        fellBack = true;
        window.clearTimeout(stallTimer);
        audio.pause();
        audioRef.current = null;
        speakWebSpeech();
      };
      const stallTimer = window.setTimeout(() => {
        if (audioRef.current !== audio) return;
        if (audio.currentTime > 0 && !audio.paused) return; // really playing — its events own the state
        fallback();
      }, AUDIO_START_TIMEOUT_MS);
      audio.ontimeupdate = () => {
        if (audio.duration) onProgress?.(Math.min(1, audio.currentTime / audio.duration));
      };
      audio.onended = () => {
        window.clearTimeout(stallTimer);
        audioRef.current = null;
        setSpeaking(false);
        onProgress?.(0);
        done(true);
      };
      audio.onerror = fallback;
      audio.play().catch(fallback);
      return;
    }
    speakWebSpeech();
  };

  const toggle = () => {
    if (speaking) {
      stopAll();
      return;
    }
    onManualPlay?.();
    startPlay(false);
  };

  const playFn = () => {
    if (speaking) stopAll();
    startPlay(true);
  };
  const playRef = useRef<() => void>(() => {});
  useEffect(() => {
    playRef.current = playFn;
  });
  useEffect(() => {
    if (playToken == null || playToken === firedRef.current) return;
    firedRef.current = playToken;
    playRef.current();
  }, [playToken]);
  const stopRef = useRef<() => void>(() => {});
  const stoppedRef = useRef<string | number | null | undefined>(undefined);
  useEffect(() => {
    stopRef.current = stopAll;
  });
  useEffect(() => {
    if (stopToken == null || stopToken === stoppedRef.current) return;
    stoppedRef.current = stopToken;
    stopRef.current();
  }, [stopToken]);

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
