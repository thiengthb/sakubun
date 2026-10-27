'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FormActions, SubmitButton } from '@/components/common/field';
import { FormGuide, GuideSample } from '@/components/common/form-guide';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useServerAction } from '@/components/common/use-server-action';
import { deleteScriptAction, saveScriptAction } from '@/app/kaiwa/actions';
import { toastResult } from '@/lib/core/action-toast';
import { scriptSpeakers } from '@/lib/kaiwa/layout';
import {
  checkBody,
  checkTitle,
  describeProblems,
  normalizeBody,
  parseScript,
  SCRIPT_LIMITS,
} from '@/lib/kaiwa/parse';

export interface EditableScript {
  id: string;
  version: number;
  title: string;
  body: string;
}

// Form template (K3c, thien 2026-10-27): write or fix a script on the web, beside writing it with
// the AI. The text is the same format the AI saves, checked as the learner types; the save goes
// through saveScript, so a version the AI saved meanwhile is never overwritten.
export function KaiwaScriptForm({ script }: { script?: EditableScript }) {
  const router = useRouter();
  const editing = !!script;
  const [title, setTitle] = useState(script?.title ?? '');
  const [body, setBody] = useState(script?.body ?? '');
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const remove = useServerAction(deleteScriptAction, {
    success: 'Đã xoá kịch bản',
    onSuccess: () => router.push('/kaiwa'),
  });

  // An empty field is no error; the save button stays off until both are filled.
  const titleError = title.trim() ? describeProblems(checkTitle(title)) || null : null;
  const bodyError = body.trim() ? describeProblems(checkBody(normalizeBody(body))) || null : null;
  const lines = parseScript(body);
  const speakers = scriptSpeakers(lines);
  const changed = !editing || title.trim() !== script.title || normalizeBody(body) !== script.body;
  const ready = changed && !!title.trim() && !!body.trim() && !titleError && !bodyError;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const saved = await saveScriptAction({
        id: script?.id,
        version: script?.version,
        title,
        body,
      });
      if (toastResult(saved, editing ? 'Đã lưu' : 'Đã thêm kịch bản')) {
        router.push(`/kaiwa/${saved.data.id}`);
        router.refresh();
      }
    });
  };

  return (
    <PageShell
      template="form"
      breadcrumb={<ParentCrumbs section="kaiwa" self />}
      title={editing ? 'Sửa kịch bản' : 'Thêm kịch bản'}
    >
      <Card>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-6">
            <Field
              label="Tiêu đề"
              required
              error={titleError}
              count={{ value: title.trim().length, max: SCRIPT_LIMITS.title }}
            >
              <Input
                id="script-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Ở nhà hàng"
              />
            </Field>
            <Field
              label="Kịch bản"
              required
              error={bodyError}
              hint={
                lines.length > 0
                  ? `${lines.length} câu` +
                    (speakers.length > 0 ? ` · Người nói: ${speakers.join(', ')}` : ' · Độc thoại')
                  : undefined
              }
              count={{ value: body.length, max: SCRIPT_LIMITS.body }}
            >
              <Textarea
                id="script-body"
                lang="ja"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="min-h-48 whitespace-pre"
                placeholder={'A: いらっしゃいませ。 | Xin mời vào.\nB: 二人です。 | Hai người.'}
              />
            </Field>
            <FormActions>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirming(true)}
                  disabled={isPending}
                >
                  <Trash2 aria-hidden />
                  Xoá
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isPending}
              >
                Huỷ
              </Button>
              <SubmitButton ready={ready} pending={isPending}>
                {editing ? 'Lưu' : 'Thêm kịch bản'}
              </SubmitButton>
            </FormActions>
          </form>
        </CardContent>
      </Card>
      {editing && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Xoá kịch bản này?"
          description={`"${script.title}" sẽ mất hẳn, không lấy lại được.`}
          confirmLabel="Xoá"
          pending={remove.isPending}
          onConfirm={() => remove.run(script.id)}
        />
      )}
      <FormGuide
        items={[
          {
            term: 'Mỗi dòng một câu',
            text: (
              <>
                Người nói, câu tiếng Nhật, rồi nghĩa sau dấu |:{' '}
                <GuideSample>A: いらっしゃいませ。 | Xin mời vào.</GuideSample>
              </>
            ),
          },
          {
            term: 'Người nói',
            text: 'Một hai chữ cái (A, B) hoặc tên tiếng Nhật (田中). Trên trang kịch bản bạn chọn mình là ai.',
          },
          {
            term: 'Bối cảnh',
            text: (
              <>
                Dòng không có người nói nằm giữa hội thoại, như{' '}
                <GuideSample>店の中は静かだった。 | Trong quán yên tĩnh.</GuideSample>
              </>
            ),
          },
          {
            term: 'Furigana',
            text: (
              <>
                Tự có khi lưu. Muốn đọc khác thì viết ngay sau chữ Hán:{' '}
                <GuideSample>二人[ふたり]</GuideSample>
              </>
            ),
          },
          {
            term: 'Sửa cùng AI',
            text: 'Nếu AI vừa lưu bản mới trong lúc bạn sửa, nút lưu báo lỗi để không ghi đè. Tải lại trang rồi sửa trên bản mới.',
          },
          {
            term: 'Giới hạn',
            text: `Tiêu đề ${SCRIPT_LIMITS.title} ký tự, tối đa ${SCRIPT_LIMITS.lines} dòng, mỗi câu ${SCRIPT_LIMITS.japanese} ký tự.`,
          },
        ]}
      />
    </PageShell>
  );
}
