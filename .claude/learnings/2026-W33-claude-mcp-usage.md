# 2026-W33 · claude · bộ đếm tool MCP

Tên file có hậu tố vì `2026-W33-claude.md` đang nằm ở nhánh của PR #12 chưa merge. Hai file cùng tên
trên hai nhánh là cái duy nhất làm thư mục "không bao giờ conflict" này conflict.

---

## Đoán hình dạng của một thông điệp lỗi, thay vì đo nó — hai lần e2e đỏ liền

**Triệu chứng:** cột `lastError` của bảng đếm mới. Bản đầu lưu `e.message` cắt 400 ký tự **từ đầu**, và
lưu được đúng 400 ký tự `__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$db…` — mất sạch câu có
nghĩa. Bản sửa thứ nhất cho rằng dump của Prisma tách các phần bằng **dòng trắng** nên lấy đoạn cuối;
e2e đỏ lần hai, vì nó tách bằng một dòng xuống, không phải dòng trắng.

**Lớp lỗi:** verification

**Điều đáng giữ:** cả hai lần tôi đều có sẵn phép đo trong tay — lần chạy e2e trước đó đã in nguyên
`lastError` ra output khi đỏ — và cả hai lần tôi vẫn viết luật cắt theo hình dạng tôi *tưởng*. Khi thứ
sắp được LƯU hoặc PARSE là output của một thư viện khác, hình dạng của nó là dữ liệu, không phải suy
luận: dán mẫu thật vào test trước, rồi viết luật cho mẫu đó. Bản cuối (`errorDigest`) mang nguyên dump
thật vào unit test và chốt bằng `toBe(...)`, nên lần sau Prisma đổi định dạng thì unit test đỏ ở chỗ
rẻ, không phải e2e đỏ ở chỗ đắt.

**Chi phí:** hai lần chạy `npx playwright test e2e/mcp.spec.ts` (~30 giây mỗi lần) và hai lượt sửa.
Rẻ — nhưng đây là **lần thứ hai trong tuần** cùng một lớp lỗi (lần trước: kết luận về catalog drift
mà không đo). Nếu còn lần thứ ba thì nó thành `/harness-propose`, không phải một bài học nữa.

---

## Click vào tab Radix TRƯỚC khi React hydrate xong: trôi mất trong im lặng

**Triệu chứng:** `page.goto('/settings')` rồi `getByRole('tab', { name: 'Tài khoản' }).click()` — click
chạy, không lỗi, và 10 giây sau phép chốt đỏ. Snapshot lúc thất bại cho thấy tab **"Nội dung" vẫn đang
được chọn**: Playwright thấy phần tử và bấm được, nhưng handler của React chưa gắn.

**Lớp lỗi:** verification

**Điều đáng giữ:** auto-wait của Playwright chờ phần tử *bấm được*, không chờ nó *có người nghe*. Với
component client mount sau hydration, cách đúng là bấm-rồi-thử-lại tới khi thấy hệ quả:

```ts
await expect(async () => {
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Tài khoản' })).toBeVisible({ timeout: 2000 });
}).toPass({ timeout: 30_000 });
```

`e2e/critical-path.spec.ts` bấm tab ngay sau `goto` mà xanh — nó xanh vì trước đó có một phép chốt trên
trang khác, tức nó đang **may**, không phải đang đúng. Đó là loại flake ngủ đông trong CI.
