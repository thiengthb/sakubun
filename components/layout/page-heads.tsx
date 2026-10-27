import {
  BookOpenText,
  BookText,
  ChartColumn,
  ClipboardPaste,
  Compass,
  Database,
  Dumbbell,
  FileSpreadsheet,
  FolderOpen,
  GalleryVerticalEnd,
  Languages,
  List,
  TextCursorInput,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import type { PageTabItem } from '@/components/common/page-tabs';
import { SkeletonText } from '@/components/layout/skeleton-text';

/**
 * A template page's tabs and where the open one is kept. The page and its loading screen read the
 * same object, so the skeleton names the same tabs and underlines the one that will open
 * (docs/ui-standard.md › Đang tải). Plain module: a server loading.tsx cannot import a value from a
 * 'use client' file.
 */
export interface PageTabSet {
  items: readonly PageTabItem[];
  label: string;
  initial: string;
  /** useSessionState key; without it the page always opens on `initial`. */
  storeKey?: string;
  urlKey?: string;
}

type StoredTabSet = PageTabSet & { storeKey: string };

export const ANALYTICS_TABS: StoredTabSet = {
  items: [
    { value: 'tien-do', label: 'Tiến độ', icon: TrendingUp },
    { value: 'thong-ke', label: 'Thống kê', icon: ChartColumn },
  ],
  label: 'Chọn khung xem',
  initial: 'tien-do',
  storeKey: 'analytics.tab',
  urlKey: 'tab',
};

export const SETTINGS_TABS: StoredTabSet = {
  items: [
    { value: 'practice', label: 'Luyện tập', icon: Dumbbell },
    { value: 'data', label: 'Dữ liệu', icon: Database },
    { value: 'account', label: 'Tài khoản', icon: UserRound },
    { value: 'guide', label: 'Hướng dẫn', icon: Compass },
  ],
  label: 'Chọn mục cài đặt',
  initial: 'practice',
  storeKey: 'settings.tab',
  urlKey: 'tab',
};

export const RESOURCE_TABS: StoredTabSet = {
  items: [
    { value: 'grammar', label: 'Ngữ pháp', icon: BookText },
    { value: 'vocab', label: 'Từ vựng', icon: Languages },
    { value: 'groups', label: 'Nhóm', icon: FolderOpen },
  ],
  label: 'Chọn kho',
  initial: 'grammar',
  storeKey: 'resources.tab',
  urlKey: 'tab',
};

export const GROUP_TABS: StoredTabSet = {
  items: [
    { value: 'list', label: 'Danh sách', icon: List },
    { value: 'flashcard', label: 'Flashcard', icon: GalleryVerticalEnd },
  ],
  label: 'Chọn khung xem',
  initial: 'list',
  storeKey: 'group.tab',
};

export const INPUT_TABS: PageTabSet = {
  items: [
    { value: 'single', label: 'Theo trường', icon: TextCursorInput },
    { value: 'paste', label: 'Dán danh sách', icon: ClipboardPaste },
    { value: 'excel', label: 'Nhập Excel', icon: FileSpreadsheet },
  ],
  label: 'Cách nhập',
  initial: 'single',
};

/** An item's tabs; the second is named by its kind, which the loading screen does not know yet. */
export function itemTabs(kind?: 'grammar' | 'vocab'): StoredTabSet {
  return {
    items: [
      { value: 'stats', label: 'Chỉ số & lịch', icon: ChartColumn },
      {
        value: 'detail',
        label:
          kind === undefined ? (
            <SkeletonText text="Thẻ chi tiết" />
          ) : kind === 'grammar' ? (
            'Thẻ chi tiết'
          ) : (
            'Chi tiết từ'
          ),
        icon: BookOpenText,
      },
    ],
    label: 'Chọn khung xem',
    initial: 'stats',
    storeKey: 'item.tab',
  };
}

/**
 * The sets by name, for a server loading.tsx: it cannot hand the icons (functions) to the client
 * skeleton, so it names the set and the skeleton looks it up.
 */
export const PAGE_TAB_SETS = {
  analytics: ANALYTICS_TABS,
  settings: SETTINGS_TABS,
  resources: RESOURCE_TABS,
  input: INPUT_TABS,
  item: itemTabs(),
  group: GROUP_TABS,
} satisfies Record<string, PageTabSet>;

export type PageTabSetName = keyof typeof PAGE_TAB_SETS;
