# sakubun mobile

App Expo cho sakubun. Quyết định kiến trúc: `docs/adr/0001-mobile-app-architecture.md`.

## Chạy

```
npm install
npx expo start
```

Mặc định app gọi vào `https://sakubun.thientnse.site` (`lib/config.ts`). Trỏ đi chỗ khác bằng
`EXPO_PUBLIC_API_URL`, và nhớ rằng trên điện thoại `localhost` là **cái điện thoại** — phải dùng địa
chỉ LAN của máy chạy server, và thêm đúng origin đó vào `BETTER_AUTH_TRUSTED_ORIGINS`.

## Kiểm tra

```
npm run verify     # tsc --noEmit && eslint .
npx expo export --platform android
```

`expo export` **không phải tuỳ chọn** trước khi kết luận là xong. Nó là bước duy nhất bắt được
dependency thiếu mà typecheck bỏ qua: `@better-auth/expo/client` import động `expo-network`, và lỗi
đó chỉ lộ ra lúc bundle. Nó cũng là chỗ đo được ranh giới server/client — quét file `.hbc` sinh ra,
không được có `PrismaClient`, `@prisma`, `better-sqlite3`, `submitReview` hay `ts-fsrs`.

## Expo Go KHÔNG đăng nhập Google được

Đo ngày 2026-08-06, trên production:

| `callbackURL` gửi lên | Kết quả |
|---|---|
| `sakubun://` | 200 |
| `exp://<ip>:8081/--/` | **403 `Invalid callbackURL`** |

Trong Expo Go, app **không sở hữu** scheme `sakubun://` — Expo Go sở hữu `exp://`. Nên plugin
better-auth đặt callback thành `exp://<ip>:8081/--/`, và `trustedOrigins` (`lib/auth.ts`) chỉ tin
`exp://` khi `NODE_ENV=development`. Production thì không.

Đừng "sửa" bằng cách tin `exp://` trên production: plugin Expo **gắn cookie phiên vào chính deep
link redirect đó**, nên tin một origin ở đây là giao phiên đăng nhập cho origin đó.

Cách đúng là build thật — bản build sở hữu `sakubun://`, mà `trustedOrigins` đã tin sẵn.

## Build APK

```
npx eas-cli login          # một lần, cần tài khoản Expo
npx eas-cli init           # ghi projectId vào app.json
npx eas-cli build --platform android --profile preview
```

Profile `preview` (`eas.json`) sinh **APK** cài thẳng vào máy, không phải AAB của store, và không
kèm dev client — nó gọi vào production như một app thật.

Build chạy trên hạ tầng của Expo, tức mã nguồn được tải lên đó.
