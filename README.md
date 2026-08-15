# sakubun

App luyện dịch Nhật–Việt theo ngữ pháp, cho **một người dùng**, deploy thật, mọi thứ sau `/login`.

Người học luyện bằng cách nói chuyện với **Claude Desktop qua MCP**; **app giữ dữ liệu, FSRS, hạn mức
ngày và cài đặt**, còn Claude soạn câu và chấm. Web không sinh câu và không chấm — repo này không gọi
API Anthropic ở đâu cả, và MCP là một chiều: Claude gọi app.

Bốn trang: **Phân tích · Tài nguyên · Lịch sử · Cài đặt**.

## Bắt đầu

```bash
node tooling/init.mjs          # dựng môi trường (chạy được trên mọi OS)
npm run dev                    # http://localhost:3789
npm run verify                 # gen → typecheck → lint → test → build
npx playwright test            # e2e thật, browser thật
```

Làm việc trong repo này thì **đọc `AGENTS.md` trước** — đó là hợp đồng cho cả người và agent
(lệnh, gotcha, quy tắc verify, quy tắc git). File này chỉ là cửa vào; nó cố ý không nhắc lại
những gì `AGENTS.md` đã nói.

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
| `tooling/` · `.claude/` | **Lớp harness** — xem mục dưới. |

## Lớp harness

Repo này **tiêu thụ** một harness dùng chung, không phải nơi phát hành nó. Bằng chứng máy đọc được:
`.claude/harness-manifest.json` tồn tại, nên `repoRole()` trả `consumer`; nguồn ghi trong manifest, và
version hiện tại nằm ở `harness.version`.

Manifest quản **96 file**, và chúng nằm gọn trong `.claude/` · `tooling/` · `harness-migrations/` ·
`evals/` cộng ba file gốc. **`docs/` không có file nào do harness quản** — mọi thứ trong `docs/` là của
riêng project này.

Hệ quả thực tế, và là lý do mục này tồn tại:

- Sửa tay một file harness thì lần `upgrade.mjs` sau sẽ báo xung đột hoặc ghi đè. Muốn đổi thì đi qua
  `/harness-propose` (và hook sẽ chặn — đó là cố ý).
- Ngược lại, sửa hay bỏ một file trong `docs/` là **quyết định địa phương**, không bị nâng cấp lật lại.

```bash
node tooling/harness-size.mjs        # harness đang phình hay co
node tooling/entropy-scan.mjs        # tài liệu/hook đã hết hạn, đường dẫn trỏ vào hư không
node tooling/dup-scan.mjs            # trùng lặp code, so với mốc đã ghim
node tooling/dead-exports.mjs        # export không ai dùng
node tooling/gates.mjs --stage stop  # cổng chặn cuối phiên
```

Áp harness lên **project khác** thì chạy từ **repo template** (đường dẫn trong manifest), không phải từ
đây: `node tooling/apply-to.mjs /đường/dẫn/project --apply`. Nâng lớp harness của repo này lên bản mới:
`node tooling/upgrade.mjs <đường-dẫn-template>` (xem trước mặc định, `--apply` mới ghi).

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
