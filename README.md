# sakubun

Luyện dịch Nhật–Việt với SRS (FSRS). Next.js 16 + Prisma 7 + SQLite, phục vụ cả web và một MCP
server để Claude Desktop chấm bài.

## Chạy local

```bash
cp .env.example .env        # điền BETTER_AUTH_SECRET: openssl rand -base64 32
npm ci
npm run gen                 # prisma generate
npm run db:migrate          # tạo prisma/dev.db
npm run dev                 # http://localhost:3789
```

## Kiểm thử

```bash
npm run verify              # gen + typecheck + lint + test + build
npm test                    # vitest (54 file, 727 test) — chạy trên DB tạm, không đụng dev.db
npm run e2e                 # playwright (52 test), tự dựng dev server + DB riêng
```

`npm test` không cần chuẩn bị gì: mỗi suite gọi `createTestDb()` để dựng một SQLite mới trong
`os.tmpdir()` từ `prisma/migrations`, rồi `resetLearningData()` dọn sạch giữa các test.

## Deploy bằng Docker

```bash
cp .env.docker.example .env.docker   # điền BETTER_AUTH_SECRET + BETTER_AUTH_URL
docker compose up -d --build
```

Xong. Container tự khởi động lại cùng Docker (`restart: unless-stopped`), app nghe ở cổng 3789.

Vài điểm cần biết:

- **Dữ liệu nằm trong volume `sakubun_sakubun_data`**, mount tại `/data`. Xoá container không mất
  lịch sử học; `docker compose down` cũng không (chỉ `down --volumes` mới xoá).
- **Đừng đặt `DATABASE_URL` trong `.env.docker`.** Image đã ghim `file:/data/sakubun.db` — đúng chỗ
  volume được mount. Ghi đè biến đó là trỏ app sang DB khác và mất toàn bộ lịch sử.
- **Migration chạy lúc container khởi động** (`prisma migrate deploy`), trước khi server lên.
- **`BETTER_AUTH_URL` phải là URL trình duyệt thật sự dùng.** Sai giá trị này thì cookie phiên không
  được chấp nhận và bạn không đăng nhập được.
- **Nếu đăng nhập bằng Google thì cặp `GOOGLE_*` là bắt buộc**, không phải tuỳ chọn: tài khoản tạo
  qua Google không có dòng mật khẩu, thiếu hai biến đó là better-auth bỏ provider và không còn
  đường vào.
- **VOICEVOX** (TTS tiếng Nhật) chạy như service thứ hai, không mở ra host — chỉ app gọi qua mạng
  nội bộ của compose. Nếu nó chết thì client tự rơi về giọng Web Speech của trình duyệt.

Sao lưu:

```bash
docker run --rm -v sakubun_sakubun_data:/data -v "$PWD":/out alpine \
  cp /data/sakubun.db /out/sakubun-backup-$(date +%Y%m%d).db
```

## Cấu trúc

| Thư mục       | Nội dung                                                         |
| ------------- | ---------------------------------------------------------------- |
| `app/`        | Route Next.js (App Router), server action, route handler API      |
| `components/` | `ui/` primitive, `shared/` dùng chung, còn lại theo từng màn hình |
| `lib/`        | Toàn bộ logic: SRS, chấm điểm, import/export, MCP server          |
| `mobile/`     | App Expo, dùng lại backend qua tRPC                               |
| `e2e/`        | Playwright                                                        |
