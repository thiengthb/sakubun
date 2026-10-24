/**
 * OKLCH -> linear sRGB -> độ sáng tương đối WCAG -> tỉ số tương phản.
 *
 * Thuần số học, không browser, không screenshot, không LLM chấm ảnh: một "yêu cầu thẩm mỹ" biến
 * thành một check tất định. Ma trận của Björn Ottosson.
 */

/** oklch(L C H [/ A]) -> [r,g,b] trong linear sRGB, đã clamp về [0,1]. */
export function oklchToLinearRgb(value) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!m) throw new Error(`không phải màu oklch(): ${value}`);
  const [L, C, hDeg] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m2 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m2 + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m2 - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m2 + 1.707614701 * s),
  ];
}

/** Độ sáng tương đối WCAG. Linear sRGB đã đúng dạng công thức cần. */
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Tỉ số tương phản WCAG 2.x giữa hai màu oklch(). */
export function contrast(fg, bg) {
  const a = luminance(oklchToLinearRgb(fg));
  const b = luminance(oklchToLinearRgb(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ngoài gamut sRGB? Dùng để cảnh báo token khai màu máy không hiện được. */
export function outOfGamut(value) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (!m) return false;
  const [L, C, hDeg] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m2 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const raw = [
    4.0767416621 * l - 3.3077115913 * m2 + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m2 - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m2 + 1.707614701 * s,
  ];
  return raw.some((v) => v < -0.002 || v > 1.002);
}

/**
 * Giải L cao nhất (hoặc thấp nhất, ở dark) mà một màu còn vượt `target` trên MỌI nền trong `grounds`.
 * Đây là công cụ để SỬA một token trượt cổng, thay vì mò bằng tay — sakubun giải mấy giá trị này
 * bằng tay rồi ghi kết quả vào comment, nên con số đúng một lần rồi mục dần.
 */
export function solveLightness(chroma, hue, grounds, target = 4.5, { prefer = 'light' } = {}) {
  const ok = (L) => grounds.every((g) => contrast(`oklch(${L} ${chroma} ${hue})`, g) >= target);
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // ở light ta muốn L LỚN nhất còn đạt; ở dark ta muốn L NHỎ nhất còn đạt
    if (prefer === 'light') (ok(mid) ? (lo = mid) : (hi = mid));
    else (ok(mid) ? (hi = mid) : (lo = mid));
  }
  const L = prefer === 'light' ? lo : hi;
  return ok(L) ? Number(L.toFixed(4)) : null;
}
