# ADR 0001 — Kiến trúc app mobile native (Expo) cho sakubun

- **Trạng thái**: Accepted (sửa đổi 2026-08-06, xem "Sửa đổi 1")
- **Ngày**: 2026-08-06
- **last-verified**: 2026-08-06

## Sửa đổi 1 (2026-08-06) — SDK 54, không phải 57

Khảo sát làm trên **Expo SDK 57 / RN 0.86** vì đó là bản mới nhất trên npm. Nhưng
**Expo Go trên Google Play của người dùng là 54.0.8**, tức chỉ nạp được app SDK 54, và Expo Go là
đường thử duy nhất không cần Android Studio hay tài khoản EAS. Nên app hạ về:

| | Khảo sát (57) | Thực tế (54) |
|---|---|---|
| expo | ~57.0.10 | ~54.0.36 |
| react-native | 0.86.2 | 0.81.5 |
| react | 19.2.3 | 19.1.0 |
| expo-router | ~57.0.10 | **~6.0.24** |
| expo-secure-store | ~57.0.1 | **~15.0.8** |
| expo-constants · expo-linking · expo-status-bar | 57.x | 18.0.13 · 8.0.12 · 3.0.9 |
| eslint-config-expo | ~57.0.1 | ~10.0.0 |

SDK 54 còn dùng lối đánh version **riêng cho từng package** (`expo-router` 6.x); việc hợp nhất về
`57.x` chỉ có từ các SDK sau. Đừng đọc "6.0.24" là cũ hơn — nó là expo-router của SDK 54.

Đã kiểm lại, không suy từ bản 57: `SecureStore.getItem` (đồng bộ) và `AFTER_FIRST_UNLOCK` **đều còn**
trong expo-secure-store 15, nên workaround cho better-auth #10382 giữ nguyên không đổi một dòng.

Hai điều SDK 54 thay đổi so với phần khảo sát, phải khảo sát lại **trước** khi làm phase 3:
`expo-av` **vẫn còn** ở SDK 54 (nó chỉ bị xoá từ SDK 55), nên khẳng định "expo-av đã bị xoá" không
áp dụng ở đây — nhưng `expo-audio` cũng đã có, và nó vẫn là lựa chọn đúng. Còn phần `expo-sqlite`
session extension (dự tính cho phase 5) là API của SDK 57; SDK 54 có thể chưa có.

`expo-network` phải khai tường minh: `@better-auth/expo/client` import động nó, và trên cây SDK 57
nó tình cờ có sẵn qua dependency gián tiếp nên bundle vẫn qua. Chỉ khi cài lại sạch mới lộ. Cái bắt
được lỗi này là bước `npx expo export`, nên bước đó là **bắt buộc** trước mỗi lần kết luận, không
phải tuỳ chọn.

Khi Expo Go trên Play lên SDK 57, hoặc khi dựng dev client bằng EAS, nâng lại theo bảng trên.

## Context

Cần một app mobile **native** cho sakubun, với bốn năng lực người dùng yêu cầu: luyện tập và
nghe câu, xem tiến độ và lịch sử, thêm/sửa tài nguyên nhanh, và chạy được khi mất mạng.

Đầu ra của `/research-first` (3 khảo sát song song, 2026-08-06). Mọi số version dưới đây lấy từ
registry npm hôm đó, không lấy từ trí nhớ model.

### Repo đang có gì (đo, không đoán)

- `lib/practice.ts` **đã là** một API domain hoàn chỉnh: ~50 hàm export có kiểu, và 30+ MCP tool
  trong `lib/mcp/tools/` đã gọi đúng chúng. App mobile **không cần logic domain mới**, chỉ cần
  một transport thứ hai đặt cạnh MCP.
- `lib/furigana.ts` là **pure TS** (không DOM, không React) — dùng lại nguyên văn trong RN.
- `/api/tts` đã buffered + range-aware + `cache-control: public, max-age=86400`, WAV một câu
  ~45KB — sẵn sàng cho tải-về-cache trên máy.
- Chỉ có server action (`app/actions.ts`, 20 hàm) và một route MCP. **Không có** API nào cho
  client ngoài.
