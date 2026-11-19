# KD · Tìm bằng vẽ kanji

Trạng thái: đang chạy · Duyệt: 2026-11-19 · Cập nhật: 2026-11-19 · Thread: "Đồng bộ Sakubun giữa các nick" (nick tnt628)

Luật ghi file này ở `profile/PLANNING.md` của repo thienai-workflow. Tick khi có bằng chứng; đổi bước thì ghi vào "Đã đổi";
lỗi thì ghi vào "Lỗi gặp".

## Đang ở đâu

- Đang ở: KD1 (máy đoán chữ) xong ở PR #340, chờ merge. Tiếp KD2 (khung vẽ, chọn bố cục trước).
- Còn thiếu: KD2, KD3.
- thien cần làm: không có (ở KD2: vẽ thử khoảng 20 chữ).

## Mục tiêu

Không biết đọc một chữ kanji thì vẽ nó vào một khung cạnh ô tìm ở Kho; máy đưa ra vài chữ giống nhất, bấm một chữ là nó
vào ô tìm và kết quả hiện như khi gõ (thien xin ngày 19/11, lúc duyệt U4f: "giống mazii").

## Không làm

- Nhận dạng cả câu hay nhiều chữ viết liền: mỗi lần vẽ một chữ, bấm chữ đoán được là thêm vào ô, vẽ tiếp chữ sau.
- Chấm chữ đẹp hay đúng thứ tự nét: đó là việc của khung viết KJ4, ở đây chỉ cần đoán ra chữ.
- Kana: gõ được bằng bàn phím, không cần vẽ.

## Cách nhận dạng (thien chọn)

Kết quả (19/11): thien chọn **A · Tự nhận dạng bằng nét KanjiVG đã có**, trùng đề xuất (bản ghi
`decisions/sakubun-kd-recognizer` trên trang https://claude.ai/artifact/MVyZQjxQ14eZCYgf6eF4MC, mở ở nick tnt628; dựng
lại: `make-decision.mjs docs/plans/2026-11-19-kanji-draw-search/decision.json <out>`).

Khác khung viết KJ4: KJ4 biết trước chữ cần viết và so từng nét với chữ đó; ở đây máy không biết chữ nào, phải so với
cả 2.136 chữ Jōyō rồi xếp hạng.

| Cách                                    | Làm gì                                                                                                            | Mạnh nhất                                                                                    | Lý do mạnh nhất để không chọn                                                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · Tự nhận dạng bằng nét KanjiVG đã có | Server so nét vẽ với nét của 2.136 chữ trong `data/kanji/strokes.json` (KJ1), cho phép lệch 1–2 nét và sai thứ tự | Không thêm dữ liệu, thư viện hay dịch vụ ngoài; mọi chữ đoán ra đều có trang kanji trong app | Viết quá ẩu hay sai nhiều nét thì đoán kém hơn dịch vụ lớn; chỉ có chữ Jōyō                                                                                                       |
| B · Thư viện mở KanjiCanvas             | Chạy trong trình duyệt, giấy phép MIT, tự nói không phụ thuộc thứ tự và số nét                                    | Đã có người làm và dùng, không phải tự chỉnh thuật toán                                      | Bộ chữ và dữ liệu mẫu riêng, không khớp với dữ liệu kanji của app; thư viện viết kiểu gắn vào một canvas theo id, khó ghép vào React; cỡ tải và giấy phép dữ liệu mẫu [Chưa kiểm] |
| C · Gửi nét vẽ cho Google               | Dùng dịch vụ nhận dạng chữ viết tay của Google Input Tools (có tiếng Nhật)                                        | Chịu được chữ viết ẩu nhất, có cả chữ ngoài Jōyō                                             | Không có API công khai cho web app [Chưa kiểm], có thể bị chặn bất cứ lúc nào; nét vẽ của người học đi ra ngoài app                                                               |

Thử nhanh cách A trên máy (19/11, `2026-11-19-kanji-draw-search/prototype.ts.txt`): lấy nét KanjiVG của 400 chữ ngẫu
nhiên, làm méo như người vẽ tay (co giãn, xoay, lệch từng nét, rung), rồi tìm lại trong 2.136 chữ. [Fact] trên dữ liệu
giả lập này:

