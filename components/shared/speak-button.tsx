'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  className,
}: {
  text: string;
  lang?: string;
  label?: string;
  speaker?: number;
  onProgress?: (ratio: number) => void;
  rate?: number;
  playToken?: string | number | null;
  className?: string;
}) {
  const supported = useSpeechSupported();
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayRef = useRef(0); // timestamp of the last play start
  const slowNextRef = useRef(false); // whether the NEXT (soon) press should play slow
  const playRateRef = useRef(rate); // the speed chosen for the in-flight play (read by the Web Speech path)

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
    utterance.onend = () => {
      setSpeaking(false);
      onProgress?.(0);
    };
    utterance.onerror = () => {
      setSpeaking(false);
      onProgress?.(0);
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
    startPlay(false);
  };

  const playFn = () => {
    if (speaking) stopAll();
    startPlay(true);
  };
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
