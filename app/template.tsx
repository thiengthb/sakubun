/**
 * CHUYỂN TRANG — cái duy nhất file này làm là cho nội dung trang mới fade vào.
 *
 * Vì sao là `template.tsx` chứ không phải `layout.tsx`: Next dựng LẠI template ở mỗi lần đổi route
 * (layout thì giữ nguyên), nên class animation chạy lại mỗi lần điều hướng — đúng thứ cần. Đặt nó ở đây
 * cũng là lý do vỏ ứng dụng không nhấp nháy theo: `AppShell` nằm trong `layout.tsx`, nên sidebar,
 * breadcrumb và nút "lên đầu trang" đứng yên trong khi phần trang đổi.
 *
 * Hiệu ứng và LÝ DO nó chỉ có opacity (một transform ở đây sẽ làm lệch mọi `position: fixed` bên trong
 * trang) nằm cùng chỗ với keyframe, ở `app/globals.css` — tìm `page-fade-in`.
 *
 * Không thêm div nào có style bố cục: phần tử này phải trong suốt với layout, nếu không mọi trang sẽ
 * phải biết đến nó. `contents` không dùng được vì animation cần một hộp thật, nên nó là một div trần.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