| Độ ẩu                 | Đúng ở vị trí 1 | Nằm trong 5 chữ đầu | Nằm trong 10 chữ đầu |
| --------------------- | --------------- | ------------------- | -------------------- |
| Nhẹ                   | 100%            | 100%                | 100%                 |
| Vừa                   | 85%             | 98%                 | 99%                  |
| Nặng                  | 55%             | 80%                 | 87%                  |
| Vừa, đảo thứ tự 2 nét | 71%             | 92%                 | 95%                  |

Khoảng 30 ms cho một lần đoán trên server. [Suy luận] Chữ viết tay thật khác dữ liệu giả lập, nên con số thật sẽ thấp hơn;
KD1 phải thử bằng nét vẽ thật (thien vẽ khoảng 20 chữ) trước khi coi là xong.

## Checkpoint

### KD1. Máy đoán chữ

Xong khi: test với nét giả lập qua các mức sàn trong `lib/japanese/recognize.test.ts`: viết nhẹ đúng ở vị trí 1 từ 95%,
viết vừa nằm trong 5 chữ đầu từ 93%, viết nặng nằm trong 10 chữ đầu từ 80%, đảo 2 nét nằm trong 5 chữ đầu từ 92%, thiếu
1 nét nằm trong 5 chữ đầu từ 90%. Bảng ở trên là số đo của bản thử, để so.

- [x] Hàm thuần nhận các nét đã vẽ, trả 10 chữ giống nhất, kèm test (`lib/japanese/recognize.ts`, PR #340). Test 60
      chữ mỗi mức với hạt giống cố định: nhẹ 100% đúng vị trí 1; vừa 98% trong 5 chữ đầu; nặng 87% trong 10 chữ đầu;
      đảo 2 nét 100% trong 5 chữ đầu (98% khi thử 400 chữ); thiếu 1 nét 97% trong 5 chữ đầu. Khoảng 20–35 ms một lần đoán trên máy dev.
- [x] Server action `recognizeKanjiAction` (`app/resources/actions.ts`) nhận nét dạng cặp [x, y], tối đa 34 nét, 200
      điểm mỗi nét; nét không đọc được thì trả một dòng "Xoá hết rồi vẽ lại".

### KD2. Khung vẽ ở ô tìm của Kho

Xong khi: thien duyệt ảnh laptop và điện thoại, và 20 chữ thien vẽ thật có ít nhất 16 chữ nằm trong 5 chữ đầu (chuyển từ
KD1 sang đây vì phải có khung vẽ mới thử tay được). Trước khi code: 2–3 bố cục để thien chọn (nút bút cạnh ô tìm mở khung
nổi, hay ngăn dưới trên điện thoại, hay khung luôn hiện bên phải).

- [ ] Khung vẽ dùng lại phần vẽ của khung viết KJ4 (`kanji-write-pad.tsx`), có Xoá nét cuối và Xoá hết.
- [ ] Hàng chữ đoán dưới khung; bấm một chữ là thêm vào ô tìm, khung trống lại để vẽ chữ sau.
- [ ] e2e: vẽ 会 bằng nét KanjiVG, bấm chữ đoán, ô tìm có 会 và kết quả hiện.

### KD3. Dùng ở chỗ khác

Xong khi: ô tìm ở Kho chung và trang Kanji cũng có nút vẽ.

- [ ] Gắn cùng khung vào ô tìm Kho chung và ô tìm trang Kanji.

## Đã đổi

| Ngày  | Đổi gì                                                                                                | Vì sao                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 19/11 | "Xong khi" của KD1 ghi thành mức sàn trong test, thêm cho phép đảo 2 nét liền nhau khi so theo thứ tự | CodeRabbit chỉ ra test (85%) thấp hơn bảng (92%); cho đảo nét thì đạt 98% trên 400 chữ |
| 19/11 | Thử 20 chữ vẽ thật chuyển từ KD1 sang KD2                                                             | KD1 chưa có khung vẽ để thien thử bằng tay                                             |

## Lỗi gặp

| Ngày | Lỗi | Đã xử lý |
| ---- | --- | -------- |
