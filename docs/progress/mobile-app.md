# mobile-app — App mobile native (Expo) cho sakubun

owner: @thi3n · branch: đã merge vào `main` · worktree: — · platforms trong scope: android, ios, api

<!-- APPEND-ONLY. Đừng sửa mục cũ. -->

## 2026-08-06 (session 1, Claude)

- **ĐÃ LÀM**
  - `/research-first` với 3 khảo sát song song → `docs/adr/0001-mobile-app-architecture.md`
    (7 quyết định + 20 phương án bị loại kèm lý do). Đọc ADR trước, đừng đọc lại code để suy ra.
  - `4d00331` phase 1 — transport tRPC (`lib/trpc/*`, `app/api/trpc/[trpc]/route.ts`),
    `expo()` vào `lib/auth.ts`, `lib/mobile-snapshot.ts`.
  - `ae0b8dd` phase 2 — scaffold Expo trong `mobile/`, đăng nhập, màn hình đầu,
    `lib/mobile-imports.test.ts` (gác ranh giới server/client).
  - `56d29b3` procedure `stats` + màn Tiến độ (`lib/mobile-stats.ts`).
  - `2fa3902` hạ SDK 57 → **54** cho khớp Expo Go trên Play Store (xem "Sửa đổi 1" trong ADR).
  - `a40b276` đăng nhập Google + `authConfig` (publicProcedure).
  - `33ebcac` loại `mobile/` khỏi Docker build context.
  - `79459a4` `mobile/README.md` + `eas.json`. `37532a1` liên kết project EAS.
  - **Đã deploy production** (image build lại, backup `sakubun-before-mobile-20260806-151955.tar.gz`).
    Dữ liệu nguyên vẹn: Item 84 · SrsState 84 · ReviewLog 228 · Sentence 97 · user 1.
  - **APK đã build**: build `290d8fa7-c97e-4f3c-9c9b-0568d55468bc`, tải ở
    `https://expo.dev/artifacts/eas/jHNYjPiC63B2BmKb32S_Gt9JtyaaGH6Spa-61PNoRXc.apk`

- **ĐANG VƯỚNG — đây là thứ chặn mọi thứ phía sau**
  - **Chưa có bằng chứng thiết bị.** `ios`/`android` phải coi là FAIL. Máy Android hiện có của chủ
    repo quá cũ (trình duyệt không chạy bình thường) nên không kiểm chứng được, đang tìm máy mới.
    Trình duyệt hỏng còn chặn riêng luồng Google: OAuth mở trình duyệt hệ thống rồi mới quay về app.
  - Đã chạy được tới đâu trên máy thật: app **nạp được trong Expo Go, render màn đăng nhập**.
    Chưa ai đăng nhập thành công bằng ngón tay.

- **TIẾP THEO khi có thiết bị** (theo đúng thứ tự, mỗi bước là một câu trả lời cần lấy)
  1. Cài APK ở link trên. Đăng nhập bằng Google với `tranngocthien024@gmail.com`.
     Tài khoản này **không có mật khẩu** — chỉ có dòng account `providerId: 'google'`.
  2. Câu hỏi 1: đăng nhập xong có vào thẳng màn Tiến độ không, hay đứng lại tới khi kill app?
     Đó là better-auth #10545; đã né bằng `router.replace()` tay thay vì chờ `useSession`
     (`mobile/app/login.tsx`). Nếu vẫn đứng thì workaround chưa đủ.
  3. Câu hỏi 2: chữ Nhật (`〜ばかりに`, `図書館`) có ra glyph Nhật không, hay glyph Trung?
     Nếu sai → nhúng Noto Sans JP qua config plugin của `expo-font`, và set `fontFamily`
     CHỈ trong component furigana (ADR quyết định 7). Chưa nhúng vì font 9.15 MB.
  4. Xong hai câu đó mới làm phase 3 (`FuriganaLine` + audio + karaoke, ~400-500 dòng tự viết).

- **QUYẾT ĐỊNH đã chốt**
  - Tất cả trong ADR 0001. Ba cái hay bị quên nhất:
    - **Không dùng transformer cho tRPC.** Mỗi procedure khai `.output()` Zod với ISO string.
      Có test chứng minh schema bắt được `Date` lọt ra, kèm path của issue.
    - **Client không được có engine FSRS.** `lib/mobile-imports.test.ts` chặn `ts-fsrs` trong
      `mobile/**`, và chặn mọi import runtime từ `@/` (chỉ `import type` được qua).
    - **Expo Go KHÔNG đăng nhập Google được** — đo rồi, không phải phỏng đoán: callbackURL
      `exp://<ip>:8081/--/` trả 403 `Invalid callbackURL`. Lý do + vì sao KHÔNG được "sửa" bằng
      cách tin `exp://` trên production: `mobile/README.md`.

- **BẪY đã trả giá, đừng lặp lại**
  - `.dockerignore`: pattern không có dấu `/` **chỉ khớp ở gốc context**. `node_modules` chưa bao giờ
    khớp `mobile/node_modules`. Đã loại thẳng `mobile`.
  - `npx expo export` là **bắt buộc** trước khi kết luận: nó là chỗ duy nhất bắt được `expo-network`
    thiếu (`@better-auth/expo/client` import động nó), và là chỗ đo ranh giới trên chính file bundle.
  - Alias: `@/*` trong `mobile/tsconfig.json` phải trỏ **ra gốc repo**, không vào `mobile/`.
    `expo start` sẽ xoá comment trong tsconfig — lời giải thích nằm ở `mobile/lib/api.ts`.
  - Next 16 **không cho hai dev server trong cùng thư mục** → không chạy `npm run dev` và
    `npx playwright test` cùng lúc.
  - Chạy gate trong lúc Metro + dev server đang tranh CPU gây flake
    "Worker exited unexpectedly" sau khi mọi test đã pass.

- **NỢ ĐỘC LẬP, làm được ngay không cần thiết bị**
  - Test ghim `TZ`: `studyDayKey` (`lib/streak.ts`) và `studyDayStart` (`lib/select.ts:294`) dùng giờ
    local; thứ duy nhất giữ đúng trên production là `ENV TZ=Asia/Ho_Chi_Minh` ở `Dockerfile:68`,
    và **không có test nào gác**.
  - `/api/tts` **không kiểm tra đăng nhập** và đang mở trên domain công khai.
  - `features/` chưa có file cho app mobile (`features/_index.json` chỉ DRI sửa được).