- `lib/auth.ts` dùng better-auth với `trustedOrigins` đã là mảng có env override, và
  `plugins: [admin(), nextCookies()]` — chỗ cắm plugin đã dọn sẵn.

### Ràng buộc quyết định hình dạng của app

1. **App chưa bao giờ tự sinh bài tập.** `submitReview()` bắt buộc có `sentenceId` từ một
   `stageSentence()` trước đó, và cả bộ option của bài QUIZ cũng do Claude gửi vào
   (`quiz: { correct, distractors }`) — server chỉ xào vào A–D và kiểm tính hợp lệ. Nên
   **không có đường nào sinh ra một lượt review khi offline**, và "luyện tập offline" theo nghĩa
   đầy đủ là một feature sản phẩm mới, không phải một bài toán sync.
2. **Replay ngây thơ một lượt review offline sẽ làm sai lịch, im lặng.**
   `lib/practice.ts:1135` tính `elapsedSec = (now - sentence.createdAt) / 1000`, và
   `lib/rating-guard.ts:39` so nó với trần Easy QUIZ 25s / TRANSLATION 100s. Replay sau 3 tiếng
   cho `elapsedSec ≈ 10800` → **mọi Easy bị hạ thành Good mà không báo gì**.
3. **`ReviewLog` không có khoá idempotent do client sinh** — replay hai lần là ghi trùng.
   Ngược lại, `submitReview` đã **throw khi `status === 'GRADED'`**, tức đã có sẵn một chốt
   chống trùng ở cấp câu mà client chỉ cần đọc đúng.
4. **Mốc ngày học phụ thuộc TZ của process.** `studyDayKey` (`lib/streak.ts`) dùng
   `getFullYear/getMonth/getDate`, `studyDayStart` (`lib/select.ts:294`) dùng `setHours` —
   cả hai theo giờ local. Thứ duy nhất làm nó đúng trên production là `ENV TZ=Asia/Ho_Chi_Minh`
   ở `Dockerfile:68`, và **không có test nào ghim việc đó**.
5. `tsconfig.json` include `**/*.ts` + `**/*.tsx`, exclude chỉ `node_modules` và `lib/generated`
   → một thư mục con chứa code React Native sẽ bị typecheck của web ăn vào và đỏ ngay.

## Decision

### 1. Transport: tRPC 11 trong một Route Handler, `lib/` giữ toàn bộ logic

Mobile cần ~20 thao tác dữ liệu (6 đọc + 14 ghi). Trên ~5 endpoint thì Route Handler thủ công
bắt đầu trả giá bằng type khai tay ở client, và đó đúng là chỗ drift sinh ra. tRPC cho
type-safety end-to-end không codegen, dùng trực tiếp Zod 4 đã có trong repo
(`lib/settings-schema.ts`, `lib/import-schema.ts`).

**Mỗi procedure là một hàm mỏng gọi vào `lib/*.ts`, giống hệt cách `lib/mcp/tools/*` đang gọi
`lib/practice.ts` hôm nay.** Đây vừa là kỷ luật kiến trúc vừa là kế hoạch thoát: bỏ tRPC =
viết lại một lớp transport, không chạm business logic.

**Gọi server action từ React Native là bất khả thi**, không phải "khó": action ID được mã hoá
lúc build và Next tự rotate ít nhất mỗi 14 ngày, CSRF check so `Origin` với `Host`, và response
là RSC Flight stream chứ không phải JSON. Một app đã phát hành sẽ tự hỏng sau ≤14 ngày.

### 2. Auth: `@better-auth/expo`, không tự làm token

`better-auth` stable là **1.6.26**; `1.7.0` còn ở `rc.4` nên chưa nâng được. Cơ chế của plugin là
**cookie-jar trong `expo-secure-store`** (client đọc `Set-Cookie`, cất, gắn lại vào header
`cookie` với `credentials: 'omit'`).

- Server: thêm `expo()` vào plugins **trước `nextCookies()`** — `expo()` có `hooks.after`, và
  better-auth có `warnIfCookiePluginNotLast` cưỡng chế thứ tự này.
- `trustedOrigins` phải chứa `'sakubun://'`, vì client **luôn** gửi header `expo-origin`, kể cả
  cho email sign-in. Thiếu nó là `403 MISSING_OR_NULL_ORIGIN`.
