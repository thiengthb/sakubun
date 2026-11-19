'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Layers, Library, Plus, Sparkles, type LucideIcon } from 'lucide-react';
import { addOneItemAction } from '@/app/actions';
import { toastResult } from '@/lib/core/action-toast';
import { cn } from '@/lib/core/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { FormActions, SubmitButton } from '@/components/common/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  EMPTY_DRAFT,
  ItemFields,
  useItemDraft,
  type ItemKind,
} from '@/components/features/resources/item-fields';

// Kho's "Thêm" (U4e2, layout B that thien picked on 19/11, docs/plans/2026-11-14-u4-kho.md): four ways
// to add, in a panel on the right (laptop) or a sheet near full height (phone). The first three open
// where that way lives; "Tự viết" is a short form right in the panel, so one word needs no new page.

interface Way {
  title: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  tone: string;
}

export const ADD_WAYS: readonly Way[] = [
  {
    title: 'Lấy theo cấp JLPT',
    hint: 'Mở bảng N5–N1, lấy từng chặng 20 từ',
    href: '/resources',
    icon: Layers,
    tone: 'bg-warn-wash text-warn',
  },
  {
    title: 'Bộ người khác chia sẻ',
    hint: 'Mở Kho chung: bộ theo chủ đề, lấy về là của bạn',
    href: '/library',
    icon: Library,
    tone: 'bg-ok-wash text-ok',
  },
  {
    title: 'Nhờ Claude soạn',
    hint: 'Gửi Claude đoạn văn hay chủ đề, Claude thêm vào kho qua Sakubun',
    href: '/settings?tab=guide',
    icon: Sparkles,
    tone: 'bg-info-wash text-info',
  },
];

export function AddSheet() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<ExpandingIconButton icon={Plus} label="Thêm" variant="default" />} />
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'gap-0 overflow-y-auto',
          isMobile ? 'top-12 rounded-t-2xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="pr-12">
          <SheetTitle className="text-heading font-bold">Thêm vào kho</SheetTitle>
          <SheetDescription>Chọn một cách, hay gõ một mục ngay bên dưới.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          <ul className="flex flex-col gap-2">
            {ADD_WAYS.map((w) => (
              <li key={w.href}>
                <WayLink way={w} onPick={() => setOpen(false)} />
              </li>
            ))}
          </ul>
          <ManualAddForm />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WayLink({ way, onPick }: { way: Way; onPick: () => void }) {
  const Icon = way.icon;
  return (
    <Link
      href={way.href}
      onClick={onPick}
      className="flex min-h-14 items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
    >
      <span
        aria-hidden
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', way.tone)}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{way.title}</span>
        <span className="block text-xs text-muted-foreground">{way.hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

const KIND_LABEL: Record<ItemKind, string> = { vocab: 'Từ vựng', grammar: 'Ngữ pháp' };
const NOUN: Record<ItemKind, string> = { vocab: 'từ', grammar: 'mẫu' };

/** "Tự viết": one item, typed in the panel. Pasting many lines or Excel stays on the Add page. */
function ManualAddForm() {
  const router = useRouter();
  const [kind, setKind] = useState<ItemKind>('vocab');
  const { draft, set, errors, ready, reset } = useItemDraft(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ready) return;
    startTransition(async () => {
      const r = await addOneItemAction(
        {
          expression: draft.expression,
          reading: draft.reading.trim() || undefined,
          meaningVi: draft.meaningVi,
          level: draft.level || undefined,
          notes: draft.notes.trim() || undefined,
        },
        kind,
      );
      if (toastResult(r, `Đã thêm ${NOUN[kind]} vào kho`)) {
        reset();
        router.refresh();
      }
    });
  };

  return (
    <section
      aria-labelledby="add-sheet-manual"
      className="mt-2 flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
        >
          <Plus className="size-4" />
        </span>
        <h3 id="add-sheet-manual" className="flex-1 font-semibold">
          Tự viết
        </h3>
        <ToggleGroup
          type="single"
          variant="choice"
          aria-label="Loại mục"
          value={kind}
          onValueChange={(v) => v && setKind(v as ItemKind)}
        >
          {(['vocab', 'grammar'] as const).map((k) => (
            <ToggleGroupItem key={k} value={k} className="px-3">
              {KIND_LABEL[k]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <form onSubmit={submit} noValidate className="@container space-y-4">
        <ItemFields kind={kind} draft={draft} set={set} errors={errors} idPrefix="add-sheet" />
        <FormActions>
          <SubmitButton ready={ready} pending={isPending}>
            {isPending ? 'Đang thêm…' : `Thêm ${NOUN[kind]}`}
          </SubmitButton>
        </FormActions>
      </form>
      <Link
        href={`/resources/new?kind=${kind}`}
        className="text-sm text-muted-foreground underline underline-offset-2"
      >
        Dán nhiều dòng hay nhập Excel
      </Link>
    </section>
  );
}
