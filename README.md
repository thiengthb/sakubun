# sakubun

Luyện dịch Nhật–Việt với SRS (FSRS). Next.js 16 + Prisma 7 + SQLite, phục vụ cả web và một MCP
server để Claude Desktop hoặc ChatGPT chấm bài.

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
npm test                    # vitest — chạy trên DB tạm, không đụng dev.db
npm run e2e                 # playwright — tự dựng dev server + DB riêng
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
- **Chỉ đăng nhập bằng Google, và chỉ một tài khoản.** Cần đủ `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET` và `ALLOWED_EMAIL`; thiếu biến nào là không ai vào được. Lần đăng nhập
  đầu tiên bằng đúng Gmail đó tạo tài khoản (admin); email khác bị từ chối cả lúc tạo tài khoản lẫn
  lúc cấp phiên. Redirect URI của OAuth client: `<BETTER_AUTH_URL>/api/auth/callback/google`.
- **VOICEVOX** (TTS tiếng Nhật) chạy như service thứ hai, không mở ra host — chỉ app gọi qua mạng
  nội bộ của compose. Nếu nó chết thì client tự rơi về giọng Web Speech của trình duyệt.

Sao lưu:

```bash
docker run --rm -v sakubun_sakubun_data:/data -v "$PWD":/out alpine \
  cp /data/sakubun.db /out/sakubun-backup-$(date +%Y%m%d).db
```

## Kết nối MCP

Tạo token ở **Cài đặt → Tài khoản → Token MCP**. Nên tạo token riêng cho từng client (ví dụ
`claude-desktop`, `chatgpt`) để có thể thu hồi từng kết nối mà không ngắt client còn lại.

`/api/mcp` có bảy tool (`next_turn`, `stage_turn`, `grade_turn`, `skip_turn`, `lookup`, `add_items`,
`status`) và một prompt `hoc`. Mỗi kết quả kết thúc bằng một dòng `next:` nói lời gọi tiếp theo, nên cùng
một bộ dùng được cho Claude Desktop và ChatGPT. Tên profile cũ `?profile=full` cũng trả về bộ này;
`?profile=tutor` (Hermes học, đã bỏ ngày 2026-10-23) trả 400. `?profile=planner` chỉ có `ping` và `get_review_load` (đọc số lượng ôn,
cho bot xếp lịch); token có scope `planner` không với tới profile nào khác.

### claude.ai và app Claude trên điện thoại (OAuth)

Thêm connector tuỳ chỉnh trên claude.ai với địa chỉ `https://<tên miền>/api/mcp`, không cần token. claude.ai
mở trang đăng nhập của sakubun (Google, đúng `ALLOWED_EMAIL`), rồi trang **Cho phép truy cập sakubun?**.
Sau đó connector dùng được trên web, Claude Desktop và app điện thoại. Server chỉ trả quyền về callback
của claude.ai, ChatGPT và Claude Code (`lib/auth/oauth-redirects.ts`). Chi tiết: `docs/decisions/0002-mcp-oauth.md`.

### Claude Desktop

Mở **Settings → Developer → Edit Config**, rồi thêm cấu hình sau vào `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sakubun": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://sakubun.example.com/api/mcp",
        "--header",
        "Authorization: Bearer <MCP_TOKEN>"
      ]
    }
  }
}
```

Thay URL và token bằng giá trị của bạn, rồi khởi động lại Claude Desktop.

### ChatGPT

ChatGPT dùng đúng endpoint và token đó: `https://sakubun.example.com/api/mcp`, với HTTP header
`Authorization: Bearer <MCP_TOKEN>`. Trên ChatGPT web, bật Developer mode, vào **Settings → Apps →
Create**, nhập endpoint và cơ chế xác thực để gửi header trên, rồi **Scan Tools** và tạo app. Chọn
app trong chat mới để sử dụng.

Endpoint phải là HTTPS công khai; ChatGPT không thể gọi `localhost`. Nếu Sakubun chỉ đang chạy trên
máy của bạn, hãy deploy hoặc dùng Secure MCP Tunnel. Xem [hướng dẫn MCP chính thức của
OpenAI](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt).
Hiện thao tác ghi/sửa qua MCP đang beta cho ChatGPT Business và Enterprise/Edu; tài khoản Pro chỉ
dùng app MCP với quyền đọc/tìm kiếm.

## Cấu trúc

```
app/                      Route (Next.js App Router), server action, API route handler
components/
  ui/                     Primitive (shadcn) — không biết gì về nghiệp vụ
  common/                 Dùng chung toàn app: DataTable, CardDeck, SectionHeading…
  layout/                 Khung màn hình: sidebar, breadcrumb, shell, error boundary
  features/               Theo màn hình: dashboard, groups, history, resources, review, settings
lib/
  core/                   Không phụ thuộc nghiệp vụ: cn, ngày giờ, làm sạch text, ActionResult
  auth/                   better-auth (chỉ Google), chính sách đăng nhập, MCP key
  db/                     Prisma client + trình dựng DB cho test
  japanese/               Furigana, romaji
  domain/                 Lõi học mới, logic thuần: hàng ôn, lượt luyện, chấm ôn nhanh, thẻ điền từ, cách soạn câu
  app/                    Use-case của lõi mới: đọc/ghi DB rồi gọi domain (getQueue, recordReviews)
  srs/                    FSRS, chọn bài, retention, calibration, streak
  library/                Kho học của người dùng + tầng dữ liệu practice
  session/                Một lượt luyện: loại bài, nhãn lỗi, coach, recap
  transfer/               Nhập/xuất (Excel, Anki, sao lưu tài khoản)
  insights/               Tổng hợp chỉ đọc cho dashboard
  settings/               Schema cài đặt
  design/                 Các LUẬT frontend, viết dưới dạng test (xem bên dưới)
  mcp/                    Bề mặt API MCP cho Claude Desktop và ChatGPT
e2e/                      Playwright
```

Test nằm cạnh code nó kiểm (`lib/srs/srs.test.ts` bên `lib/srs/srs.ts`).

### Luật frontend

`lib/design/` không chứa code chạy — nó chứa các luật, dưới dạng test. Chạy `npm test` là kiểm luôn:

| Luật | File |
| --- | --- |
| Kích thước vuông dùng `size-N`, không `h-N w-N`; component trong `ui/`+`common/` phải nhận `className`; class ghép bằng `cn()`; component trình bày không nằm trong file route; `features/` không import chéo nhau; `lib/core` không biết nghiệp vụ | `component-standards.test.ts` |
| Không dùng cỡ chữ ngoài thang, không `text-xl+` ngoài hero/số liệu | `type-scale.test.ts` |
| `<TabsList>` cấp trang phải đi qua `PageShell headerAside` | `layout-standard.test.ts` |
| Skeleton phải khớp số tab / khung của trang thật | `skeleton-parity.test.ts` |
| Màu chữ trên nền phải đạt ngưỡng tương phản | `contrast.test.ts` |
| Chuỗi tiếng Nhật phát được phải đi qua `SpokenLine` | `spoken-line.test.ts` |
| Không emoji trong source | `no-emoji.test.ts` |
| Chỗ nào cần cắt chữ thì dùng `Truncate` | `truncate.test.ts` |

Muốn phá luật thì phải thêm file vào allowlist ngay trong test đó, **kèm lý do** — nên ngoại lệ luôn
có người chịu trách nhiệm, thay vì trôi đi âm thầm.