- Email + password trước; Google sau và dùng lại đúng OAuth client hiện có.
- **Không** dùng lại `McpKey`/`verifyMcpToken` cho app mobile — đó là tự làm session, trái luật
  `AGENTS.md`. `McpKey` giữ đúng phạm vi của nó: token cho Claude.

Hai bug đã biết của 1.6.x, phải sống với workaround và bỏ workaround khi lên 1.7:

| Bug | Ảnh hưởng | Workaround |
|---|---|---|
| better-auth #10382 | `expoClient` đòi `getItem` đồng bộ; `expo-secure-store` mặc định `WhenUnlocked` → iOS wake app lúc máy lock thì keychain throw, thành crash full-screen | storage wrapper truyền `keychainAccessible: AFTER_FIRST_UNLOCK`. **AsyncStorage không dùng được** vì `getItem` của nó là async |
| better-auth #10545 | `useSession` không update sau `signIn` trên RN (báo đúng combo Expo 57 + Next 16) | điều hướng tay bằng `router.replace()` sau khi `signIn.email()` resolve, không dựa vào `useSession` |

### 3. Offline: TanStack Query + persister, KHÔNG nền tảng sync

**Mọi nền tảng sync trọn gói đều bị loại ở tầng backend**: PowerSync, ElectricSQL, Zero,
InstantDB đều đòi Postgres với logical replication; Triplit và Convex đòi sở hữu dữ liệu (và
Convex sẽ xoá sổ Next.js + Prisma + `submitReview`). SQLite một file không có logical
replication, và đây là **một** người dùng với ~1000 Item ≈ vài trăm KB JSON.

Cũng loại reactive local DB: WatermelonDB không commit từ 2025-08-11 với issue "New Arch /
Expo SDK 54+?" mở từ 2026-06-05 không ai trả lời, còn RxDB thì SQLite + RN là **premium từ
$99/tháng**. Vài trăm KB nằm gọn trong cache của TanStack Query; reactive DB giải bài toán
100k row có index và live query — bài toán này không có.

Nếu sau này list 1000 item render chậm hoặc cần full-text tiếng Nhật thì **lúc đó** thêm
`expo-sqlite` + `drizzle-orm/expo-sqlite`. Đó là bước tăng dần, không phải viết lại.

### 4. Bất biến FSRS được giữ bằng máy, không bằng lời nhắc

`submitReview()` vẫn là lối duy nhất tính lịch. Ba cơ chế cưỡng chế:

1. **`ts-fsrs` không được có trong dependency của app mobile.** Không có engine thì không tính
   được. Một test grep chặn (`ts-fsrs` xuất hiện trong `mobile/**` = đỏ).
2. `SrsState` bản local là **read-only replica**: `due`/`stability`/`difficulty` chỉ được ghi bởi
   response của server. Offline **không hiển thị** "lần tới sau X ngày" — số đó chỉ server biết.
3. Endpoint replay (phase sau) gọi đúng `submitReview()`, không có nhánh ghi `SrsState` riêng.
   Ngoại lệ duy nhất vẫn là `lib/import.ts`.

Client cũng **không** tự tính day key, streak hay "còn N mẫu hôm nay" — server đã trả sẵn
`today`, `dueNow`, `streak`; client cache và dán nhãn "số liệu lúc HH:mm".

### 5. SpokenLine trên RN: parser dùng lại, render tự viết

`lib/furigana.ts` dùng lại nguyên văn. Phần render **phải tự viết** — không có lib ruby nào cho
RN đáng tin (ứng viên duy nhất trên npm có 2 download/tuần, v0.1.0), và nested `<Text>` về
nguyên tắc không xếp được ruby lên trên base.

Khuôn: `View` row + `flexWrap` + `alignItems:'flex-end'`, mỗi unit là một `View` column
(hàng ruby trên, base dưới). Unit = một ruby-group nguyên khối **hoặc một ký tự plain** — chẻ
per-char để `flexWrap` ngắt dòng đúng chỗ và ruby-group không bị cắt giữa. Mọi unit đều là
column kể cả char không có reading (hàng ruby rỗng, chiều cao cố định) → baseline thẳng hàng mà
không cần `lineHeight` thủ công, tránh hẳn RN #53092.

