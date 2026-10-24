/**
 * Cổng tương phản WCAG trên TOKEN, cho mọi theme × mọi mode.
 *
 * Khác hai điểm so với bản trong sakubun, và cả hai là sửa lỗi thật:
 *
 *  1. ĐỌC DỮ LIỆU, KHÔNG PARSE CSS. Bản cũ đọc `app/globals.css` theo TỪNG DÒNG, nên một lần
 *     `prettier --write` gấp dòng khai `--muted-foreground` thành ba đã làm 4 ca đỏ với
 *     `TypeError: ... reading 'startsWith'`, và lập tức sinh ra một chú thích "GIỮ TRÊN MỘT DÒNG"
 *     trong file CSS. Cổng nào mà format code làm vỡ được thì không phải cổng. Bản này đọc
 *     `@thienui/tokens/tokens.json` — dữ liệu đã resolve.
 *
 *  2. MA TRẬN, KHÔNG PHẢI DANH SÁCH CẶP. Bản cũ chỉ kiểm những cặp được KHAI TAY trong TEXT_PAIRS,
 *     nên một badge `--warn` đặt trên `--card` không ai kiểm trong khi test tưởng là đã phủ. Bản này
 *     khai CHÍNH SÁCH GHÉP (token chữ nào thực tế xuất hiện trên mặt nào) rồi tự sinh tổ hợp.
 *     Thêm một mặt mới là mọi token chữ tự được kiểm trên nó.
 */
import { contrast, outOfGamut } from './oklch.mjs';

/**
 * Sàn WCAG 2.2: 1.4.3 chữ thường 4.5:1 · 1.4.11 phi-chữ 3:1.
 *
 * Bậc thứ ba, `decor`, KHÔNG có sàn — và nó không phải một cửa hậu. WCAG 1.4.11 áp cho "thông tin
 * thị giác CẦN THIẾT để nhận ra một component hoặc trạng thái của nó", nên nó MIỄN TRỪ phần trang trí
 * và phần không mang thông tin. Một đường kẻ sợi tóc giữa hai dòng bảng là trang trí: bỏ nó đi thì
 * bảng vẫn đọc được. Còn viền của một ô nhập thì KHÔNG trang trí — nó là thứ duy nhất cho biết ô đó
 * ở đâu, nên nó chịu sàn 3:1. Ranh giới là "bỏ nó đi thì còn nhận ra control không", không phải
 * "nó có phải một đường kẻ không". Bậc `decor` vẫn ĐƯỢC ĐO và báo cáo, chỉ không làm đỏ.
 */
export const AA_TEXT = 4.5;
export const AA_GRAPHIC = 3.0;
export const FLOOR = { text: AA_TEXT, graphic: AA_GRAPHIC, decor: 0 };

/** Mọi mặt mà nội dung có thể nằm trên. Thêm một mặt ở đây = mọi token chữ được kiểm trên nó. */
const SURFACES = ['background', 'card', 'popover', 'sidebar', 'muted', 'secondary', 'accent'];

/**
 * CHÍNH SÁCH GHÉP. `on` = danh sách mặt mà token này THỰC TẾ được render lên.
 * `tier` = 'text' (4.5:1) hoặc 'graphic' (3:1) — chọn theo CÁCH DÙNG, không theo cái gì dễ pass.
 */
export const POLICY = [
  // Chữ thân bài: xuất hiện trên MỌI mặt, nên kiểm trên mọi mặt.
  { token: 'foreground', on: SURFACES, tier: 'text', where: 'chữ thân bài' },
  { token: 'muted-foreground', on: SURFACES, tier: 'text', where: 'chữ phụ — màu chữ được dùng nhiều nhất trong app' },

  // Cặp riêng của từng mặt.
  { token: 'card-foreground', on: ['card'], tier: 'text', where: 'chữ trong card' },
  { token: 'popover-foreground', on: ['popover'], tier: 'text', where: 'chữ trong popover/menu' },
  { token: 'secondary-foreground', on: ['secondary'], tier: 'text', where: 'nhãn nút secondary' },
  { token: 'accent-foreground', on: ['accent'], tier: 'text', where: 'nhãn phần tử đang hover/selected' },
  { token: 'sidebar-foreground', on: ['sidebar'], tier: 'text', where: 'chữ trong sidebar' },
  { token: 'sidebar-accent-foreground', on: ['sidebar-accent'], tier: 'text', where: 'nhãn mục sidebar đang chọn' },
  { token: 'primary-foreground', on: ['primary'], tier: 'text', where: 'nhãn trên nút primary' },
  { token: 'destructive-foreground', on: ['destructive'], tier: 'text', where: 'nhãn trên nút phá hoại' },
  { token: 'sidebar-primary-foreground', on: ['sidebar-primary'], tier: 'text', where: 'nhãn trên nút primary trong sidebar' },

  // Link và 4 token tín hiệu: chúng là CHỮ, nên 4.5:1 — kể cả khi trông như badge.
  { token: 'accent-brand', on: ['background', 'card', 'popover', 'sidebar', 'muted'], tier: 'text', where: 'link, chữ thương hiệu' },
  { token: 'ok', on: ['background', 'card', 'popover', 'muted', 'ok-wash'], tier: 'text', where: 'tín hiệu đúng' },
  { token: 'warn', on: ['background', 'card', 'popover', 'muted', 'warn-wash'], tier: 'text', where: 'tín hiệu một phần' },
  { token: 'alert', on: ['background', 'card', 'popover', 'muted', 'alert-wash'], tier: 'text', where: 'tín hiệu sai' },
  { token: 'info', on: ['background', 'card', 'popover', 'muted', 'info-wash'], tier: 'text', where: 'tín hiệu dễ/đã thuộc' },
  { token: 'destructive', on: ['background', 'card', 'popover'], tier: 'text', where: 'chữ cảnh báo phá hoại' },

  // Phi-chữ: viền, ring, nền đặc. Sàn 3:1.
  // `border` = đường phân tách trang trí: bỏ đi vẫn đọc được nội dung -> miễn trừ 1.4.11, chỉ ĐO.
  { token: 'border', on: ['background', 'card', 'popover', 'sidebar'], tier: 'decor', where: 'viền, đường phân tách — trang trí' },
  // `input` = viền CỦA MỘT CONTROL: nó là thứ duy nhất cho biết ô nhập ở đâu -> chịu sàn 3:1.
  { token: 'input', on: ['background', 'card'], tier: 'graphic', where: 'viền ô nhập — ranh giới của control' },
  { token: 'ring', on: ['background', 'card', 'popover', 'sidebar'], tier: 'graphic', where: 'focus ring — phải thấy được, nếu không bàn phím thành vô dụng' },
  { token: 'sidebar-ring', on: ['sidebar'], tier: 'graphic', where: 'focus ring trong sidebar' },
  { token: 'primary', on: ['background', 'card'], tier: 'graphic', where: 'nền nút primary' },
  { token: 'chart-1', on: ['background', 'card'], tier: 'graphic', where: 'chuỗi biểu đồ 1' },
  { token: 'chart-2', on: ['background', 'card'], tier: 'graphic', where: 'chuỗi biểu đồ 2' },
  { token: 'chart-3', on: ['background', 'card'], tier: 'graphic', where: 'chuỗi biểu đồ 3' },
  { token: 'chart-4', on: ['background', 'card'], tier: 'graphic', where: 'chuỗi biểu đồ 4' },
  { token: 'chart-5', on: ['background', 'card'], tier: 'graphic', where: 'chuỗi biểu đồ 5' },
];

