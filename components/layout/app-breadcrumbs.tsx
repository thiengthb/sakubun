'use client';

import {
  BookText,
  ChartColumn,
  FolderOpen,
  History,
  LayoutDashboard,
  Languages,
  Layers,
  Library,
  Pencil,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import { Breadcrumbs, type Crumb } from '@/components/layout/breadcrumbs';

const CRUMBS = {
  dashboard: {
    label: 'Phân tích',
    href: '/',
    icon: LayoutDashboard,
    description:
      'Hai tab: Tiến độ (tổng quan, tiến độ theo ngày, điểm yếu) và Thống kê (biểu đồ độ chính xác, thời gian, theo độ khó/độ dài). Luyện tập diễn ra qua MCP trong Claude Desktop hoặc ChatGPT.',
  },
  review: {
    label: 'Ôn nhanh',
    href: '/review',
    icon: Layers,
    description:
      'Thẻ ôn trên web: mục mới gặp trong một câu ví dụ, mục đã học điền vào chỗ trống. App tự chấm, không cần Claude.',
  },
  resources: {
    label: 'Tài nguyên',
    href: '/resources',
    icon: Library,
    description:
      'Kho học của bạn — ngữ pháp (được lên lịch ôn) và từ vựng (client MCP thêm qua MCP). Sửa/xóa không đổi lịch ôn.',
  },
  grammar: {
    label: 'Ngữ pháp',
    href: '/resources?tab=grammar',
    icon: BookText,
    description: 'Các mẫu ngữ pháp trong kho.',
  },
  vocab: {
    label: 'Từ vựng',
    href: '/resources?tab=vocab',
    icon: Languages,
    description: 'Các từ vựng đã lưu.',
  },
  groups: {
    label: 'Nhóm',
    href: '/resources?tab=groups',
    icon: FolderOpen,
    description:
      'Bộ sưu tập tự đặt tên — gom mẫu ngữ pháp và từ vựng theo chủ đề để luyện tập trung.',
  },
  history: {
    label: 'Lịch sử',
    href: '/history',
    icon: History,
    description:
      'Mọi lượt dịch đã chấm — bấm một thẻ để xem bài dịch, bản tham khảo, nhận xét và điểm từng mẫu.',
  },
  settings: {
    label: 'Cài đặt',
    href: '/settings',
    icon: Settings,
    description:
      'Tuỳ chỉnh nội dung, nhịp học, nghe & nói; dữ liệu; tài khoản và token MCP. Client MCP đọc các cài đặt học này mỗi khi soạn câu.',
  },
  admin: {
    label: 'Quản trị',
    href: '/admin',
    icon: Users,
    description: 'Mọi tài khoản: xem số liệu học, chặn hoặc xoá.',
  },
} satisfies Record<string, Crumb>;

const ACTION_CRUMBS = {
  add: {
    label: 'Thêm',
    icon: Plus,
    description: 'Thêm mục mới — theo trường, dán danh sách, hoặc file Excel.',
  },
  edit: {
    label: 'Sửa',
    icon: Pencil,
    description: 'Sửa nội dung mục. Lịch ôn (FSRS) được giữ nguyên.',
  },
  addItems: {
    label: 'Thêm mục',
    icon: Plus,
    description:
      'Chọn mẫu ngữ pháp / từ vựng để đưa vào nhóm. Chỉ hiện mục đúng loại và chưa ở trong nhóm.',
  },
} satisfies Record<string, Crumb>;

export type BreadcrumbSection = keyof typeof CRUMBS;
export type BreadcrumbAction = keyof typeof ACTION_CRUMBS;

const PARENT: Partial<Record<BreadcrumbSection, BreadcrumbSection>> = {
  grammar: 'resources',
  vocab: 'resources',
  groups: 'resources',
};

/** A template page's trail above its h1: parents only, the page itself is the h1. */
export function ParentCrumbs({
  section,
  self = false,
  pending = false,
  record,
}: {
  section: BreadcrumbSection;
  /** Include `section` itself: a detail or action page under it. */
  self?: boolean;
  /** A loading screen that does not know `section` yet (grammar or vocab): a bar in its place. */
  pending?: boolean;
  /** A page acting on one record (add items to a group): the record, after `section`. */
  record?: { label: string; href?: string; pending?: boolean };
}) {
  const up = PARENT[section];
  const items: Crumb[] = [
    ...(up ? [CRUMBS[up]] : []),
    ...(self ? [{ ...CRUMBS[section], pending }] : []),
    ...(record
      ? [{ ...record, icon: CRUMBS[section].icon, description: `Mở ${record.label}` }]
      : []),
  ];
  return <Breadcrumbs items={items} parentsOnly />;
}

export function AppBreadcrumbs({
  section,
  detail,
  action,
  className,
}: {
  section: BreadcrumbSection;
  detail?: { kind: 'grammar' | 'vocab' | 'groups'; label: string; description?: string };
  action?: BreadcrumbAction;
  className?: string;
}) {
  const items: Crumb[] = detail
    ? [
        CRUMBS.resources,
        CRUMBS[detail.kind],
        {
          label: detail.label,
          icon: ChartColumn,
          description: detail.description ?? `Chi tiết: ${detail.label}`,
        },
      ]
    : action
      ? [CRUMBS[section], ACTION_CRUMBS[action]]
      : [CRUMBS[section]];

  return <Breadcrumbs items={items} className={className} />;
}