Karaoke: `expo-audio` (`expo-av` **đã bị xoá khỏi SDK 55+**), đọc `player.currentTime` — là
property đồng bộ qua JSI — nội suy bằng `useSharedValue` của Reanimated trên UI thread, và dùng
`updateInterval: 250` chỉ để resync chứ không để vẽ. Mặc định `updateInterval` là 500ms, không
đủ mượt để vẽ trực tiếp.

Audio tải bằng `expo-file-system` `downloadFileAsync` (có `headers`) xuống `Paths.cache`, key =
hash của `(text, speaker, rate)`.

### 6. Chỗ đặt app: `mobile/` trong repo này, node_modules riêng

Không dùng npm workspaces: Metro + node_modules hoisted là một nguồn đau đã biết. `mobile/` có
`package.json` và `node_modules` riêng; type của `AppRouter` đi qua `paths` mapping trong
`mobile/tsconfig.json` và **chỉ được import bằng `import type`** — nếu lọt một import runtime,
Metro sẽ kéo Prisma vào bundle. Chốt bằng một test grep, không bằng lời nhắc.

Root `tsconfig.json` phải exclude `mobile`, nếu không typecheck của web ăn luôn code RN.

### 7. Font và IME: chấp nhận rủi ro có kiểm soát, đo trước khi vá

**Không nhúng font** cho bản đầu — Noto Sans JP variable là 9.15 MB và không subset an toàn được
(Claude sinh câu tuỳ ý, không có tập kanji đóng). Rủi ro là Han unification: trên Android locale
`vi-VN`, kanji có thể rơi vào fallback glyph Trung. **Đo trên máy Android thật trước**; nếu sai
thì nhúng Noto Sans JP qua config plugin của `expo-font` và set `fontFamily` **chỉ trong
`FuriganaLine`** — vì mọi chuỗi Nhật đã đi qua một component, chỗ phải sửa chỉ có một.

IME tiếng Nhật trên iOS là **rủi ro cao nhất và ngoài tầm kiểm soát**: RN #56463 tố composition
CJK vỡ trên Fabric từ 0.76, PR sửa #56082 chưa merge, và RN 0.82+ **không cho tắt New
Architecture**. Giảm diện tiếp xúc: app này nhập chủ yếu tiếng Việt; ô nào có thể nhận IME Nhật
thì dùng uncontrolled (`defaultValue` + `onChangeText`, **không** feed `value` ngược lại), không
`maxLength`, `autoCorrect={false}`, `autoCapitalize="none"`. Phải E2E trên iPhone thật với bàn
phím Japanese Romaji trước khi đóng feature.

## Consequences

**Được:**

- Không service mới, không DB mới, không đổi hạ tầng deploy: vẫn một container Next.js.
- Logic domain không bị nhân đôi — mobile và MCP dùng chung `lib/`.
- Kế hoạch thoát mạnh nhất có thể: app mobile là read-replica + outbox, xoá nó đi không mất dữ
  liệu nào, và web vẫn là surface đầy đủ.
- Bất biến FSRS được gác bằng test grep và bằng việc client không có engine, không bằng niềm tin.

**Mất:**

