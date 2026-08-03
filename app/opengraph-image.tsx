// rulebook-allow-file: hardcoded-color — rendered to PNG by Satori, outside the browser, where CSS
// variables do not exist; the palette below has to be literal.
import { ImageResponse } from 'next/og';

/**
 * The social-share card for "/" — what a pasted sakubun link looks like in a chat or a post. Next wires
 * this file into `openGraph.images` automatically (and `twitter.images` via the metadata in page.tsx).
 *
 * Generated as CODE, not a checked-in binary, so it can never drift from the product's own words: the
 * tagline and the proof line are the same claims the landing makes.
 *
 * Two constraints of the renderer (satori) shaped this design:
 *   - No CSS variables and no Tailwind — colors must be LITERAL here. `#CA653C` is `oklch(0.62 0.14 42)`
 *     (the app's `--primary`) converted to sRGB, so the card matches the app exactly. This is the reason
 *     `docs/ui-patterns.json` allow-lists this one file for `no-hardcoded-colors`.
 *   - Only the bundled Latin font is available, so NO Japanese: the 作文 brand mark would render as tofu.
 *     The card uses the "sakubun" wordmark instead.
 */
export const alt = 'sakubun — luyện dịch Nhật–Việt, Claude Desktop chấm từng câu';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND = '#CA653C';
const INK = '#1C1917';
const MUTED = '#57534E';
const PAPER = '#FAF9F7';

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: PAPER,
        padding: '72px 80px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: BRAND,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PAPER,
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          s
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: INK, letterSpacing: -1 }}>
            sakubun
          </div>
          <div style={{ fontSize: 22, color: MUTED }}>Luyện dịch Nhật–Việt</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            fontSize: 68,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: -2,
            maxWidth: 940,
          }}
        >
          {/* satori needs an explicit display on any element with more than one child node. */}
          <span>Bạn dịch từng câu.</span>
          <span style={{ color: BRAND }}>Claude chấm từng câu.</span>
        </div>
        <div style={{ fontSize: 28, color: MUTED, maxWidth: 900, lineHeight: 1.4 }}>
          Kho mẫu ngữ pháp của bạn + lịch ôn FSRS. Claude Desktop ra đề, chấm điểm và sửa lỗi qua
          MCP.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22, color: MUTED }}>
        <span style={{ color: BRAND, fontWeight: 700 }}>FSRS</span>
        <span>·</span>
        <span style={{ color: BRAND, fontWeight: 700 }}>MCP</span>
        <span>·</span>
        <span>xuất được sang Anki</span>
        <span>·</span>
        <span>dữ liệu trên máy chủ của bạn</span>
      </div>
    </div>,
    size,
  );
}
