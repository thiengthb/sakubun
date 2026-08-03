'use client';

import { useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import {
  ArrowBigDown,
  ArrowBigUp,
  Heart,
  LayoutGrid,
  MessageSquare,
  Rows3,
  SearchX,
  Send,
  Trash2,
} from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Badge } from '@/components/ui/badge';
import { Explain } from '@/components/shared/explain';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { DataPagination } from '@/components/ui/data-pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { FilterPopover, FilterRow } from '@/components/shared/filter-popover';
import { SearchInput } from '@/components/shared/search-input';
import { UserAvatar } from '@/components/shell/user-avatar';
import { usePagedList } from '@/components/shared/use-paged-list';
import { dirLabel, SentenceCardShell, SentenceMeta } from '@/components/history/history-cards';
import { RelativeTime } from '@/components/shared/relative-time';
import { SpokenLine } from '@/components/shared/spoken-line';
import { useSessionState } from '@/components/shared/use-session-state';
import {
  addCommentAction,
  deleteCommentAction,
  listCommentsAction,
  toggleSentenceLikeAction,
  voteCommentAction,
} from '@/app/actions';
import { cn } from '@/lib/utils';
import { formatDateTimeVN } from '@/lib/format';
import { JLPT_LEVELS } from '@/lib/settings-schema';
import type { CommentEntry, FeedEntry } from '@/lib/feed';

/** The signed-in viewer — used to render their own avatar on the comment composer. */
export interface Viewer {
  name: string;
  image?: string | null;
}

interface AudioProps {
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}

/**
 * The "Cộng đồng" tab: members' SHARED attempts + comments. Feed content is server-fetched (content
 * only — never a schedule); comments lazy-load per card on expand (listCommentsAction) so the page
 * doesn't pull every thread up front. All copy is escaped React text (no dangerouslySetInnerHTML).
 * Toolbar (search + grid toggle + filters) mirrors the "Của tôi" tab so both feel like one family.
 */
