# Tóm tắt Sakubun ở nick này (để so với nick khác)

Viết ngày 13/11/2026, khoảng 22:30 giờ VN, bởi Claude trong project "Sakubun" của nick này (mã project `chan_016zen…`).
Số liệu lấy bằng công cụ lúc viết (GitHub, danh sách thread, thư mục memory, project files), không lấy theo trí nhớ.
Chưa có kế hoạch đồng bộ ở đây, chỉ có hiện trạng và các chỗ lệch.

**Để so cho dễ:** nhờ nick kia viết bản của họ theo đúng 7 mục dưới đây (A đến G), cùng tên mục.
File này nằm trong repo (`docs/sync/`) để nick khác đọc được.

---

## A. Nick này là ai trên GitHub

- Project trên claude.ai: `chan_016zenSjE5qYf4L34naX5wMF`. Nick kia ký PR bằng project `chan_0145cotX9neLQKZjxfBxCwDe`.
  Có thêm một project thứ ba (`chan_01P8HU…`) từng mở PR #268 (bản nháp kế hoạch UI v2, 08/11).
- Cả hai nick đều mở PR bằng cùng tài khoản GitHub `thiengthb`, nên trên GitHub chỉ phân biệt được qua dòng
  "project thread" ở đầu mô tả PR.
- Nhánh: thread của nick này bị harness bắt dùng tên `claude/project-thread-xxxx`; nick kia đặt theo bước
  (`feat/u2a-session-header`, `docs/u2-plan`) đúng như `CLAUDE.md` của sakubun.

## B. Các thread trong project này (28 thread)

**Còn mở (3)**

| Thread | Trạng thái | Kết quả |
|---|---|---|
| Tóm tắt thread và repo để đồng bộ lại | đang làm | file này |
| Làm lại UI/UX v2 | hiện "lỗi" | Không phải lỗi thật: hết usage ngày 09/11 lúc 11:42 UTC, sau khi đã mở #284 và cất bước `/progress` thành patch. Nick kia làm tiếp (#285–#287). Thread này giờ đã cũ, không còn việc. |
| Review kanji and UI v2 PRs | xong, chưa đóng | Review chéo cho các PR kanji và UI v2, 08–09/11. Không còn việc. |

**Đã đóng (25)**, theo nhóm:

| Nhóm | Thread | Kết quả chính |
|---|---|---|
| Nền tảng (23–24/10) | Tìm hiểu và tái cấu trúc Sakubun; Review lõi FSRS #77; Review OAuth cho MCP; Review Hán Việt; Review thienui theme #107; Review bỏ tutor profile; Hermes Study chuyển sang MCP v2 | Viết lại lõi, FSRS, MCP v2, OAuth. Hermes Study về sau bỏ. |
| UI lần 1 (24–25/10) | thread "Làm lại UI/UX" (memory có nhắc, nhưng không còn trong danh sách thread); Review Phân tích #129 | Khoảng 45 trang duyệt ảnh, luật UI r6–r13 nằm trong memory |
| Kaiwa (24/10–07/11) | Làm tiếp phần Kaiwa còn lại; Review K6a, K6b, K6c, K8b; Sửa test e2e giọng từng vai | Kaiwa K6–K9, (a)–(d) xong |
| Gom việc dở (07–08/11) | Gom và hoàn thiện việc dang dở Sakubun; Review #240–#242, #244, #245, #247, #249, #255, #257, #258, #259 | Sửa e2e đỏ, xoá 109 nhánh, luyện dịch R1–R4, kanji KJ1–KJ7 |
| Bàn giao (13/11) | Bàn giao công việc Sakubun cho tài khoản khác | PR #290 (`docs/handoff.md`), bản sao `BAN-GIAO.md` |

## C. Repo

### sakubun (`thiengthb/sakubun`, repo công khai)

