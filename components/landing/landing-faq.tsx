'use client';

import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Reveal } from '@/components/shared/motion-primitives';

/**
 * Landing FAQ — the objections a visitor actually has before creating an account, answered honestly. Split
 * out of `landing-page.tsx` to keep that file readable (the plan's ~500-line threshold).
 *
 * Rule for every answer here: only claims we can back up. Where the truth is "no" (offline, mobile app) it
 * says no — an over-promise costs more than a lost signup, and this page is the first thing a stranger
 * reads about the app.
 */
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'Có bắt buộc phải dùng Claude Desktop không?',
    a: (
      <>
        Có. Claude là <b>người ra đề và chấm bài</b>; sakubun giữ kho học, lịch ôn FSRS và cài đặt.
        Không nối Claude thì bạn vẫn xem/nhập được kho, nhưng <b>không luyện được</b>.
      </>
    ),
  },
  {
    q: 'Có mất phí không?',
    a: (
      <>
        sakubun <b>miễn phí</b> — nó chạy trên máy chủ riêng của người dựng. Phần chi phí (nếu có)
        là ở <b>gói Claude</b> bạn đang dùng, sakubun không thu gì và không có bản trả tiền.
      </>
    ),
  },
  {
    q: 'MCP là gì? Nối có phức tạp không?',
    a: (
      <>
        MCP là chuẩn mở để Claude nói chuyện với ứng dụng ngoài. Việc bạn làm: vào trang{' '}
        <i>Tài khoản</i> tạo <b>token cá nhân</b>, dán một đoạn cấu hình có token đó vào Claude
        Desktop, khởi động lại. Khoảng 5 phút, làm một lần cho mỗi máy — hướng dẫn từng bước có ngay
        trong app.
      </>
    ),
  },
  {
    q: 'Dữ liệu của tôi nằm ở đâu?',
    a: (
      <>
        Trong cơ sở dữ liệu của máy chủ này, <b>tách riêng theo tài khoản</b> — không gửi đi đâu
        khác. Bạn <b>xuất toàn bộ ra JSON</b> bất cứ lúc nào (kho + lịch ôn + lịch sử) để sao lưu
        hay chuyển máy, và nhập gộp lại được. Lịch sử câu đã dịch không bị app tự xoá.
      </>
    ),
  },
  {
    q: 'Khác Anki chỗ nào?',
    a: (
      <>
        Anki hỏi “bạn còn nhớ không” rồi bạn tự đánh giá. sakubun buộc bạn <b>sản xuất</b> — dịch
        hoặc tự đặt câu — và có người <b>chấm từng mẫu</b>, chỉ lỗi, cho bản tham khảo. Lịch ôn vẫn
        là FSRS (thuật toán Anki dùng), và từ vựng thì <b>xuất được sang Anki</b> nếu bạn muốn ôn ở
        đó.
      </>
    ),
  },
  {
    q: 'Học được trình độ nào?',
    a: (
      <>
        N5 đến N1. Kho là <b>của bạn</b>: tự nhập (gõ tay, dán danh sách, hoặc file Excel từ Mazii),
        nhờ Claude nhập, hoặc <b>lấy về</b> từ thư viện chung do thành viên khác chia sẻ.
      </>
    ),
  },
  {
    q: 'Có app điện thoại không?',
    a: (
      <>
        Chưa. Web dùng được trên điện thoại (xem kho, tiến độ, lịch sử), nhưng <b>luyện</b> thì cần
        Claude Desktop trên máy tính.
      </>
    ),
  },
  {
    q: 'Dùng offline được không?',
    a: <>Không — cần mạng để tới sakubun và tới Claude.</>,
  },
];

export function LandingFaq({ container }: { container: string }) {
  return (
    <section className="py-14 sm:py-16">
      <div className={container}>
        <Reveal className="max-w-2xl">
          <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
            Câu hỏi thường gặp
          </div>
          <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Những thứ nên biết trước khi tạo tài khoản
          </h2>
        </Reveal>

        <Reveal className="mt-8">
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className="text-left font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
