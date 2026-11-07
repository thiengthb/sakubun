# G. Nguồn dữ liệu từ vựng, ngữ pháp, câu ví dụ, âm thanh

Nguyên tắc: chỉ dùng dữ liệu có giấy phép cho phép **dùng lại và sửa**. Sakubun miễn phí hay thu phí sẽ đổi một số lựa
chọn (giấy phép NC: chỉ phi thương mại). Ghi nguồn ngay trong app, không chỉ trong repo.

## G1. Bảng nguồn

| Nguồn | Nội dung | Giấy phép | Dùng được không | Ghi chú |
|---|---|---|---|---|
| **OpenJLPT** (đang dùng) | Từ và ngữ pháp N5–N1, câu ví dụ | CC BY-SA 4.0 | Có, kể cả thương mại | Danh sách cấp JLPT là ước lượng cộng đồng: JLPT không công bố danh sách chính thức từ 2010 |
| **JMdict** (EDRDG) | Từ điển Nhật đa ngữ, khoảng 200 nghìn mục | CC BY-SA 4.0 | Có, kể cả thương mại | Theo hiểu biết của mình **không có nghĩa tiếng Việt** (cần kiểm lại). Web có chức năng từ điển phải ghi nguồn trên mỗi màn hình (ví dụ chân trang); nên cập nhật hằng tháng |
| **KANJIDIC2** (EDRDG) | Khoảng 13 nghìn chữ Hán: âm On, Kun, nghĩa, số nét, cấp | CC BY-SA 4.0 (một số trường có bản quyền riêng, như mã SKIP) | Có | Có trường âm đọc tiếng Việt (cần kiểm độ phủ): nguồn kiểm chéo thứ ba cho Hán Việt |
| **Unihan kVietnamese** (đang dùng) | Âm Hán Việt theo chữ | Unicode License v3 | Có | |
| **hanviet-pinyin-words** (đang dùng) | Hán Việt | MIT | Có | |
| **Tatoeba** (OpenJLPT dùng) | Câu song ngữ do cộng đồng góp | Câu: CC BY 2.0 FR; âm thanh: giấy phép riêng từng người | Câu có; âm thanh phải lọc theo giấy phép | Cặp Nhật–Việt rất ít; chất lượng không đều |
| **KanjiVG** | Thứ tự nét, nét SVG, thành phần chữ | CC BY-SA 3.0 | Có | Cho luyện viết và hoạt hình nét |
| **Kanjium** | Cao độ trọng âm cho khoảng 124 nghìn từ, và nhiều dữ liệu khác | CC BY-SA 4.0 (dữ liệu bên thứ ba theo giấy phép gốc) | Có, cho phép thương mại | Ảnh thứ tự nét trong gói có bản quyền Wadoku, **không dùng** phần ảnh |
| **wordfreq** | Tần suất từ nhiều ngôn ngữ, có tiếng Nhật | Dữ liệu CC BY-SA 4.0 | Có | Đã ngừng cập nhật (dữ liệu tới khoảng 2021), đủ dùng để xếp thứ tự học |
| **BCCWJ** (NINJAL) | Danh sách tần suất từ kho ngữ liệu chuẩn tiếng Nhật | Miễn phí cho nghiên cứu và giáo dục | **Chưa rõ**: không nói về phân phối lại hay app | Muốn dùng thì hỏi NINJAL. Tạm không dùng |
| **Wiktionary** (qua kaikki.org) | Từ điển nhiều ngôn ngữ | CC BY-SA 4.0 | Có | Mục tiếng Nhật có nghĩa tiếng Việt rất ít |
| **Tae Kim's Guide** | Giải thích ngữ pháp | CC BY-NC-SA 3.0 | **Chỉ phi thương mại** | Tiếng Anh; dùng làm tham khảo, không nhập vào app |
| **JaViCorpus** | Khoảng 2 triệu cặp câu Nhật–Việt | Chỉ nghiên cứu, **cấm thương mại** | **Không** | Nguồn con (phụ đề phim, tạp chí) có bản quyền |
| **Irodori, Marugoto** (Japan Foundation) | Giáo trình theo chuẩn JF và CEFR | Tải miễn phí, điều khoản riêng | **Cần đọc điều khoản** | Khung "làm được gì" (can-do) theo cấp rất hữu ích để thiết kế nhiệm vụ Kaiwa |
| **VOICEVOX** (đang dùng) | Giọng đọc tiếng Nhật | Phần mềm LGPL; **mỗi nhân vật giọng có điều khoản riêng** | Có, nhưng **phải ghi "VOICEVOX:tên nhân vật"** | Xem G2 |
| **Kuromoji + IPADIC** (đang dùng) | Tách từ, cách đọc | Apache 2.0 + giấy phép IPADIC | Có | UniDic chính xác hơn, giấy phép BSD/GPL/LGPL |
| **Mazii, Migii, Jisho, sách Minna no Nihongo, Genki** | | Đóng hoặc có bản quyền | **Không** | Không cào dữ liệu |

## G2. Việc cần làm ngay về giấy phép (phát hiện khi kiểm repo)

Mình tìm trong `app/` và `components/` và **không thấy** chỗ nào ghi nguồn VOICEVOX theo tên nhân vật, EDRDG,
Tatoeba hay giấy phép CC BY-SA của OpenJLPT trên giao diện. `data/openjlpt/NOTICE.md` có ghi nhưng chỉ trong repo.

- Điều khoản của từng nhân vật VOICEVOX thường bắt buộc ghi "VOICEVOX:ずんだもん" (hoặc tên nhân vật đang dùng) ở nơi
  người nghe thấy được.
- CC BY và CC BY-SA đòi ghi nguồn ở nơi người dùng thấy được.

Đề xuất: một trang **"Nguồn dữ liệu và giấy phép"** (từ Cài đặt và chân trang), cộng một dòng nhỏ ở trình phát âm
thanh. Việc nhỏ, rủi ro pháp lý thấp nhưng có thật; nên làm trước mọi tính năng mới.

## G3. Kiến trúc dữ liệu đề xuất

1. **Lớp từ điển chung** (chỉ đọc, của hệ thống): JMdict + KANJIDIC2 + Kanjium + tần suất + nghĩa tiếng Việt của
   Sakubun. Dùng cho tra từ ở mọi nơi.
2. **Kho chung** (đã có): mục do hệ thống và cộng đồng soạn.
3. **Kho riêng** (đã có): mục người học lấy về hoặc tự thêm, có lịch FSRS.

Nghĩa tiếng Việt là chỗ thiếu lớn nhất. Cách làm hiện tại (AI dịch, người duyệt, Codex dịch câu ví dụ) hợp lý. Có thể
mở rộng: AI dịch nghĩa JMdict sang tiếng Việt cho khoảng 10–20 nghìn từ thông dụng nhất (theo wordfreq), người học
báo lỗi ngay trên app, rồi công bố lại bộ dữ liệu theo CC BY-SA.

## Nguồn

- EDRDG licence: https://www.edrdg.org/edrdg/license.html
- KanjiVG: https://kanjivg.tagaini.net/
- Kanjium: https://github.com/mifunetoshiro/kanjium
- BCCWJ frequency list: https://clrd.ninjal.ac.jp/bccwj/en/freq-list.html
- JaViCorpus: https://www.github.com/ngovinhtn/JaViCorpus
- Tatoeba downloads: https://tatoeba.org/ca/downloads
- Hướng dẫn ghi nguồn VOICEVOX khi dùng thương mại: https://book.st-hakky.com/en/data-science/voicevox-usage-and-commercial-use
- OpenJLPT: https://github.com/evanclan/OpenJLPT/releases
