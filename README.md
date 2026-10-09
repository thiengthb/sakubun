# sakubun

App luyện dịch Nhật–Việt theo ngữ pháp, cho **một người dùng**, deploy thật, mọi thứ sau `/login`.

Người học luyện bằng cách nói chuyện với **Claude Desktop qua MCP**; **app giữ dữ liệu, FSRS, hạn mức
ngày và cài đặt**, còn Claude soạn câu và chấm. Web không sinh câu và không chấm — repo này không gọi
API Anthropic ở đâu cả, và MCP là một chiều: Claude gọi app.

Năm trang: **Phân tích · Tài nguyên · Lịch sử · Cài đặt · Hướng dẫn**.

## Bắt đầu

```bash
node tooling/init.mjs          # dựng môi trường (chạy được trên mọi OS)
npm run dev                    # http://localhost:3789
npm run verify                 # gen → typecheck → lint → test → build
npx playwright test            # e2e thật, browser thật
```

Làm việc trong repo này thì **đọc `CLAUDE.md` trước** — lệnh và các gotcha quan trọng
(ngắn, một trang). File này chỉ là cửa vào; nó cố ý không nhắc lại
những gì `CLAUDE.md` đã nói.

## Bản đồ

| Thư mục | Là gì |
|---|---|
| `app/` · `components/` | Next.js App Router + UI. Mọi chuỗi người học đọc là **tiếng Việt**. |
| `lib/` | Tầng miền. `lib/practice.ts` giữ `submitReview()` — **lối duy nhất tính lịch FSRS**. |
| `lib/mcp/` | Bề mặt MCP cho Claude Desktop (bearer token per-user). |
| `lib/trpc/` · `mobile/` | Transport và app Expo cho điện thoại. Xem `docs/progress/mobile-app.md`. |
| `prisma/` | Schema + migration. Prisma 7 + driver adapter; đọc `AGENTS.md §Gotchas` trước khi sửa. |
| `e2e/` | Playwright. Bề mặt nào không có ở đây thì coi như **chưa được kiểm**. |
| `docs/` | Quyết định, runbook, nhật ký tiến độ. Bắt đầu ở `docs/ARCHITECTURE.md`. |
| `tooling/` | Công cụ sản phẩm: `learning-lab` (chạy thử một buổi học), `db-restore`. |

## Deploy

Docker, chạy ngay trên máy, dữ liệu ở volume có tên:

```bash
docker compose up -d --build                          # app + VOICEVOX (TTS tiếng Nhật)
docker compose -f docker-compose.tunnel.yml up -d     # Cloudflare Tunnel ra ngoài
```

Secret ở `.env.docker` / `.env.tunnel` (gitignored, không vào image). **Người bấm nút production** —
xem `.claude/rules/danger-zones.md`.

## Bản nhiều người dùng

Nhóm, thư viện chung, feed, thông báo, admin nằm ở nhánh `feat/multiuser-community`. Cần thì **lấy lại
từ đó**, đừng dựng lại từ đầu.