- **main** ở `730c125` (merge #290, 13/11 18:50 giờ VN). CI chỉ chạy `npm run verify` và docker build; e2e không chạy trong CI.
- **Ai làm gì gần đây**

| PR | Nick | Việc | Trạng thái |
|---|---|---|---|
| #269–#283 | nick này | Duyệt kế hoạch UI v2, U0, chuyển Base UI, sidebar | đã merge 08–09/11 |
| #284 | nick này | Thanh 5 tab trên điện thoại | merge 09/11 (bởi nick kia, sau khi nick này hết usage) |
| #285, #286, #287 | nick kia | `/progress`, link cổng U1, Cài đặt tự lưu và điều hướng điện thoại | đã merge 09–13/11 |
| #288 | nick kia | U1 Done, kế hoạch U2 (3 câu "Cần bạn chọn") | **mở**, CI xanh, chờ bạn đọc trước khi merge |
| #289 | nick kia | Đóng câu hỏi nghiên cứu, mục 6b danh sách việc sau UI v2 | **mở**, CI xanh, risk:low |
| #290 | nick này | `docs/handoff.md` cho nick khác | đã merge 13/11 |
| #291 → #292 → #293 → #294 | nick kia | U2a–U2d (phiên học), xếp chồng lên nhau | **mở**, CI chưa có kết quả, chờ bạn duyệt ảnh |

- **6 PR đang mở**, cả 6 do nick kia mở hôm nay.
- **`docs/STATUS.md` trên main** cập nhật lần cuối 10/11 bởi nick kia. Vẫn ghi "U1 còn lại: chờ thien duyệt", chưa nhắc U2
  vì phần nhận U2 nằm trong #288 chưa merge. 39 dòng, qua được `check-status.mjs`.
- **Roadmap**: U0 Done, U1 "In progress", U2–U8 "Not started" (sẽ đổi khi #288 merge).
- **Nhánh trên GitHub (21)**: `main`, 6 nhánh của PR đang mở, và 14 nhánh của PR đã merge hoặc đã đóng nhưng chưa xoá:
  `claude/project-thread-2ogyjr`, `-6inpk6`, `-jh6qvf`, `-wos43t` (nick này); `feat/u1-progress`, `feat/u1-settings-autosave`,
  `docs/u1-gate-link` (nick kia); `docs/ui-v2-plan`; `data/kanji-meanings-2` đến `-6` (Codex); `feat/multiuser-community` (cố ý giữ).

### thienui (`thiengthb/thienui`)

- main ở `ad19e36` (#6, 07/11, gu cả màn hình). 6 PR, tất cả đã merge, không có PR mở. Không đổi gì từ 07/11.
- Có `AGENTS.md` riêng (không theo mẫu chung, không có mốc "Phần riêng của project"); không có `docs/STATUS.md`.
- 3 nhánh cũ chưa xoá: `claude/project-thread-5kvuk6`, `-dpabr3`, `claude/whole-screen-taste`.

### thienai-workflow (chỉ đọc, để so)

- main ở `f391930` (#45, 13/11). 2 PR mở (#42 TikTok, #44 bài chiến tranh 4), không liên quan sakubun.
- `life/tracked-repos.md` ghi sakubun đã áp quy trình chung từ 05/11.

## D. Memory của project này

33 file trong memory chung của project. Nick kia không đọc được.

| Nhóm | File | Còn đúng không |
|---|---|---|
| Luật UI bạn nói qua từng vòng duyệt | `ui-design-rules`, `ui-taste`, `ui-step4`, `ui-step6`, `ui-thien-rules-r6` đến `r13`, `ui-review-page`, `ui-review-scenarios`, `web-only` | Phần lớn đã chép vào `docs/handoff.md` mục 3 (#290) |
| Tiến độ theo đợt | `rewrite-progress`, `after-ui-redo`, `consolidation-2026-11-07`, `kanji-progress`, `ui-v2`, `ui-v2-u1`, `handoff-2026-11-13` | Các ghi chú về #284, patch `/progress`, nhánh kj2, trang duyệt `TedjKZ…` đã **cũ** (xong cả) |
| Câu trả lời của bạn | `thien-answers-2026-11-07`, `-2026-11-08`, `oauth-plan`, `multiuser-ui-plan` | Đã thành code hoặc kế hoạch trong repo [Chưa kiểm từng ý] |
| Cách làm việc | `working-agreement`, `pr-review-notes`, `core-overview`, `hermes-study-deploy` | Luật đã có trong `CLAUDE.md`; `pr-review-notes` dài 17 KB, chỉ 4 KB đầu được đọc lại |

Mục lục `MEMORY.md` còn trỏ tới trạng thái cũ (dòng "U1 handover ... #284 in review"), và 6 file không có trong mục lục.
Memory **không ghi** bạn đã chọn "Quy trình chung: Có/Không" cho project này.

## E. Project files (khoảng 87 MB, nick kia không thấy)

- `ui-redo/` 62 MB và nhiều thư mục ảnh trước/sau (`14px-content/`, `17px-cleanup/`, `dashboard-less-text/`…): ảnh duyệt UI lần 1, tháng 10.
- `sakubun/` 19 MB: ảnh trước/sau từng tính năng (kanji, kaiwa, furigana…), `BAN-GIAO.md` (bản sao `docs/handoff.md`),
  `branch-cleanup/` (danh sách 109 nhánh đã xoá), `kanji/` (brief dữ liệu cho Codex).
- `sakubun/pending-patches/`: 22 patch (u1, kj1–kj7, r1–r4, kaiwa-c, kaiwa-d). **Tất cả đã thành PR và merge**; để đó chỉ gây nhầm.

## F. Artifact (hơn 50, nick kia không thấy)

- Khoảng 40 trang duyệt ảnh UI lần 1 (24–25/10): Phân tích, Nhóm, Lịch sử, Thêm/Sửa, Ôn nhanh, Đăng nhập… các vòng 1–4.
- Kế hoạch đã duyệt: dữ liệu theo từng người (7.1), Kaiwa K7/K8, luyện dịch, kanji (`7SCj6…`), nghiên cứu Kho D6 (`7NqgF…`).
- Trang duyệt UI v2: giai đoạn 0 (`P2HvQ…`) và giai đoạn 1 cũ (`TedjK…`, đã được thay).
- Trang duyệt cổng U1 mới (`9Hd8p…`) và 4 trang duyệt U2a–U2d **nằm ở nick kia**, không có trong project này.
- Trang tiến độ của quy trình chung (trang sakubun và trang tổng quan `SZGp8…`) không có ở đây; dòng đầu STATUS cũng không có link.

## G. Các chỗ lệch so với quy trình thienai-workflow

1. **sakubun chưa áp đủ quy trình chung dù đã có tên trong `tracked-repos.md`.** Không có `AGENTS.md`, `CLAUDE.md` chưa có dòng
   `@AGENTS.md`, không có `scripts/check-status.mjs` và CI không kiểm STATUS. Codex chỉ tự đọc `AGENTS.md`, nên vào sakubun
   nó không thấy luật nào. [Fact, đã kiểm main]
2. **STATUS khác mẫu và đang cũ.** Không có link trang tiến độ ở dòng đầu, không có bảng "Kế hoạch đang chạy" và "Việc dở"
   kèm nhánh/PR. Ai đang giữ U2 chỉ thấy trong #288 chưa merge, nên ai đọc main cũng thấy "U1 chờ duyệt". [Fact]
3. **Kế hoạch không theo mẫu PLAN.** `docs/plans/2026-11-08-ui-v2.md` không có checkpoint tick và mục "Đang ở đâu", nên không
   biết đang tới đâu nếu không đọc PR. [Fact]
4. **Nhiều thứ quan trọng chỉ sống ở nick này**: 33 file memory, hơn 50 artifact, 87 MB project files. Quy trình nói repo là
   nguồn sự thật duy nhất. `docs/handoff.md` (#290) đã gom phần luật UI, nhưng là một file thứ hai ngoài mẫu. [Fact]
5. **Hai nick làm song song mà không có chỗ "nhận việc".** Bản bàn giao #290 viết khi nick kia đã nhận U2 (#288), nên một phần
   của nó đã cũ ngay lúc merge. [Fact]
6. **Quá 3 việc chờ bạn.** 6 PR mở chờ bạn đọc hoặc duyệt ảnh (#288 có 3 câu hỏi, #291–#294 chờ ảnh), cộng 2 việc cũ trong
   STATUS (bấm Hiện "N5 · Ngữ pháp", thử chia sẻ kịch bản). [Fact]
7. **Review chéo risk:medium khó làm khi hai nick tách nhau**: phiên review phải đọc được ngữ cảnh mà chỉ nick mở PR có. [Suy luận]
8. **Bước "dán hướng dẫn project" có vẻ chưa làm**: project này không có dòng "Project này theo quy trình thienai-workflow…"
   trong hướng dẫn project, và memory không ghi bạn đã chọn áp quy trình. [Suy luận từ những gì phiên này nhận được]
9. **Rác dễ gây nhầm**: 22 patch đã merge trong `pending-patches/`, 14 nhánh đã merge chưa xoá ở sakubun và 3 ở thienui, thread
   "Làm lại UI/UX v2" hiện "lỗi" dù việc đã xong. [Fact]
10. **thienui không theo quy trình chung** (không STATUS, không có trong `tracked-repos.md`). Có thể là cố ý vì nó là thư viện. [Fact; ý định chưa rõ]
