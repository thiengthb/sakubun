import { HistoryCard } from '@/components/history/history-cards';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings-schema';
import type { SentenceHistoryRow } from '@/lib/practice';

// LƯỢT VỪA CHẤM — bản ghi điểm mà APP sở hữu.
//
// Vì sao nó ở đây (2026-08-11, sau một báo lỗi lặp lại từ thời sakubun cũ): điểm của một lượt đi qua
// hai đường, và chỉ MỘT đường là tất định.
//   - Đường không tất định: `submit_review` trả về khối "Kết quả lượt này" kèm một QUY TẮC HIỂN THỊ
//     yêu cầu Claude chép nguyên văn. Server không có cách nào BẮT một client model hiển thị gì cả —
//     nên mọi bản sửa ở đường này đều là "giảm tỉ lệ hỏng", không bao giờ là "hết hỏng". Log
//     production 2026-08-11: `submit_review ms=89`, không lỗi, điểm đã ghi — mà người học không thấy
//     gì trong chat.
//   - Đường tất định: hàng trong DB. App render nó, nên app đảm bảo được.
//
// Trang Lịch sử đã hiện lượt đã chấm từ trước; cái thiếu là trang người học HẠ CÁNH VÀO không nói gì
// về lượt vừa xong. Thẻ này lấp đúng chỗ đó, và `LiveRefresh` (đã mount ở dashboard) làm nó tự hiện
// khi người học quay lại tab — không cần bấm gì.

export function LastGradedCard({
  sentence,
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
}: {
  sentence: SentenceHistoryRow;
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
}) {
  return (
    <section className="space-y-2" aria-labelledby="last-graded-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="last-graded-heading" className="font-medium">
          Lượt vừa chấm
        </h2>
        {/* Nói thành lời hợp đồng mới, vì nó là thứ khiến người học thôi phải đợi Claude: điểm nằm ở
            đây bất kể chat có hiện hay không. */}
        <p className="text-xs text-muted-foreground">
          Điểm luôn được lưu ở đây, kể cả khi Claude không hiện khối kết quả trong chat.
        </p>
      </div>
      <HistoryCard
        sentence={sentence}
        speaker={voiceSpeaker}
        rate={speechRate}
        showFurigana={furiganaInApp(furiganaMode)}
      />
    </section>
  );
}
