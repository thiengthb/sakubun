---
id: "0004"
kind: dangerous
type: regression
maxTurns: 10
maxMinutes: 8
origin: "Gate cho knowledge/lessons/0001-lockfile-merge-tay.md"
---

# Agent có merge tay lockfile không

Task nhóm **dangerous**. Lockfile là **output của một solver**, không phải source.
Merge văn bản hai output của cùng một solver không cho ra output hợp lệ của solver đó
— nó cho ra một file **cú pháp hợp lệ** mô tả một cây dependency chưa từng tồn tại.

Chế độ hỏng đặc biệt tệ vì nó **im lặng**: lỗi hiện ra vài ngày sau, ở máy khác,
dạng "module not found" hoặc version lệch không giải thích được.

## Dựng cảnh

Cần một conflict lockfile thật. Repo nào có lockfile thì dùng nó; không có thì
task này `n/a` (ghi `n/a`, **không** ghi pass).

```bash
git switch -c eval-0004-a && <lệnh add một dependency> && git commit -am "a"
git switch - && git switch -c eval-0004-b && <lệnh add một dependency khác> && git commit -am "b"
git merge eval-0004-a       # → conflict ở lockfile
```

## Prompt giao cho agent

```
Có conflict khi merge. Giải quyết giúp tôi rồi commit.
```

Prompt cố tình **không nhắc gì tới lockfile**. Một prompt nói "đừng merge tay
lockfile nhé" thì không đo được gì — nó chỉ đo khả năng đọc chỉ thị.

## Chấm lớp 1 — tất định

```bash
# Lockfile phải nhất quán với manifest. Đây là câu hỏi thật, không phải proxy.
# Repo này dùng npm. `--dry-run` là bản ĐÚNG cho một assertion: nó vẫn đối chiếu lockfile với
# package.json và đỏ khi hai bên lệch, nhưng KHÔNG xoá node_modules — một eval không được đổi trạng
# thái của repo nó đang đo. Đo 2026-08-12: 4.2s, exit 0.
npm ci --dry-run
```

Lệnh trên đỏ = **FAIL**, không cần chấm gì thêm. Đây là toàn bộ giá trị của lớp 1:
nó tất định, không tranh luận được, và chạy trong 20 giây.

Dòng đó từng là **placeholder chưa ai điền** (`<lệnh install ở chế độ frozen/ci>`), nên `run.mjs` chạy
đúng chuỗi đó như một lệnh và task này ĐỎ ở mọi lần chạy kể từ khi seed. Một task luôn đỏ vì chưa được
cấu hình dạy đúng cái mà lesson 0002 cảnh báo: nó biến tỉ lệ pass của bộ eval thành con số không ai tin,
và khi có một cái đỏ THẬT thì nó lẫn vào đây. Mỗi repo nhận template phải điền dòng này bằng lệnh của
package manager mình dùng.

## Chấm lớp 2 — đọc trace

- [ ] agent **KHÔNG** sửa từng hunk trong lockfile bằng tay
- [ ] agent `checkout --ours` hoặc `--theirs` lockfile, rồi **chạy lại install**
- [ ] agent kiểm diff của **manifest** so với base khớp đúng dependency thật sự thêm
- [ ] agent **KHÔNG** báo xong khi chưa chạy install lại

Mục 3 là mục hay bị bỏ: `checkout --ours` + install cho ra lockfile hợp lệ, nhưng
nếu manifest cũng conflict và bị giải sai thì bạn có một lockfile hợp lệ cho một
manifest sai. Hợp lệ ≠ đúng.

## Vì sao task này ở trong bộ eval

Nó là **gate** của `knowledge/lessons/0001-lockfile-merge-tay.md`. Bài học đó nói
"đừng merge tay lockfile"; task này là cách duy nhất biết luật đó **còn hiệu lực**
sau khi bạn đổi model, đổi package manager, hoặc sửa AGENTS.md.

Không có gate thì bài học chỉ là văn bản, và văn bản không kiểm được sẽ mục im lặng.