export function CommunityFeed({
  feed,
  audio,
  viewer,
}: {
  feed: FeedEntry[];
  audio: AudioProps;
  viewer: Viewer;
}) {
  // URL-synced + reload-persistent (mirrors the "Của tôi" tab + resource tables): search + a filter set.
  const [q, setQ] = useSessionState('community.search', '', 'cq');
  const [dir, setDir] = useSessionState('community.dir', 'all', 'cdir');
  const [who, setWho] = useSessionState('community.who', 'all', 'cwho');
  const [commented, setCommented] = useSessionState('community.commented', 'all', 'cc');
  const [level, setLevel] = useSessionState('community.level', 'all', 'clvl');
  const [liked, setLiked] = useSessionState('community.liked', 'all', 'clike');
  const [scoreMin, setScoreMin] = useSessionState('community.scoreMin', 0, 'csmin');
  const [scoreMax, setScoreMax] = useSessionState('community.scoreMax', 100, 'csmax');
  const [columns, setColumns] = useSessionState<1 | 2>('community.columns', 2, 'ccols');
  // The feed grid + its pagination bar are measured so the page size fills the viewport (no scroll).
  const listRef = useRef<HTMLUListElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const needle = q.trim().toLowerCase();
  const scoreNarrowed = scoreMin > 0 || scoreMax < 100;
  const filterCount =
    (dir !== 'all' ? 1 : 0) +
    (who !== 'all' ? 1 : 0) +
    (commented !== 'all' ? 1 : 0) +
    (level !== 'all' ? 1 : 0) +
    (liked !== 'all' ? 1 : 0) +
    (scoreNarrowed ? 1 : 0);
  const resetFilters = () => {
    setDir('all');
    setWho('all');
    setCommented('all');
    setLevel('all');
    setLiked('all');
    setScoreMin(0);
    setScoreMax(100);
  };
  const filtered = useMemo(
    () =>
      feed.filter((e) => {
        if (dir !== 'all' && e.direction !== dir) return false;
        if (who === 'mine' && !e.isMine) return false;
        if (who === 'others' && e.isMine) return false;
        if (commented === 'yes' && e.commentCount === 0) return false;
        if (commented === 'no' && e.commentCount > 0) return false;
        if (level !== 'all' && e.level !== level) return false;
        if (liked === 'yes' && !e.likedByMe) return false;
        if (scoreNarrowed) {
          if (typeof e.score !== 'number') return false;
          if (e.score < scoreMin || e.score > scoreMax) return false;
        }
        if (
          needle &&
          !`${e.sourceText} ${e.userAnswer} ${e.suggested ?? ''} ${e.authorName}`
            .toLowerCase()
            .includes(needle)
        )
          return false;
        return true;
      }),
    [feed, needle, dir, who, commented, level, liked, scoreNarrowed, scoreMin, scoreMax],
  );

  // Cards ~120px tall (measured once rendered); grid is 1 col or 2 cols (columns toggle × lg) — read live.
  const paged = usePagedList(filtered, {
    topRef: listRef,
    footerRef,
    storeKey: 'community',
    rowHeight: 120,
  });

  if (feed.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Chưa có ai chia sẻ"
        description="Mở một lượt đã chấm ở tab «Của tôi» rồi bấm «Chia sẻ lên feed» để bắt đầu."
        action={<GuideLink recipe="share-turn" label="Cách chia sẻ một lượt dịch" />}
      />
    );
  }
  return (
    <div className="space-y-4">
      {/* Search left, grid toggle + filters right — the same toolbar shape as HistoryFilters. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm câu / người dịch…"
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <ExpandingIconButton
            icon={columns === 2 ? Rows3 : LayoutGrid}
            label={columns === 2 ? '1 cột' : '2 cột'}
            className="hidden lg:inline-flex"
            aria-pressed={columns === 1}
            onClick={() => setColumns(columns === 2 ? 1 : 2)}
          />
          <FilterPopover activeCount={filterCount} align="end" onReset={resetFilters}>
            <FilterRow label="Chiều dịch">
              <Select value={dir} onValueChange={setDir}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Mọi chiều</SelectItem>
                  <SelectItem value="JA_VI">JP → VN</SelectItem>
                  <SelectItem value="VI_JA">VN → JP</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>
            <FilterRow label="Của ai">
              <Select value={who} onValueChange={setWho}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="mine">Của tôi</SelectItem>
                  <SelectItem value="others">Người khác</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>
            <FilterRow label="Độ khó (JLPT)">
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Mọi cấp</SelectItem>
                  {JLPT_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterRow>
            <FilterRow label="Bình luận">
              <Select value={commented} onValueChange={setCommented}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="yes">Đã có bình luận</SelectItem>
                  <SelectItem value="no">Chưa có bình luận</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>
            <FilterRow label="Lượt thích">
              <Select value={liked} onValueChange={setLiked}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="yes">Tôi đã thích</SelectItem>
                </SelectContent>
              </Select>
            </FilterRow>
            <div className="col-span-2">
              <FilterRow label={`Điểm số: ${scoreMin}–${scoreMax}`}>
                <div className="flex h-8 items-center px-1">
                  <Slider
                    thumbLabel={['Điểm số tối thiểu', 'Điểm số tối đa']}
                    min={0}
                    max={100}
                    step={5}
                    value={[scoreMin, scoreMax]}
                    onValueChange={([lo, hi]) => {
                      setScoreMin(lo);
                      setScoreMax(hi);
                    }}
                  />
                </div>
              </FilterRow>
            </div>
          </FilterPopover>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Không có lượt nào khớp bộ lọc." className="py-12" />
      ) : (
        <>
          <ul
            ref={listRef}
            className={cn('grid grid-cols-1 gap-3', columns === 2 && 'lg:grid-cols-2')}
          >
            {paged.items.map((e) => (
              <FeedCard key={e.id} entry={e} audio={audio} viewer={viewer} />
            ))}
          </ul>
          <div
            ref={footerRef}
            className="flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center"
          >
            <span className="text-xs text-muted-foreground">
              {paged.start + 1}–{Math.min(paged.start + paged.pageSize, paged.total)} /{' '}
              {paged.total} lượt
              {paged.total !== feed.length && ` (lọc từ ${feed.length})`}
            </span>
            <DataPagination
              page={paged.page}
              pageCount={paged.pageCount}
              onPageChange={paged.setPage}
              pageSize={paged.pageSize}
              pageSizeOptions={paged.sizeOptions}
              onPageSizeChange={paged.choosePageSize}
              autoFit={paged.autoFit}
              autoFitSize={paged.autoFitSize}
              onAutoFit={paged.onAutoFit}
            />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A community feed card — the SAME compact shell as the "Của tôi" card (SentenceCardShell): header
 * (chiều dịch · điểm · [ngày] · like · số bình luận · avatar người dịch với tooltip tên) + a one-line
 * đề + the shared meta line. The like/comment/avatar cluster is one row so the three sit level with
 * each other. A click opens FeedDetail (full attempt + the comment thread).
 */
function FeedCard({
  entry,
  audio,
  viewer,
}: {
  entry: FeedEntry;
  audio: AudioProps;
  viewer: Viewer;
}) {
  const jaSource = entry.direction === 'JA_VI';
  return (
    <SentenceCardShell
      header={
        <>
          <Badge variant="secondary">{dirLabel(entry.direction)}</Badge>
          {typeof entry.score === 'number' && (
            <span className="font-medium">{entry.score}/100</span>
          )}
          <RelativeTime value={entry.sharedAt} className="ml-auto" />
          {/* like · bình luận · avatar — one aligned cluster (items-center, equal glyph baseline). */}
          <span className="inline-flex items-center gap-2">
            <LikeButton sentenceId={entry.id} count={entry.likeCount} likedByMe={entry.likedByMe} />
            <Explain text={`${entry.commentCount} bình luận về câu này`}>
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-3.5" aria-hidden />
                {entry.commentCount}
              </span>
            </Explain>
            <Explain text={`${entry.authorName}${entry.isMine ? ' (bạn)' : ''}`}>
              <span
                tabIndex={0}
                aria-label={`Người dịch: ${entry.authorName}${entry.isMine ? ' (bạn)' : ''}`}
                className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <UserAvatar name={entry.authorName} image={entry.authorImage} size="xs" />
              </span>
            </Explain>
          </span>
        </>
      }
      dialog={() => <FeedDetail entry={entry} audio={audio} viewer={viewer} />}
    >
      {jaSource ? (
        <SpokenLine
          text={entry.sourceText}
          ruby={entry.sourceRuby}
          showFurigana={audio.showFurigana}
          speaker={audio.voiceSpeaker}
          rate={audio.speechRate}
          label="Nghe đề"
          truncate
        />
      ) : (
        <p lang="vi" className="min-w-0 truncate font-medium">
          {entry.sourceText}
        </p>
      )}
      <SentenceMeta level={entry.level} charCount={entry.sourceText.length} />
    </SentenceCardShell>
  );
}

/**
 * Public like/upvote on a shared attempt (Phase 5). Heart fills (brand color) when the viewer has liked;
 * the count sits beside it. Optimistic via `useOptimistic` so the toggle is instant, and it re-syncs
 * from props after the feed revalidates. Stops propagation so a like inside the clickable card doesn't
 * open the detail dialog.
 */
function LikeButton({
  sentenceId,
  count,
  likedByMe,
}: {
  sentenceId: string;
  count: number;
  likedByMe: boolean;
}) {
  const [opt, setOpt] = useOptimistic({ liked: likedByMe, count });
  const [, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOpt({ liked: !opt.liked, count: opt.count + (opt.liked ? -1 : 1) });
      const r = await toggleSentenceLikeAction(sentenceId);
      if (!r.ok) toastResult(r, '');
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={opt.liked}
      aria-label={opt.liked ? 'Bỏ thích' : 'Thích'}
      title={opt.liked ? 'Bỏ thích' : 'Thích'}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        opt.liked ? 'text-accent-brand' : 'text-muted-foreground hover:text-accent-brand',
      )}
    >
      <Heart className={cn('size-3.5', opt.liked && 'fill-current')} aria-hidden />
      {opt.count > 0 && <span className="tabular-nums">{opt.count}</span>}
    </button>
  );
}

