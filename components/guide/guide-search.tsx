'use client';

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Bell,
  BookOpen,
  Download,
  FilePlus2,
  Flame,
  Footprints,
  Gauge,
  Globe,
  GraduationCap,
  Languages,
  Layers,
  Library,
  ListChecks,
  MessageCircleQuestionMark,
  MessageSquare,
  MessagesSquare,
  Presentation,
  Palette,
  Repeat2,
  SearchX,
  SlidersHorizontal,
  Stethoscope,
  Sparkle,
  Sparkles,
  Star,
  TrendingDown,
  Type,
  UserSearch,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchInput } from '@/components/shared/search-input';
import { useSessionState } from '@/components/shared/use-session-state';
import {
  GUIDE_TOPIC_BY_ID,
  GUIDE_TOPIC_GROUPS,
  GUIDE_TOPIC_META,
  isGuideTopicId,
  matchGuideTopics,
  recentGuideTopics,
  type GuideTopicGroupId,
  type GuideTopicId,
} from '@/components/guide/guide-topic-meta';

/**
 * The searchable shell of the `/guide` "Tính năng" tour, and the ONLY client code the tour needs.
 *
 * Why it is split this way: the topic BODIES are server-rendered JSX passed in as `children`, so all that
 * copy stays out of the client bundle; this file holds only the interactive parts (the query, which topic
 * is open, the icons) plus the strings from `guide-topic-meta` (a few KB). A filtered-out topic simply
 * does not mount — its server payload is never used.
 *
 * `ICONS` is a `Record<GuideTopicId, …>`, so adding a topic to the registry without an icon fails the
 * BUILD, not review (a lucide component cannot be passed as a prop from a Server Component anyway).
 */

const ICONS: Record<GuideTopicId, LucideIcon> = {
  translate: Languages,
  quiz: ListChecks,
  'ask-anything': MessageCircleQuestionMark,
  'production-ladder': Footprints,
  'difficulty-anchors': SlidersHorizontal,
  'new-pattern-pace': Gauge,
  mastery: GraduationCap,
  modes: MessagesSquare,
  'teach-back': Presentation,
  'declared-scaffolding': Layers,
  vocab: BookOpen,
  enrichment: Sparkles,
  'card-ratchet': FilePlus2,
  'mistake-mining': Repeat2,
  'library-health': Stethoscope,
  notifications: Bell,
  library: Library,
  groups: Layers,
  star: Star,
  progress: TrendingDown,
  'learner-profile': UserSearch,
  streak: Flame,
  data: Download,
  sharing: Globe,
  feed: MessageSquare,
  sensory: Volume2,
  furigana: Type,
  quality: Palette,
};

interface GuideSearchValue {
  /** Ids matching the current query (every id when the box is empty). */
  visible: Set<GuideTopicId>;
  /** The raw query — non-empty means "the user is filtering", which hides decorative hints. */
  query: string;
}

const GuideSearchContext = createContext<GuideSearchValue | null>(null);

function useGuideSearch(): GuideSearchValue {
  const value = useContext(GuideSearchContext);
  if (!value) throw new Error('Guide topic rendered outside <GuideTopicBrowser>');
  return value;
}

/**
 * Search box + the accordion that hosts the topics. Both the query and the open topic persist
 * (sessionStorage + the URL: `?gq=` and `?topic=`), so a filtered view survives navigation and a topic
 * can be LINKED to — `?tab=features&topic=furigana` opens and scrolls to that topic.
 */
export function GuideTopicBrowser({ children }: { children: ReactNode }) {
  const [query, setQuery] = useSessionState('guide.q', '', 'gq');
  const [open, setOpen] = useSessionState('guide.feature', 'translate', 'topic');
  const visible = useMemo(() => matchGuideTopics(query), [query]);
  const value = useMemo<GuideSearchValue>(() => ({ visible, query }), [visible, query]);

  // A deep link has to WIN over the stored topic: `useSessionState` reads sessionStorage first and only
  // falls back to the URL, so returning to /guide in the same tab would otherwise re-open the previously
  // expanded topic and ignore `?topic=`. Sync once per mount (a ref, not state — this must not re-run
  // when the user then collapses the topic by hand), then bring it into view; the timeout lets the
  // accordion mount + expand the item before we scroll to it.
  const synced = useRef(false);
  useEffect(() => {
    if (synced.current) return;
    synced.current = true;
    const target = new URLSearchParams(window.location.search).get('topic');
    if (!target || !isGuideTopicId(target)) return;
    if (target !== open) setOpen(target);
    const timer = setTimeout(() => {
      document
        .getElementById(`guide-topic-${target}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    return () => clearTimeout(timer);
  }, [open, setOpen]);

  const filtering = query.trim() !== '';

  return (
    <GuideSearchContext.Provider value={value}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trong hướng dẫn…"
            aria-label="Tìm trong hướng dẫn"
          />
          {filtering && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {visible.size}/{GUIDE_TOPIC_META.length} mục
            </span>
          )}
        </div>

        {/* "What changed since I last read this?" — the 3 newest topics, one click away. Hidden while
            filtering (the query is the user's own agenda then). */}
        {!filtering && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkle className="size-3.5 shrink-0" aria-hidden />
              Mới cập nhật
            </span>
            {recentGuideTopics().map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setOpen(t.id);
                  document
                    .getElementById(`guide-topic-${t.id}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="max-w-56 truncate rounded-md border border-border px-2 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {t.title}
              </button>
            ))}
          </div>
        )}

        {visible.size === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Không có mục nào khớp"
            description="Thử một từ khác, hoặc xoá ô tìm để xem toàn bộ tính năng."
            className="py-10"
          />
        ) : (
          <Accordion
            type="single"
            collapsible
            value={open}
            onValueChange={setOpen}
            className="w-full"
          >
            {children}
          </Accordion>
        )}
      </div>
    </GuideSearchContext.Provider>
  );
}

/**
 * Heading for one cluster of topics. Disappears when the current query leaves the group empty, so a
 * filtered tour never shows a header with nothing under it.
 */
export function GuideTopicGroupHeading({ group }: { group: GuideTopicGroupId }) {
  const { visible, query } = useGuideSearch();
  const count = GUIDE_TOPIC_META.filter((t) => t.group === group && visible.has(t.id)).length;
  if (count === 0) return null;
  const meta = GUIDE_TOPIC_GROUPS.find((g) => g.id === group);
  if (!meta) return null;

  return (
    <div className="px-1 pt-5 pb-1.5 first:pt-1">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {meta.label}
        <span className="font-normal tabular-nums opacity-70">{count}</span>
      </h2>
      {query.trim() === '' && <p className="pt-0.5 text-xs text-muted-foreground">{meta.hint}</p>}
    </div>
  );
}

/**
 * One collapsible topic: icon + title + one-line summary on the trigger (so the tab scans without
 * expanding anything), the server-rendered body revealed on expand. Title/summary come from the registry
 * — never passed in — so there is exactly one place to edit them.
 */
export function GuideTopicItem({ id, children }: { id: GuideTopicId; children: ReactNode }) {
  const { visible } = useGuideSearch();
  if (!visible.has(id)) return null;
  const meta = GUIDE_TOPIC_BY_ID[id];
  const Icon = ICONS[id];

  return (
    <AccordionItem value={id} id={`guide-topic-${id}`}>
      <AccordionTrigger className="gap-3">
        <div className="flex min-w-0 items-start gap-3 text-left">
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{meta.title}</span>
            <span className="text-xs font-normal text-muted-foreground">{meta.summary}</span>
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pl-8 text-sm leading-6">{children}</AccordionContent>
    </AccordionItem>
  );
}
