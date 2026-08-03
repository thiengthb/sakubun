'use client';

import {
  Bell,
  BookOpenText,
  BookText,
  ChartColumn,
  Globe,
  History,
  Layers,
  LayoutDashboard,
  Languages,
  Library,
  Settings,
  ShieldCheck,
  UserRound,
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
  notifications: {
    label: 'Thông báo',
    href: '/notifications',
    icon: Bell,
    description:
      'Mọi việc đã xảy ra khi bạn không nhìn màn hình: Claude thêm/sửa/xóa mục trong kho, bài được chấm xong, và ai đó tương tác với thứ bạn chia sẻ. Bấm một dòng là đi thẳng tới chỗ đó.',
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
    icon: Layers,
    description:
      'Gom mẫu ngữ pháp và/hoặc từ vựng thành nhóm có tên để luyện tập trung. Không ảnh hưởng lịch ôn.',
  },
  library: {
    label: 'Thư viện',
    href: '/library',
    icon: Globe,
    description:
      'Mẫu ngữ pháp và từ vựng người khác chia sẻ — lấy về kho của bạn với lịch ôn mới (không thấy lịch ôn của họ, họ không thấy của bạn).',
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
      'Tuỳ chỉnh nội dung, nhịp học, nghe & nói. Claude đọc các cài đặt này qua MCP mỗi khi soạn câu.',
  },
  guide: {
    label: 'Hướng dẫn',
    href: '/guide',
    icon: BookOpenText,
    description: 'Cách dùng app + kết nối Claude Desktop (MCP).',
  },
  account: {
    label: 'Tài khoản',
    href: '/account',
    icon: UserRound,
    description: 'Thông tin đăng nhập và token MCP để kết nối Claude Desktop dưới danh nghĩa bạn.',
  },
  admin: {
    label: 'Quản trị',
    href: '/admin',
    icon: ShieldCheck,
    description:
      'Quản lý người dùng (chỉ quản trị viên). Khoá một thành viên là ngắt NGAY cả web lẫn MCP (token trả 401); có thể bỏ khoá sau.',
  },
} satisfies Record<string, Crumb>;

export type BreadcrumbSection = keyof typeof CRUMBS;

/**
 * Renders the breadcrumb trail for a page. Simple pages pass a `section`; the resource-item detail
 * page passes `detail` (its kind + name) to get the full Tài nguyên → Ngữ pháp/Từ vựng → <item> chain.
 */
export function AppBreadcrumbs({
  section,
  detail,
  className,
}: {
  section: BreadcrumbSection;
  detail?: { kind: 'grammar' | 'vocab' | 'groups'; label: string; description?: string };
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
    : [CRUMBS[section]];

  return <Breadcrumbs items={items} className={className} />;
}