/** The community card's detail modal: full đề · người dịch · tham khảo · nhận xét · comment thread. */
function FeedDetail({
  entry,
  audio,
  viewer,
}: {
  entry: FeedEntry;
  audio: AudioProps;
  viewer: Viewer;
}) {
  const jaSource = entry.direction === 'JA_VI';
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
          <Badge variant="secondary">{dirLabel(entry.direction)}</Badge>
          {typeof entry.score === 'number' && (
            <span className="font-medium">{entry.score}/100</span>
          )}
          {/* mr-6 keeps the author clear of the dialog's top-right close button. */}
          <span className="mr-6 ml-auto inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <UserAvatar name={entry.authorName} image={entry.authorImage} size="xs" />
            {entry.authorName}
            {entry.isMine ? ' (bạn)' : ''}
          </span>
        </DialogTitle>
        <DialogDescription className="sr-only">Chi tiết lượt dịch cộng đồng</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Đề</div>
          {jaSource ? (
            <SpokenLine
              text={entry.sourceText}
              ruby={entry.sourceRuby}
              showFurigana={audio.showFurigana}
              speaker={audio.voiceSpeaker}
              rate={audio.speechRate}
              label="Nghe đề"
            />
          ) : (
            <p lang="vi" className="font-medium">
              {entry.sourceText}
            </p>
          )}
        </div>

        <SentenceMeta level={entry.level} charCount={entry.sourceText.length} />

        <div className="space-y-2 border-t border-border/70 pt-3">
          {/* VI→JA (and CONVERSATION): the shared answer IS Japanese content — same play + karaoke line
              as everywhere else (invariant #9); no ruby column exists for it, so no furigana. */}
          {entry.direction === 'VI_JA' ? (
            <div className="flex flex-wrap items-end gap-1.5">
              <span className="text-muted-foreground">Người dịch:</span>
              <SpokenLine
                text={entry.userAnswer}
                showFurigana={audio.showFurigana}
                speaker={audio.voiceSpeaker}
                rate={audio.speechRate}
                label="Nghe câu đã chia sẻ"
              />
            </div>
          ) : (
            <p>
              <span className="text-muted-foreground">Người dịch: </span>
              {entry.userAnswer}
            </p>
          )}
          {entry.suggested &&
            (entry.direction === 'VI_JA' ? (
              <div className="flex flex-wrap items-end gap-1.5">
                <span className="text-muted-foreground">Tham khảo:</span>
                <SpokenLine
                  text={entry.suggested}
                  ruby={entry.suggestedRuby}
                  showFurigana={audio.showFurigana}
                  speaker={audio.voiceSpeaker}
                  rate={audio.speechRate}
                  label="Nghe đáp án"
                />
              </div>
            ) : (
              <p>
                <span className="text-muted-foreground">Tham khảo: </span>
                {entry.suggested}
              </p>
            ))}
          {entry.feedback && <p className="text-muted-foreground">{entry.feedback}</p>}
        </div>

        {/* Comment thread owns its own top divider (border-t) — no extra wrapper divider here. */}
        <CommentThread sentenceId={entry.id} initialCount={entry.commentCount} viewer={viewer} />
      </div>
    </DialogContent>
  );
}

