'use client';

import { useState } from 'react';
import { Field } from '@/components/common/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ITEM_LIMITS, itemTextError, type LimitedField } from '@/lib/library/item-limits';
import { textLength } from '@/lib/library/group-limits';
import { JLPT_LEVELS } from '@/lib/settings/schema';

export type ItemKind = 'grammar' | 'vocab';

// One set of fields for adding and for editing a word or a pattern: the same labels, order and
// placeholders on both pages (UI redo step 6.7), so the form a learner fills is the form they fix.
export const ITEM_COPY: Record<
  ItemKind,
  {
    exprLabel: string;
    /** The expression as the object of "Cần nhập …". */
    exprNoun: string;
    exprPlaceholder: string;
    readingPlaceholder: string;
    meaningPlaceholder: string;
    notesPlaceholder: string;
  }
> = {
  grammar: {
    exprLabel: 'Mẫu ngữ pháp',
    exprNoun: 'mẫu ngữ pháp',
    exprPlaceholder: '〜ばかりに',
    readingPlaceholder: '',
    meaningPlaceholder: 'chỉ vì… (dẫn đến hậu quả xấu)',
    notesPlaceholder: 'Cấu trúc, cách chia, sắc thái…',
  },
  vocab: {
    exprLabel: 'Từ (tiếng Nhật)',
    exprNoun: 'từ',
    exprPlaceholder: '図書館',
    readingPlaceholder: 'としょかん',
    meaningPlaceholder: 'thư viện',
    notesPlaceholder: 'Câu ví dụ, sắc thái, cách dùng…',
  },
};

export type ItemDraft = {
  expression: string;
  reading: string;
  meaningVi: string;
  /** A JLPT level, or '' for not known. */
  level: string;
  notes: string;
};

export const EMPTY_DRAFT: ItemDraft = {
  expression: '',
  reading: '',
  meaningVi: '',
  level: '',
  notes: '',
};

type ItemErrors = Record<'expression' | 'reading' | 'meaningVi', string | null>;

/**
 * The draft, its errors and the send check. Too long shows at once, while typing; empty only once
 * the form is sent. When `original` is given (editing), an old value longer than a limit is kept:
 * only a changed value is checked, as the server does.
 */
export function useItemDraft(kind: ItemKind, initial: ItemDraft, original?: ItemDraft) {
  const [draft, setDraft] = useState(initial);
  const [sent, setSent] = useState(false);
  const set = (field: keyof ItemDraft, value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const tooLong = (field: LimitedField & keyof ItemDraft) =>
    original && draft[field].trim() === original[field].trim()
      ? null
      : itemTextError(field, draft[field]);
  const errors: ItemErrors = {
    expression:
      tooLong('expression') ??
      (sent && !draft.expression.trim() ? `Cần nhập ${ITEM_COPY[kind].exprNoun}` : null),
    reading: tooLong('reading'),
    meaningVi: tooLong('meaningVi') ?? (sent && !draft.meaningVi.trim() ? 'Cần nhập nghĩa' : null),
  };

  /** Marks the form sent; when a field is wrong, focuses the first one and returns false. */
  const check = (form: HTMLFormElement, idPrefix: string) => {
    setSent(true);
    const bad =
      !draft.expression.trim() || errors.expression
        ? 'expression'
        : errors.reading
          ? 'reading'
          : !draft.meaningVi.trim() || errors.meaningVi
            ? 'meaning'
            : null;
    if (bad) form.querySelector<HTMLElement>(`#${idPrefix}-${bad}`)?.focus();
    return !bad;
  };

  const reset = () => {
    setDraft(EMPTY_DRAFT);
    setSent(false);
  };

  return { draft, set, errors, check, reset };
}

export function ItemFields({
  kind,
  draft,
  set,
  errors,
  idPrefix,
  editing = false,
  autoFocus = false,
}: {
  kind: ItemKind;
  draft: ItemDraft;
  set: (field: keyof ItemDraft, value: string) => void;
  errors: ItemErrors;
  /** Ids are `<prefix>-expression`, `-reading`, `-meaning`: the send check focuses them. */
  idPrefix: string;
  /** Editing an item already on the review schedule: says the schedule is kept. */
  editing?: boolean;
  autoFocus?: boolean;
}) {
  const copy = ITEM_COPY[kind];
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <Field
        label={copy.exprLabel}
        required
        error={errors.expression}
        count={{ value: textLength(draft.expression.trim()), max: ITEM_LIMITS.expression }}
        info={editing ? 'Sửa nội dung không đổi lịch ôn của mục này.' : undefined}
      >
        <Input
          id={`${idPrefix}-expression`}
          value={draft.expression}
          onChange={(e) => set('expression', e.target.value)}
          lang="ja"
          placeholder={copy.exprPlaceholder}
          autoFocus={autoFocus}
        />
      </Field>
      <Field
        label="Cách đọc (kana)"
        error={errors.reading}
        count={{ value: textLength(draft.reading.trim()), max: ITEM_LIMITS.reading }}
      >
        <Input
          id={`${idPrefix}-reading`}
          value={draft.reading}
          onChange={(e) => set('reading', e.target.value)}
          lang="ja"
          placeholder={copy.readingPlaceholder}
        />
      </Field>
      <Field
        label="Nghĩa (tiếng Việt)"
        required
        error={errors.meaningVi}
        count={{ value: textLength(draft.meaningVi.trim()), max: ITEM_LIMITS.meaningVi }}
        className="@2xl:col-span-2"
      >
        <Input
          id={`${idPrefix}-meaning`}
          value={draft.meaningVi}
          onChange={(e) => set('meaningVi', e.target.value)}
          placeholder={copy.meaningPlaceholder}
        />
      </Field>
      <Field label="Cấp JLPT">
        <Select value={draft.level} onValueChange={(v) => set('level', v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Không rõ" />
          </SelectTrigger>
          <SelectContent>
            {JLPT_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Ghi chú" className="@2xl:col-span-2">
        <Textarea
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder={copy.notesPlaceholder}
        />
      </Field>
    </div>
  );
}
