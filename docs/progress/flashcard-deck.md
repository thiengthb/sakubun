# flashcard-deck — chồng thẻ lướt kiểu Quizlet, dùng chung cho nhóm và lịch sử

owner: @thi3n · branch: main · worktree: repo chính · platforms trong scope: web (desktop + mobile web)

<!-- APPEND-ONLY. Xem docs/progress/_TEMPLATE.md. -->

## 2026-08-06 21:35 (session 1, Claude)

- **ĐÃ LÀM**
  - `components/shared/card-deck.tsx` (mới) — `useCardDeck()` + `<CardDeck>` + `<DeckShortcutsInfo>` +
    `shuffled()`. Deck sở hữu: vị trí, lật, cử chỉ vuốt, bàn phím, thanh tiến độ, hai mũi tên, màn hết
    thẻ. KHÔNG sở hữu nội dung thẻ (caller truyền `front`/`back`/`corner`/`toolbar`).
    State nằm ở HOOK phía caller, không nằm trong component: caller cần đọc vị trí (thẻ nào tự đọc,
    ở mặt nào) và cần reset nó (trộn, học lại). Nếu component tự giữ index thì mỗi lần reset phải
    remount, mà remount thì popover cài đặt của caller bị đóng giữa lúc đang bấm.
  - `components/groups/group-flashcards.tsx` — viết lại trên `<CardDeck>`. **Bỏ** hai nút
    “Đã thuộc”/“Đang học”, dòng tip dưới thẻ, nút “Quay lại thẻ trước”, và toàn bộ cơ chế
    localStorage `sakubun.flashcard-known.<groupId>` cùng vòng “ôn tiếp N thẻ đang học”.
    Giữ nguyên: chiều thẻ, trộn, tự đọc, dialog xem kĩ, và LUẬT tự đọc theo chiều (ja→vi đọc mặt
    trước; vi→ja đọc mẫu ở đáp án sau khi lật; ví dụ không bao giờ tự đọc).
  - `components/history/history-flashcards.tsx` (mới) — /history ở dạng deck. Mặt trước là ĐỀ, mặt sau
    là tham khảo + bài mình dịch + nhận xét + chip ngữ pháp/từ vựng. Dòng PENDING không thành thẻ.
    Có sao (StarButton) ở góc thẻ. Deck lấy từ `filtered`, tức là bộ lọc + ô tìm phía trên VẪN chạy
    trong lúc lướt — đó là lý do nút chuyển chế độ nằm trong toolbar chứ không lên header trang.
  - `components/history/history-filters.tsx` + `history-list.tsx` — nút chuyển Danh sách ↔ Flashcard
    (`ExpandingIconButton`, đặt tên theo hành động của lần bấm tới), state `history.mode` đồng bộ URL
    (`?view=card`). Nút đổi mật độ cột bị ẩn trong chế độ thẻ (một thẻ thì không có cột).
  - `app/history/loading.tsx` — `filters={3}` cho đúng số nút toolbar mới (luật
    `skeleton-mirrors-its-page`).
  - `e2e/flashcards.spec.ts` (mới, 3 test) — xem mục QUYẾT ĐỊNH bên dưới.
  - `e2e/groups.spec.ts` — test tự-đọc-theo-chiều giờ đẩy deck bằng “Thẻ sau” thay vì “Đã thuộc”.
  - `docs/ui-patterns.json` — chốt luật `deck-moves-by-swipe`.
  - `lib/type-scale.test.ts` — cho `history-flashcards.tsx` vào `DISPLAY_ALLOW` (mặt thẻ là
    data-display, cùng lý lẽ với deck của nhóm).

- **BẰNG CHỨNG**
  - `npx playwright test` → **22 passed** (3.7m), gồm 3 test mới và test flashcard cũ của
    `e2e/groups.spec.ts`.
  - `npm run verify` → 51 file test, **671 test passed**, build production sạch.
  - `node tooling/gates.mjs --stage stop` → gen-clean OK · typecheck OK · test OK.
  - Ảnh 390×844 và 1440×900 của cả hai deck (mặt trước + mặt sau) đã xem tay trong session này.

- **QUYẾT ĐỊNH đã chốt**
  - **Cử chỉ là động từ duy nhất trên deck.** Vuốt ngưỡng 56px + vận tốc × 0.15 (một cú flick nhanh
    ăn ngưỡng, một cú kéo chậm nửa đường thì bật lại — kéo chậm nghĩa là đang ĐỌC, không phải đang
    vuốt). Bấm/Space lật; ← → và Backspace chuyển. Hướng dẫn nằm trong tooltip góc thẻ.
  - **`done` là cờ RIÊNG, không phải `index === count`.** Bug do chính test bắt: đang ở thẻ 2/2 mà thu
    hẹp ô tìm xuống còn 1 dòng thì cách mã hoá cũ đọc thành “đã lướt quá thẻ cuối”, nên người học bị
    nhảy sang màn kết thúc thay vì sang đúng thẻ vừa tìm. Hết thẻ vì ĐI TỚI và bị đưa cho ÍT THẺ HƠN
    là hai sự kiện khác nhau; chỉ sự kiện đầu mới kết thúc deck.
  - **Không còn khái niệm “thuộc” của riêng flashcard.** Cái đo mức thuộc là FSRS, và mọi lượt chấm
    của Claude đã nuôi nó. Một tập `known` trong localStorage là nguồn thứ hai, chỉ sống trong một
    trình duyệt, không ai đối chiếu. Hệ quả phải nói rõ: **tiến độ “đã thuộc” cũ trong localStorage
    không còn được đọc**. Nó vẫn nằm đó (không xoá) nhưng không hiển thị ở đâu nữa.
  - **Thẻ có bề rộng tối đa (`max-w-4xl`) và căn giữa.** Trước đây deck full-bleed; đo trên 1440px thì
    đó là một tấm 1160px với một từ trôi ở giữa, mắt phải đi tìm chính thứ đang tự kiểm tra. Điện
    thoại nằm dưới ngưỡng nên không đổi gì.
  - **Deck của /history dùng `min-h-[calc(100svh-10rem)]`, không phải mặc định `6rem`.** /history còn
    một hàng toolbar phía trên mà tab flashcard của nhóm không có; ở mặc định, hai mũi tên rơi ~15px
    dưới fold tại 1280×720 và trang mọc scrollbar để với tới chúng. Đã có test đo mốc này ở 390px.

- **TIẾP THEO** (chưa làm, không chặn)
  - Chưa có entry `features/*.json` cho việc này — chỉ DRI được sửa `features/_index.json`.
  - Deck của /history chưa có đường mở dialog chi tiết đầy đủ như thẻ của nhóm (`ItemDetailDialog`).
    Hiện muốn xem full thì bấm “Danh sách” rồi bấm vào thẻ. Nếu thấy thiếu thì thêm một nút góc nữa.
  - Cả hai mặt thẻ đều nằm trong DOM (đặc tính của flip CSS 3D, `backface-visibility` che chứ không
    unmount). Nghĩa là đáp án ẩn về mặt thị giác, không ẩn về mặt DOM — đã đúng như vậy từ trước, và
    test khẳng định “thẻ mới úp mặt” qua tên của control lật chứ không qua độ hiển thị của đáp án.

- **ĐANG VƯỚNG**
  - Không có. Một lần chạy `npx playwright test` in ra cảnh báo “Hydration failed” trong log của
    webServer nhưng không lặp lại ở lần chạy thứ hai và mọi test đều xanh cả hai lần — chưa quy được
    cho thay đổi nào, ghi lại để nếu nó xuất hiện lại thì đã có mốc.