function CommentThread({
  sentenceId,
  initialCount,
  viewer,
}: {
  sentenceId: string;
  initialCount: number;
  viewer: Viewer;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [count, setCount] = useState(initialCount);
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();

  const load = () =>
    startTransition(async () => {
      const r = await listCommentsAction(sentenceId);
      if (r.ok) {
        setComments(r.data);
        setCount(r.data.length);
        setLoaded(true);
      } else {
        toastResult(r, '');
      }
    });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const r = await addCommentAction(sentenceId, text);
      if (r.ok) {
        setBody('');
        const list = await listCommentsAction(sentenceId);
        if (list.ok) {
          setComments(list.data);
          setCount(list.data.length);
        }
      }
      toastResult(r, 'Đã gửi bình luận');
    });
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const r = await deleteCommentAction(id);
      if (r.ok) {
        setComments((cs) => cs.filter((c) => c.id !== id));
        setCount((n) => Math.max(0, n - 1));
      }
      toastResult(r, 'Đã xóa bình luận');
    });

  const vote = (id: string, value: 1 | -1) =>
    startTransition(async () => {
      const r = await voteCommentAction(id, value);
      if (r.ok) {
        setComments((cs) =>
          cs.map((c) => (c.id === id ? { ...c, score: r.data.score, myVote: r.data.myVote } : c)),
        );
      } else {
        toastResult(r, '');
      }
    });

  return (
    <div className="border-t border-border/70 pt-2">
      <Button variant="ghost" size="sm" onClick={toggle} className="text-muted-foreground">
        <MessageSquare className="size-3.5" />
        {count > 0 ? `${count} bình luận` : 'Bình luận'}
      </Button>

      {open && (
        <div className="mt-3 space-y-4">
          {loaded &&
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2.5 text-sm">
                <UserAvatar name={c.authorName} image={c.authorImage} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {c.authorName}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTimeVN(new Date(c.createdAt))}
                    </span>
                    {c.canDelete && (
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={isPending}
                        aria-label="Xóa bình luận"
                        title="Xóa bình luận"
                        className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                  <CommentVote
                    score={c.score}
                    myVote={c.myVote}
                    pending={isPending}
                    onVote={(v) => vote(c.id, v)}
                  />
                </div>
              </div>
            ))}
          {loaded && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Chưa có bình luận. Hãy là người đầu tiên.
            </p>
          )}

          {/* Composer — the viewer's own avatar sits beside the box, mirroring a comment row. */}
          <div className="flex items-start gap-2.5">
            <UserAvatar name={viewer.name} image={viewer.image} size="sm" className="mt-0.5" />
            <div className="flex flex-1 items-end gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Viết góp ý…"
                className="min-h-9 flex-1 resize-y rounded-md bg-background px-3 py-2 text-sm ring-1 ring-foreground/15 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={submit} disabled={isPending || !body.trim()}>
                <Send className="size-3.5" /> Gửi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Up/down vote control for a comment (Phase 5). A compact HORIZONTAL rail under the comment body:
 * upvote · net score · downvote. The active direction fills (up = brand, down = destructive); clicking
 * the active direction again clears the vote.
 */
function CommentVote({
  score,
  myVote,
  pending,
  onVote,
}: {
  score: number;
  myVote: number;
  pending: boolean;
  onVote: (value: 1 | -1) => void;
}) {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1 text-muted-foreground">
      <button
        type="button"
        onClick={() => onVote(1)}
        disabled={pending}
        aria-label="Ủng hộ"
        aria-pressed={myVote === 1}
        className={cn(
          'transition-colors hover:text-accent-brand',
          myVote === 1 && 'text-accent-brand',
        )}
      >
        <ArrowBigUp className={cn('size-4', myVote === 1 && 'fill-current')} aria-hidden />
      </button>
      <span
        className={cn(
          'min-w-4 text-center text-xs font-medium tabular-nums',
          myVote === 1 && 'text-accent-brand',
          myVote === -1 && 'text-destructive',
        )}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => onVote(-1)}
        disabled={pending}
        aria-label="Không ủng hộ"
        aria-pressed={myVote === -1}
        className={cn(
          'transition-colors hover:text-destructive',
          myVote === -1 && 'text-destructive',
        )}
      >
        <ArrowBigDown className={cn('size-4', myVote === -1 && 'fill-current')} aria-hidden />
      </button>
    </div>
  );
}
