'use client';

import {
  BookOpenText,
  BookText,
  ChartColumn,
  FolderOpen,
  History,
  LayoutDashboard,
  Languages,
  Library,
  Pencil,
  Plus,
  Settings,
} from 'lucide-react';
import { Breadcrumbs, type Crumb } from '@/components/shell/breadcrumbs';

// The app's route map as breadcrumb metadata — one entry per section, each with a label + href + icon
// + description. Kept here (a client module) so the icon COMPONENTS never cross the server→client
// boundary as props (which Next forbids): server pages pass only a string `section`. Trails mirror the
// real route hierarchy — top-level sections are roots; a resource item's detail page nests under
// Tài nguyên → Ngữ pháp/Từ vựng → <item> (the parent chain the user asked for).
const CRUMBS = {
  dashboard: {
    label: 'Phân tích',
    href: '/',
    icon: LayoutDashboard,
    description:
      'Hai tab: Tiến độ (tổng quan, tiến độ theo ngày, điểm yếu) và Thống kê (biểu đồ độ chính xác, thời gian, theo độ khó/độ dài). Luyện tập diễn ra trong Claude Desktop.',
  },
  resources: {
    label: 'Tài nguyên',
    href: '/resources',
    icon: Library,
    description:
      'Kho học của bạn — ngữ pháp (được lên lịch ôn) và từ vựng (Claude thêm qua MCP). Sửa/xóa không đổi lịch ôn.',
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
    description: 'Bộ sưu tập tự đặt tên — gom mẫu ngữ pháp và từ vựng theo chủ đề để luyện tập trung.',
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
      'Tuỳ chỉnh nội dung, nhịp học, nghe & nói; dữ liệu; tài khoản và token MCP. Claude đọc các cài đặt học này qua MCP mỗi khi soạn câu.',
  },
  guide: {
    label: 'Hướng dẫn',
    href: '/guide',
    icon: BookOpenText,
    description: 'Cách dùng app + kết nối Claude Desktop (MCP).',
  },
} satisfies Record<string, Crumb>;

// The two ACTION pages under a resource store: /resources/new and /resources/<id>/edit. They are not
// sections (no href of their own to link back to) — they are the last crumb of a two-step trail,
// "Ngữ pháp › Thêm" / "Từ vựng › Sửa", which is what those pages read as. Kept next to CRUMBS so the
// icon components stay on this side of the server→client boundary: a page passes the STRING 'add'.
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
  // Distinct from `add` on purpose: under Nhóm, "Thêm" would be ambiguous between *creating a group* and
  // *putting items into one*, and both are now real routes (/groups/new · /groups/<id>/add).
  addItems: {
    label: 'Thêm mục',
    icon: Plus,
    description: 'Chọn mẫu ngữ pháp / từ vựng để đưa vào nhóm. Chỉ hiện mục đúng loại và chưa ở trong nhóm.',
  },
} satisfies Record<string, Crumb>;

export type BreadcrumbSection = keyof typeof CRUMBS;
export type BreadcrumbAction = keyof typeof ACTION_CRUMBS;

/**
 * Renders the breadcrumb trail for a page. Simple pages pass a `section`; the resource-item detail
 * page passes `detail` (its kind + name) to get the full Tài nguyên → Ngữ pháp/Từ vựng → <item> chain.
 */
export function AppBreadcrumbs({
  section,
  detail,
  action,
  className,
}: {
  section: BreadcrumbSection;
  // The middle crumb of a detail trail: Tài nguyên → <this> → <the thing's name>. 'groups' joined the
  // set when study groups came back (2026-08-05) — a group's detail page nests under the same
  // /resources parent as an item's does.
  detail?: { kind: 'grammar' | 'vocab' | 'groups'; label: string; description?: string };
  /** Two-crumb ACTION trail under a section: "Ngữ pháp › Thêm" / "Từ vựng › Sửa". Ignored with `detail`. */
  action?: BreadcrumbAction;
  className?: string;
}) {
  const items: Crumb[] = detail
    ? [
        CRUMBS.resources,
        CRUMBS[detail.kind],
        {
          // RULE (breadcrumb): a detail page's last crumb is the NAME of the data it shows (not a
          // generic "Chi tiết") — breadcrumbs replace page titles (layout std invariant #8), so the
          // entity's name must live here. The hovered description adds context. See CLAUDE.md.
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
