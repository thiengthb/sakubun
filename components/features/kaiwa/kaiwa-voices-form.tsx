'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Field, FormActions, SubmitButton } from '@/components/common/field';
import { SpokenLine } from '@/components/common/spoken-line';
import { useServerAction } from '@/components/common/use-server-action';
import { useKaiwaMe } from '@/components/features/kaiwa/use-kaiwa-me';
import { ButtonLink } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { setVoicesAction } from '@/app/kaiwa/actions';
import { speakerVoices, type ChosenVoices } from '@/lib/kaiwa/voices';
import { VOICE_SPEAKERS } from '@/lib/settings/schema';

const AUTO = 'auto';

/** The line under the page's title, on the page and its loading screen. */
export const VOICES_NOTE =
  'Chỉ cho kịch bản này. Vai để Tự động thì app tự chọn giọng, nam nữ xen kẽ.';

function voiceLabel(id: number): string {
  return VOICE_SPEAKERS.find((v) => v.id === id)?.label ?? `Giọng #${id}`;
}

export interface VoicePart {
  speaker: string;
  /** The part's first line, to hear the voice on. */
  text: string;
  ruby: string;
}

// "Giọng từng vai" (Kaiwa c, docs/plans/2026-11-07-kaiwa-voices-roleplay.md): a voice per part on
// one script, the learner's own part included. Tự động keeps the voice worked out as before and
// names it; the part's first line plays in the voice on its row. Lưu stays off until a change.
export function KaiwaVoicesForm({
  scriptId,
  parts,
  settingsVoice,
  speechRate,
  showFurigana,
  chosen,
}: {
  scriptId: string;
  parts: readonly VoicePart[];
  settingsVoice: number;
  speechRate: number;
  showFurigana: boolean;
  chosen: ChosenVoices;
}) {
  const router = useRouter();
  const backHref = `/kaiwa/${scriptId}`;
  const speakers = parts.map((p) => p.speaker);
  const [me] = useKaiwaMe(scriptId, speakers);
  const [draft, setDraft] = useState<Record<string, number>>({ ...chosen });
  const voices = speakerVoices(speakers, me, settingsVoice, draft);
  // The voice a part gets on Tự động, the other parts' choices kept.
  const autoVoice = (part: string) => {
    if (part === me) return settingsVoice;
    const others = Object.fromEntries(Object.entries(draft).filter(([p]) => p !== part));
    return speakerVoices(speakers, me, settingsVoice, others).get(part)!;
  };
  const dirty =
    Object.keys(draft).length !== Object.keys(chosen).length ||
    Object.entries(draft).some(([part, id]) => chosen[part] !== id);
  const { run, isPending } = useServerAction(setVoicesAction, {
    success: 'Đã lưu giọng từng vai',
    onSuccess: () => {
      router.push(backHref);
      router.refresh();
    },
  });

  const choose = (part: string, value: string) => {
    setDraft((current) => {
      const next = { ...current };
      if (value === AUTO) delete next[part];
      else next[part] = Number(value);
      return next;
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) run(scriptId, draft);
      }}
      noValidate
      className="@container space-y-5"
    >
      {parts.map(({ speaker, text, ruby }) => {
        const picked = draft[speaker];
        const auto = `${speaker === me ? 'Theo Cài đặt' : 'Tự động'} · ${voiceLabel(autoVoice(speaker))}`;
        return (
          <Field
            key={speaker}
            label={
              <>
                {speaker}
                {speaker === me && (
                  <span className="font-normal text-muted-foreground">· vai của bạn</span>
                )}
              </>
            }
          >
            <div role="group" aria-label={`Vai ${speaker}`} className="space-y-3">
              <Select
                value={picked === undefined ? AUTO : String(picked)}
                onValueChange={(v) => choose(speaker, v)}
              >
                <SelectTrigger aria-label={`Giọng của vai ${speaker}`} className="w-full @md:w-96">
                  <SelectValue>{picked === undefined ? auto : voiceLabel(picked)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>{auto}</SelectItem>
                  {VOICE_SPEAKERS.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SpokenLine
                text={text}
                ruby={ruby}
                showFurigana={showFurigana}
                speaker={voices.get(speaker)}
                rate={speechRate}
                label={`Nghe thử vai ${speaker}`}
              />
            </div>
          </Field>
        );
      })}
      <FormActions note={false}>
        <ButtonLink href={backHref} variant="outline" disabled={isPending}>
          Huỷ
        </ButtonLink>
        <SubmitButton ready={dirty} pending={isPending}>
          {isPending ? 'Đang lưu…' : 'Lưu'}
        </SubmitButton>
      </FormActions>
    </form>
  );
}