- Một transport thứ hai phải maintain song song với MCP (giảm thiểu bằng luật "procedure là hàm
  mỏng").
- Ruby + karaoke là ~400–500 dòng tự viết, và là code chỉ chạy trên mobile nên web không bảo vệ
  được nó.
- Phụ thuộc hai bug better-auth 1.6.x cho tới khi 1.7 stable.
- IME tiếng Nhật trên iOS có thể vỡ vì lý do nằm trong React Native, không nằm trong repo này.
- Offline **ghi** chưa có chỗ dựa sản phẩm — xem "Chẻ phase".

## Chẻ phase

`limits.prFailLines` là 800 và `prWarnFiles` là 15, nên đây bắt buộc là nhiều PR nhỏ.

| Phase | Nội dung | Chặn bởi |
|---|---|---|
| **1** | tRPC transport + auth context + `expo()` plugin + procedure đọc (snapshot, stats) | — |
| **2** | Scaffold Expo + đăng nhập + màn Tiến độ đọc từ tRPC | Phase 1 |
| **3** | `FuriganaLine` + audio cache + karaoke | Phase 2 |
| **4** | Tài nguyên: list, xem, sửa nhanh | Phase 2 |
| **5** | Offline **chỉ đọc**: TanStack persist + prefetch audio. `maxAge` phải lớn hơn mặc định 24h | Phase 4 |
| **6** | Chế độ tự luyện không cần LLM (**quyết định sản phẩm, chưa chốt**) | quyết định |
| **7** | Offline **ghi** cho đúng chế độ đó: `clientEventId @unique` (migration MỚI), `occurredAt` clamp, `elapsedSec` do client đo, replay theo `(itemId, occurredAt)` | Phase 6 |

Phase 6 là một fork sản phẩm chứ không phải việc kỹ thuật, và nó phải được quyết trước Phase 7:
offline ghi mà không có bài tập sinh được offline thì không có gì để ghi.

Hai việc độc lập, nên làm trong PR riêng vì chúng là nợ có sẵn chứ không do mobile sinh ra:

- Một test ghim `TZ` (cùng input UTC phải cho cùng day key ở `TZ=UTC` và `TZ=Asia/Ho_Chi_Minh`).
- `/api/tts` **không kiểm tra đăng nhập** và đang mở trên domain công khai.

## Alternatives rejected

| Phương án | Vì sao loại |
|---|---|
| PWA / Capacitor wrapper | Người dùng chọn native thật sau khi được nêu cả ba đường và chi phí của chúng |
| Gọi server action từ RN | Bất khả thi: action ID mã hoá lúc build + tự rotate ≤14 ngày, CSRF theo `Origin`/`Host`, response là RSC Flight stream |
| Route Handler REST thủ công | Hợp lý dưới ~5 endpoint; mobile cần ~20 → type client khai tay thành nguồn drift |
| oRPC | Kỹ thuật ổn nhưng bus factor 1 (1009 commit vs 3), v2 đang public beta song song v1, repo vừa đổi org |
| Tự làm bearer token kiểu `McpKey` cho app | `AGENTS.md` cấm tự viết auth/session. better-auth có plugin Expo official |
| `bearer()` core thay vì plugin Expo | Mất `useSession` cache và mất OAuth deep-link proxy, phải tự dựng `expo-auth-session`. Giữ làm kế hoạch thoát bậc 2 |
| PowerSync · ElectricSQL · Zero · InstantDB | Đòi Postgres + logical replication. SQLite một file không có |
| Triplit | Server tự sở hữu dữ liệu (không đọc được SQLite của Prisma) + AGPL-3.0-only + client publish cuối 2025-07-31 |
| Convex | Self-host được nhưng phải viết lại toàn bộ server thành Convex function; xoá sổ Next.js + Prisma + `submitReview`. License FSL |
| WatermelonDB | Không commit từ 2025-08-11; issue "New Arch / Expo SDK 54+?" mở 2026-06-05, 0 comment; SDK 55+ không tắt được New Arch |
| RxDB | RxStorage SQLite cho RN là premium từ $99/tháng |
| Legend-State | API sync/persist cần dùng nằm ở v3, vẫn beta.48 |
| `expo-sqlite` + Drizzle ngay từ đầu | Vài trăm KB dữ liệu không cần local DB. Giữ làm bước tăng dần khi đo được nút cổ chai |
| `expo-av` | Đã bị xoá khỏi Expo SDK 55+ |
| `react-native-ruby-text` · `react-native-furi` | 2 download/tuần, v0.1.0 / không có trên npm. Bỏ rơi ngay |
| Nested `<Text>` + `lineHeight` cho ruby | RN Text là inline tuần tự, không stack được box dọc; và RN #53092 |
| `react-native-svg` cho ruby | Phải tự đo chữ và tự viết line-breaking |
| Recharts trong `"use dom"` | expo #46374 WebView trắng trên iOS, props phải serializable, không OTA |
| victory-native XL | Kéo theo Skia ~9.67 MB cho đúng 4 chart Bar+Line |
