'use client';

import { Field } from '@/components/shared/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { TabsContent } from '@/components/ui/tabs';
import { SpeakButton } from '@/components/shared/speak-button';
import { VOICE_SPEAKERS, type Settings } from '@/lib/settings-schema';

/** Tab "Nghe & nói": the app's own reference-audio TTS — which voice and the default playback speed. */
export function SensoryTab({
  settings,
  set,
}: {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  return (
    <TabsContent value="sensory" className="pt-2">
      <section className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Giọng đọc mẫu"
            info="Giọng cho các nút phát âm ở trang Lịch sử (đọc câu tiếng Nhật). Dùng engine VOICEVOX chạy kèm app — chọn giọng nam / nữ, ấm / trầm… theo ý bạn. Nếu chưa bật VOICEVOX, nút phát tự chuyển sang giọng của trình duyệt / hệ điều hành. Đây là giọng do APP phát — khác với voice mode của Claude Desktop."
          >
            <div className="flex items-center gap-2">
              <Select
                value={String(settings.voiceSpeaker)}
                onValueChange={(v) => set('voiceSpeaker', Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn giọng" />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_SPEAKERS.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <SpeakButton
                text="天気がいいから、散歩しましょう。"
                label="Nghe thử giọng"
                speaker={settings.voiceSpeaker}
                rate={settings.speechRate}
                className="shrink-0"
              />
            </div>
          </Field>

          <Field
            label={`Tốc độ đọc mặc định: ${settings.speechRate}×`}
            info="Tốc độ mặc định cho các nút phát âm (VOICEVOX giữ nguyên cao độ khi chậm lại). <1 = chậm hơn, dễ nghe theo; >1 = nhanh hơn. Ở trang Lịch sử vẫn chỉnh nhanh được từng câu ngay tại nút."
          >
            <div className="flex h-9 items-center gap-3">
              <Slider
                thumbLabel="Tốc độ đọc mặc định"
                min={0.5}
                max={2}
                step={0.25}
                trackClassName="h-3"
                ticks={[0.75, 1, 1.25, 1.5, 1.75]}
                value={[settings.speechRate]}
                onValueChange={([v]) => set('speechRate', v)}
              />
              <span className="w-10 shrink-0 text-right text-sm text-muted-foreground tabular-nums">
                {settings.speechRate}×
              </span>
            </div>
          </Field>
        </div>
      </section>
    </TabsContent>
  );
}