/**
 * Miễn trừ, kèm LÝ DO. Không có lý do thì không được miễn trừ, và một cặp chữ không được
 * chuyển xuống bậc đồ hoạ cho cổng im tiếng — phải sửa token.
 */
export const ALLOW = {
  'claude/*/primary on background':
    'Clay #D97757 trên trang kem đo 2.97:1 — thiếu 0.03 so với sàn 3:1. KHÔNG đổi màu: đây là đúng mã thương hiệu, và sakubun đã giữ nó có chủ ý. Lý do miễn trừ: nút primary luôn mang NHÃN CHỮ ở 5.89:1, nên phần nền không phải thứ duy nhất nhận ra control — 1.4.11 không đòi 3:1 cho một bề mặt đã được nhãn của nó định danh. Miễn trừ này KHÔNG áp cho biểu đồ: ở đó màu LÀ dữ liệu, nên chart-1 dùng bậc `text` của clay (5.40:1) chứ không dùng bậc `solid`.',
  'claude/*/primary-foreground on primary':
    'Lệch CÓ Ý: Claude ship chữ TRẮNG trên clay (3.12:1, dưới sàn). Ta giữ đúng #D97757 và đổi nhãn sang ink #141413 = 5.89:1. Nút đúng màu, nhãn tối. Cặp này PASS — mục này chỉ để ghi lại quyết định.',
};

/** Chạy cổng. Trả về { pass, results, failures }. Không throw — người gọi quyết định làm gì. */
export function checkContrast(tokens, { policy = POLICY, allow = ALLOW } = {}) {
  const results = [];
  for (const [themeName, modes] of Object.entries(tokens.themes)) {
    for (const [mode, t] of Object.entries(modes)) {
      for (const rule of policy) {
        const fg = t[rule.token];
        if (!fg) {
          results.push({ theme: themeName, mode, fg: rule.token, bg: '—', ratio: 0, floor: 0, pass: false,
            reason: `token "--${rule.token}" không tồn tại trong theme`, where: rule.where });
          continue;
        }
        for (const bgName of rule.on) {
          const bg = t[bgName];
          if (!bg) {
            results.push({ theme: themeName, mode, fg: rule.token, bg: bgName, ratio: 0, floor: 0, pass: false,
              reason: `mặt "--${bgName}" không tồn tại trong theme`, where: rule.where });
            continue;
          }
          const floor = FLOOR[rule.tier];
          const ratio = contrast(fg, bg);
          const key = `${themeName}/${mode}/${rule.token} on ${bgName}`;
          const wild = `${themeName}/*/${rule.token} on ${bgName}`;
          results.push({
            theme: themeName, mode, fg: rule.token, bg: bgName, tier: rule.tier,
            ratio: Number(ratio.toFixed(3)), floor, pass: ratio >= floor,
            allowed: allow[key] ?? allow[wild] ?? null, where: rule.where,
          });
        }
      }
    }
  }
  const failures = results.filter((r) => !r.pass && !r.allowed);
  return { pass: failures.length === 0, results, failures };
}

/** Token nào khai màu ngoài gamut sRGB — máy không hiện được đúng màu đó. */
export function checkGamut(tokens) {
  const bad = [];
  for (const [path, v] of Object.entries(tokens.primitive)) {
    if (typeof v !== 'string' || !v.startsWith('oklch(')) continue;
    if (outOfGamut(v)) bad.push({ path, value: v });
  }
  return { pass: bad.length === 0, outOfGamut: bad };
}
