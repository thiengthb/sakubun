import type { ReactNode } from 'react';

/**
 * THE five steps of one practice turn — the app's core loop, told in two places (`/guide` "Tính năng" ->
 * Luyện dịch -> the click-through walkthrough, and the public landing's "Cách hoạt động"). This module is
 * the SINGLE source for their titles + the landing's copy: before it existed both surfaces hard-coded the
 * same five titles, which is exactly how a renamed step goes out of sync with the page selling it.
 *
 * The guide keeps its own richer body + illustration per step (it teaches with mockups); it takes only the
 * TITLE from here. `lib/loop-steps.test.ts` fails if the two title lists ever diverge.
 */
export interface LoopStep {
  title: string;
  /** The landing's short explanation of the step (the guide writes its own, longer one). */
  landingBody: ReactNode;
}

export const LOOP_STEPS: LoopStep[] = [
  {
    title: 'FSRS chọn bài đến hạn',
    landingBody: (
      <>
        Server chọn theo lịch FSRS: mục <i>đến hạn</i> trước, rồi mục <i>mới</i> trong hạn mức ngày.
        Từ vựng chạy trên ngân sách riêng, không lấn ngữ pháp.
      </>
    ),
  },
  {
    title: 'Claude dệt vào MỘT câu',
    landingBody:
      'Claude gộp cả lô mẫu vào một câu tự nhiên theo cài đặt của bạn — ưu tiên chạm đúng loại lỗi bạn hay mắc gần đây.',
  },
  {
    title: 'Bạn dịch',
    landingBody:
      'Gõ hoặc nói qua voice mode bản dịch của bạn. Sai cũng không sao — đó là dữ liệu để xếp lịch ôn.',
  },
  {
    title: 'Chấm 3 tầng',
    landingBody: (
      <>
        Claude chấm <b>nghĩa</b> · <b>từng mục ngữ pháp</b> · <b>độ tự nhiên</b>; chỗ sai được sửa
        thẳng kèm một dòng quy tắc.
      </>
    ),
  },
  {
    title: '4 tín hiệu → xếp lịch lại',
    landingBody: (
      <>
        Mỗi mục nhận một tín hiệu (như Anki) quyết định lần ôn kế tiếp. Hết bài trong ngày → chuyển
        sang <span lang="ja">luyện thành thạo</span> thay vì dừng.
      </>
    ),
  },
];
