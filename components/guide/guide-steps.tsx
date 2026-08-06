import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Layers,
  MessagesSquare,
  PenLine,
  Plug,
  SlidersHorizontal,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TutorialStep, WalkStep } from '@/components/guide/guide-walkthrough';
import { LOOP_STEPS } from '@/components/shared/loop-steps';
import {
  Bubble,
  Chip,
  CHIP_TONES,
  ClickDot,
  Field,
  iv,
  Ja,
  Window,
} from '@/components/guide/guide-primitives';

// Content for the four /guide walkthroughs. Each is a WalkStep[] (title · body · visual illustration);
// the GuideWalkthrough engine (guide-walkthrough.tsx) renders them. Vietnamese copy is intentional —
// /guide is the one surface exempt from the English-dev-artifact rule (it's end-user facing).

// --- Bắt đầu -------------------------------------------------------------------------------------

// The "Bắt đầu" tab is a TUTORIAL (Diátaxis): ONE linear path, self-sufficient, each step ending in a
// result the reader can actually observe. Since the 2026-07-21 multi-user deploy the app is a HOSTED,
// authed service — so the path starts at "open the site + log in" (NOT "run Docker on your machine"),
// then "create your personal MCP token" (step ②), then wire Claude Desktop with that token (step ③).
// Everything after ③ may freely reference prompts, because by then Claude is connected. Deeper,
// repeatable versions of these tasks live in the "Theo việc" (how-to) tab; the pasteable config + tool
// table live in "Tra cứu" (reference).

/**
 * Pasted into Claude Desktop's Project Instructions. ENGLISH on purpose: it is read by Claude, not by
 * the learner (the `verbatim` boundary rule), and it is the ONLY lever that reaches the real client.
 *
 * Why it exists. The `check_library` tool description is written in the imperative precisely so the
 * lookup fires in a blank chat with no prompt loaded — and on 2026-07-28 the supervisor tested that in
 * a real Claude Desktop chat and it does NOT: asked a bare grammar question, Claude answers from its
 * own knowledge and never touches the learner's library. Mid-session, with a protocol loaded, it does.
 * A subagent eval had scored that same question 5/5 twice; a subagent fed 64k of tool descriptions as
 * conversation text over-predicts tool use no matter how the question is framed, so the live client is
 * the only oracle (measured 2026-07-28).
 */
export const CLAUDE_PROJECT_INSTRUCTIONS = `Whenever the sakubun tools are connected, call check_library
BEFORE you explain, compare, or discuss any Japanese
grammar pattern or word - including a one-off question
with no practice session running. Answering from your own
knowledge alone silently skips this learner's own library:
their card, their review state, and the chance to add what
you just said to that card.

Show the block it returns verbatim, then explain in your
own words. Relay its numbered offers and WAIT - never write
to the library without a yes, unless an offer says auto.

When I paste a block of Japanese - an email, an article, a
few lines from anywhere - call preview_import on it before
you teach from it and before you add anything. Offering to
add it later is not the same as previewing it now: the
preview is what tells me which of these I already have,
which are suspended, and which are in the shared library.`;

export const START_STEPS: TutorialStep[] = [
  {
    progressKey: 'signedIn',
    title: 'Mở web và đăng nhập',
    need: (
      <>
        Có trình duyệt. Chưa có tài khoản thì bấm <strong>Đăng ký</strong>.
      </>
    ),
    body: (
      <>
        Mở <code>https://sakubun.thientnse.site</code> rồi đăng nhập bằng email + mật khẩu, hoặc bấm{' '}
        <strong>Tiếp tục với Google</strong> (nếu có). Chưa có tài khoản thì bấm{' '}
        <strong>Đăng ký</strong> — bạn sẽ nhận một email xác thực, bấm link trong đó là kích hoạt
        xong. Lỡ quên mật khẩu thì dùng <strong>Quên mật khẩu</strong> ở trang đăng nhập. sakubun
        chạy trên máy chủ chung, <strong>luôn bật</strong> — bạn không cần cài hay chạy gì trên máy;
        dữ liệu mỗi người tách riêng theo tài khoản.
      </>
    ),
    done: (
      <>
        Đăng nhập xong thấy trang <em>Phân tích</em> của riêng bạn.
      </>
    ),
    visual: (
      <Window title="sakubun.thientnse.site" icon={Globe}>
        <Field label="Email" i={0}>
          ban@email.com
        </Field>
        <Field label="Mật khẩu" i={1}>
          ••••••••
        </Field>
        <div className="relative flex justify-end pt-1">
          <span
            className="guide-pop inline-flex items-center rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground"
            style={iv(2)}
          >
            Đăng nhập
          </span>
          <ClickDot className="top-0 right-2" />
        </div>
      </Window>
    ),
  },
  {
    progressKey: 'mcpKey',
    title: 'Tạo token MCP',
    need: <>Bước ① xong — đã đăng nhập.</>,
    body: (
      <>
        Vào trang <em>Tài khoản → Token MCP</em>, đặt tên (vd. «laptop») rồi bấm{' '}
        <strong>Tạo token</strong>. Token <strong>chỉ hiện MỘT lần</strong> — bấm sao chép và lưu
        lại ngay. Đây là chìa khoá để Claude Desktop kết nối <strong>dưới danh nghĩa bạn</strong>;
        đừng chia sẻ. Lỡ mất thì quay lại thu hồi và tạo token mới (token cũ hết hiệu lực ngay).
      </>
    ),
    done: <>Bạn đã sao chép được một chuỗi token dài và lưu vào chỗ an toàn.</>,
    visual: (
      <Window title="Tài khoản — Token MCP" icon={KeyRound}>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted/50 px-2 py-1 text-[11px]">
            hK3n…Xy9-vQ2s…token
          </code>
          <span
            className="guide-pop relative inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground"
            style={iv(1)}
          >
            Sao chép
            <ClickDot className="top-0 -right-1" />
          </span>
        </div>
        <div className="pt-1.5">
          <Chip tone="warn" i={2}>
            chỉ hiện một lần
          </Chip>
        </div>
      </Window>
    ),
  },
  {
    progressKey: 'claudeConnected',
    title: 'Nối Claude Desktop với sakubun',
    need: <>Bước ② xong — đã có token MCP trong tay.</>,
    body: (
      <>
        Claude Desktop là gia sư, nên phải nối nó với sakubun trước khi luyện. Mở{' '}
        <em>Settings → Developer → Edit Config</em> (file <code>claude_desktop_config.json</code>),
        dán khối bên dưới vào, <strong>thay chỗ token bằng token bạn vừa tạo</strong>, rồi khởi động
        lại Claude Desktop. Bản đầy đủ + bản cho Windows nằm ở tab <em>Tra cứu</em>.
        <br />
        <br />
        <strong>Rồi dán thêm khối thứ hai vào Project Instructions</strong> (tạo một Project trong
        Claude Desktop rồi luyện trong đó). Đây không phải tuỳ chọn: khi bạn hỏi vu vơ một câu ngữ
        pháp trong chat trắng, Claude thừa sức tự trả lời nên nó <em>không</em> tra kho của bạn — và
        thế là mất phần đáng giá nhất: thẻ của chính bạn, lịch ôn của chính bạn, cùng cơ hội bồi
        thêm vào thẻ đúng thứ nó vừa giảng. Giữa buổi luyện thì nó tra bình thường; chỗ hổng nằm ở
        chat trắng, và khối này bịt đúng chỗ đó.
      </>
    ),
    done: (
      <>
        Trong khung chat của Claude Desktop, gõ <code>/</code> thấy <code>practice</code> và{' '}
        <code>quiz</code> hiện ra trong danh sách prompt. Kiểm tra luôn khối thứ hai: mở một chat{' '}
        <strong>trống</strong> trong Project rồi hỏi một câu ngữ pháp bất kỳ (ví dụ{' '}
        <Ja>〜ざるを得ない</Ja> khác <Ja>〜しかない</Ja> chỗ nào?) — Claude phải tra kho của bạn
        trước khi giảng. Nếu nó giảng luôn mà không tra, khối Project Instructions chưa vào.
      </>
    ),
    visual: (
      <div className="space-y-2">
        <Window title="claude_desktop_config.json" icon={Plug}>
          <pre className="overflow-x-auto text-[10px] leading-4">
            <code>{`"sakubun": {
  "command": "npx",
  "args": ["-y", "mcp-remote",
    `}</code>
            <code className="rounded bg-primary/15 px-1 text-primary">
              {'"https://sakubun.thientnse.site/api/mcp"'}
            </code>
            <code>{`,
    "--header",
    `}</code>
            <code className="rounded bg-ok/15 px-1 text-ok">{'"Authorization: Bearer TOKEN"'}</code>
            <code>{`]
}`}</code>
          </pre>
          <div className="pt-1">
            <Chip tone="ok" i={2}>
              <Check className="size-3" /> MCP đã kết nối
            </Chip>
          </div>
        </Window>
        {/* English on purpose: this block is pasted where CLAUDE reads it, so it follows the
            Claude-facing-text rule, while the Vietnamese narration above says what it does. */}
        <Window title="Project Instructions" icon={Plug}>
          <pre className="overflow-x-auto text-[10px] leading-4">
            <code>{CLAUDE_PROJECT_INSTRUCTIONS}</code>
          </pre>
          <div className="pt-1">
            <Chip tone="ok" i={3}>
              <Check className="size-3" /> Tra kho cả khi hỏi vu vơ
            </Chip>
          </div>
        </Window>
      </div>
    ),
  },
  {
    progressKey: 'items',
    title: 'Nhập kho ngữ pháp',
    need: <>Bước ① xong (đã đăng nhập). Chưa cần Claude cho việc này.</>,
    body: (
      <>
        Trang <em>Tài nguyên → Ngữ pháp</em>, bấm <strong>Thêm ngữ pháp</strong>: modal có ba cách —
        gõ <strong>từng mẫu theo trường</strong>, <strong>dán cả danh sách</strong>, hoặc chọn file{' '}
        <code>.xlsx</code> tải từ Mazii (dán/Excel có xem trước rồi mới nhập). Danh sách lộn xộn?
        Sau khi đã nối Claude ở bước ③, dùng prompt <code>import_grammar</code> để Claude dọn hộ.
        Kho <em>Từ vựng</em> cũng thêm y hệt ba cách đó.
      </>
    ),
    done: (
      <>
        Bảng <em>Ngữ pháp</em> hiện các mẫu vừa nhập (số dòng &gt; 0).
      </>
    ),
    visual: (
      <Window title="Ngữ pháp — Nhập" icon={FileSpreadsheet}>
        <div className="space-y-1">
          {['〜ばかりに (vì chỉ vì…) — N2', '〜わけにはいかない (không thể…) — N3'].map(
            (t, idx) => (
              <div
                key={t}
                className="guide-pop truncate rounded border bg-muted/40 px-2 py-1 text-[11px]"
                style={iv(idx)}
              >
                {t}
              </div>
            ),
          )}
        </div>
        <div className="relative flex justify-end pt-1">
          <span
            className="guide-pop inline-flex items-center rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground"
            style={iv(2)}
          >
            Nhập
          </span>
          <ClickDot className="top-0 right-2" />
        </div>
      </Window>
    ),
  },
  {
    progressKey: 'enrichment',
    title: 'Làm giàu kho (enrich)',
    need: <>Bước ③ (Claude đã nối) và bước ④ (kho đã có mẫu).</>,
    body: (
      <>
        Chạy prompt <code>enrich_backlog</code> một lần — Claude soạn «thẻ enrichment» (cách dùng,
        cụm đi kèm, ví dụ, bẫy, phân biệt mẫu gần nghĩa) cho từng mẫu; câu luyện và lời giảng sẽ sắc
        hơn hẳn.
      </>
    ),
    done: (
      <>
        Ở bảng <em>Ngữ pháp</em>, các mẫu đã enrich có icon{' '}
        <Sparkles className="inline size-3.5 align-text-bottom text-primary" aria-hidden /> — bấm
        vào để xem thẻ.
      </>
    ),
    visual: (
      <div className="w-full rounded-lg border bg-background p-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Ja>〜ばかりに</Ja>
          <Sparkles className="size-3.5 text-primary guide-float" />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip tone="primary" i={0}>
            cách dùng
          </Chip>
          <Chip tone="primary" i={1}>
            cụm đi kèm
          </Chip>
          <Chip tone="primary" i={2}>
            ví dụ
          </Chip>
          <Chip tone="warn" i={3}>
            bẫy hay gặp
          </Chip>
          <Chip tone="info" i={4}>
            phân biệt 〜せいで
          </Chip>
        </div>
      </div>
    ),
  },
  {
    progressKey: 'settingsSaved',
    title: 'Chỉnh cài đặt một lần',
    need: <>Bước ① xong.</>,
    body: (
      <>
        Trang <em>Cài đặt</em> (3 tab): <em>Nội dung</em> (cấp JLPT cho mẫu mới, trần từ vựng, hướng
        dịch, cỡ &amp; độ phức tạp câu, văn phong, chủ đề) · <em>Nhịp học</em> (mẫu mới/ngày, mẫu
        mới tối đa/câu, lượt ôn, từ vựng/câu, giờ chốt ngày, mục tiêu ghi nhớ) ·{' '}
        <em>Nghe &amp; nói</em>. Một bộ dùng chung cho cả dịch lẫn quiz.
      </>
    ),
    done: (
      <>
        Nút lưu chuyển thành <strong>«Đã lưu»</strong> và giá trị vẫn còn sau khi tải lại trang.
      </>
    ),
    visual: (
      <Window title="Cài đặt" icon={SlidersHorizontal}>
        <div className="mb-1.5 flex gap-1 text-[10px]">
          <span className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground">
            Nội dung
          </span>
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">Nhịp học</span>
          <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">Nghe &amp; nói</span>
        </div>
        <Field label="Cấp độ" i={0}>
          N3
        </Field>
        <Field label="Hướng dịch" i={1}>
          Việt → Nhật
        </Field>
        <Field label="Độ dài câu" i={2}>
          Vừa
        </Field>
      </Window>
    ),
  },
  {
    progressKey: 'firstReview',
    title: 'Buổi luyện đầu tiên',
    need: <>Bước ③ (Claude đã nối), ④ (có mẫu) và ⑥ (đã chỉnh cài đặt).</>,
    body: (
      <>
        Trong Claude Desktop chạy prompt <code>practice</code>. Claude hỏi trọng tâm (cấp/mẫu cụ
        thể, <strong>Điểm yếu</strong>, hay Ngẫu nhiên), lấy bài đến hạn, ra đề — bạn dịch — Claude
        chấm và app tự xếp lịch ôn lại. Muốn trắc nghiệm A–D thì chạy <code>quiz</code>.
      </>
    ),
    done: (
      <>
        Dịch xong một câu, Claude hiện bảng <strong>Kết quả lượt này</strong>, và trang{' '}
        <em>Lịch sử</em> trong app có thêm một dòng.
      </>
    ),
    visual: (
      <Window title="Claude Desktop" icon={MessagesSquare}>
        <Bubble from="user" i={0}>
          /practice
        </Bubble>
        <Bubble from="claude" i={1}>
          Hôm nay luyện gì? (N3 · một mẫu · Điểm yếu · Ngẫu nhiên)
        </Bubble>
        <Bubble from="user" i={2}>
          Điểm yếu
        </Bubble>
        <Bubble from="claude" i={3}>
          Dịch: “Vì chỉ vì một câu nói mà cậu ấy giận.”
        </Bubble>
      </Window>
    ),
  },
];

// --- Cách hoạt động ------------------------------------------------------------------------------

export const HOW_STEPS: WalkStep[] = [
  {
    title: LOOP_STEPS[0].title,
    body: (
      <>
        Server chọn theo lịch <strong>FSRS</strong>: mục <em>đến hạn</em> trước, rồi mục{' '}
        <em>mới</em> trong hạn mức ngày. Từ vựng bạn đã tra chạy trên ngân sách riêng, không lấn ngữ
        pháp.
      </>
    ),
    visual: (
      <div className="flex w-full flex-col items-center gap-2">
        <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
          Hàng đợi hôm nay
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Chip tone="alert" i={0}>
            <Layers className="size-3" /> 〜ばかりに · đến hạn
          </Chip>
          <Chip tone="alert" i={1}>
            〜わけには · đến hạn
          </Chip>
          <Chip tone="info" i={2}>
            〜つつある · mới
          </Chip>
          <Chip tone="ok" i={3}>
            図書館 · từ vựng
          </Chip>
        </div>
      </div>
    ),
  },
  {
    title: LOOP_STEPS[1].title,
    body: (
      <>
        Claude gộp cả lô vào <strong>một câu tự nhiên</strong> theo cài đặt của bạn — ưu tiên chạm
        đúng loại lỗi bạn hay mắc gần đây.
      </>
    ),
    visual: (
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          <Chip tone="primary" i={0}>
            〜ばかりに
          </Chip>
          <Chip tone="primary" i={1}>
            〜わけには
          </Chip>
        </div>
        <ArrowRight className="size-4 rotate-90 text-muted-foreground" />
        <div
          className="guide-pop w-full rounded-lg border bg-background p-2.5 text-xs shadow-sm"
          style={iv(2)}
        >
          <Ja>一言言ったばかりに、彼を怒らせるわけにはいかなかった。</Ja>
        </div>
      </div>
    ),
  },
  {
    title: LOOP_STEPS[2].title,
    body: (
      <>
        Gõ (hoặc nói qua voice mode) bản dịch của bạn. Sai cũng không sao — đó là dữ liệu để xếp
        lịch.
      </>
    ),
    visual: (
      <Window title="Bản dịch của bạn" icon={PenLine}>
        <div className="rounded-md border bg-background px-2.5 py-2 text-xs">
          Vì chỉ lỡ nói một câu mà tôi không thể để cậu ấy nổi giận
          <span className="guide-caret ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-foreground" />
        </div>
      </Window>
    ),
  },
  {
    title: LOOP_STEPS[3].title,
    body: (
      <>
        Claude chấm <strong>nghĩa</strong> · <strong>từng mục ngữ pháp</strong> ·{' '}
        <strong>độ tự nhiên</strong>; chỗ sai được sửa thẳng kèm một dòng quy tắc. Câu có mẫu sai
        được mời dịch lại một lần để khắc sâu.
      </>
    ),
    visual: (
      <div className="w-full space-y-1.5">
        {[
          ['Nghĩa', 'ok', 'khớp'],
          ['〜ばかりに', 'ok', 'dùng đúng'],
          ['Độ tự nhiên', 'warn', 'hơi cứng — nên bỏ “chỉ”'],
        ].map(([label, tone, note], idx) => (
          <div
            key={label}
            className="guide-pop flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-[11px]"
            style={iv(idx)}
          >
            {tone === 'ok' ? (
              <Check className="size-3.5 shrink-0 text-ok" />
            ) : (
              <span className="size-3.5 shrink-0 rounded-full border-2 border-warn" />
            )}
            <span className="font-medium">{label}</span>
            <span className="ml-auto text-muted-foreground">{note}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: LOOP_STEPS[4].title,
    body: (
      <>
        Mỗi mục nhận một tín hiệu (như Anki) quyết định lần ôn kế tiếp. Dịch sai → mục tự quay lại
        hàng đợi. Hết bài trong ngày → chuyển <strong>chế độ luyện thành thạo</strong> thay vì dừng.
      </>
    ),
    visual: (
      <div className="grid w-full grid-cols-2 gap-1.5">
        {[
          ['1 Again', 'alert', '~1 phút'],
          ['2 Hard', 'warn', 'ngắn'],
          ['3 Good', 'ok', 'chuẩn'],
          ['4 Easy', 'info', '~8 ngày'],
        ].map(([label, tone, gap], idx) => (
          <div
            key={label}
            className={cn(
              'guide-pop flex items-center justify-between rounded-md border px-2.5 py-1.5 text-[11px]',
              CHIP_TONES[tone as keyof typeof CHIP_TONES],
            )}
            style={iv(idx)}
          >
            <span className="font-semibold">{label}</span>
            <span className="opacity-80">{gap}</span>
          </div>
        ))}
      </div>
    ),
  },
];

// --- Anki ----------------------------------------------------------------------------------------

export const ANKI_STEPS: WalkStep[] = [
  {
    title: 'Tuỳ chọn — mặc định học trong app',
    body: (
      <>
        Từ vựng mặc định ôn ngay trong sakubun (tool <code>add_vocab</code>). Phần này chỉ dành cho
        ai muốn ôn thêm bằng <strong>Anki</strong> — hai đường độc lập, bạn tải bộ thẻ về máy mình
        nên dùng sakubun từ xa vẫn được.
      </>
    ),
    visual: (
      <div className="flex w-full items-center justify-center gap-3">
        <div
          className="guide-pop rounded-lg border bg-background px-3 py-2 text-center text-[11px]"
          style={iv(0)}
        >
          <BadgeCheck className="mx-auto size-4 text-ok" />
          Trong sakubun
          <div className="text-muted-foreground">FSRS · dệt vào câu</div>
        </div>
        <span className="text-[11px] text-muted-foreground">hoặc</span>
        <div
          className="guide-pop rounded-lg border bg-background px-3 py-2 text-center text-[11px]"
          style={iv(1)}
        >
          <Layers className="mx-auto size-4 text-info" />
          Sang Anki
          <div className="text-muted-foreground">deck “sakubun”</div>
        </div>
      </div>
    ),
  },
  {
    title: 'Tải bộ thẻ về máy',
    body: (
      <>
        Vào <em>Cài đặt → Dữ liệu → Tải bộ thẻ Anki</em>. Bạn nhận một tệp <code>.apkg</code> chứa
        toàn bộ từ vựng đã lưu — không cần add-on, không cần mở sẵn Anki.
      </>
    ),
    visual: (
      <Window title="sakubun — Cài đặt › Dữ liệu" icon={SlidersHorizontal}>
        <div className="text-[11px] text-muted-foreground">Xuất sang Anki</div>
        <div className="relative flex items-center gap-2">
          <span
            className="guide-pop inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground"
            style={iv(1)}
          >
            <Layers className="size-3" />
            Tải bộ thẻ Anki
          </span>
          <ClickDot className="top-0 right-1" />
        </div>
        <div className="text-[10px] text-muted-foreground">sakubun-vocab-2026-07-23.apkg</div>
      </Window>
    ),
  },
  {
    title: 'Mở tệp bằng Anki',
    body: (
      <>
        Bấm đúp vào tệp vừa tải (hoặc <em>File → Import</em> trong Anki). Thẻ vào thẳng deck{' '}
        <code>sakubun</code>: mặt trước là từ, mặt sau gồm cách đọc · âm Hán Việt · nghĩa · câu ví
        dụ. Lần tải sau sẽ cập nhật thẻ cũ, không tạo thẻ trùng.
      </>
    ),
    visual: (
      <div className="flex w-full gap-2">
        <div
          className="guide-pop flex-1 rounded-lg border bg-background p-2 text-center"
          style={iv(0)}
        >
          <div className="text-[9px] tracking-wide text-muted-foreground uppercase">Mặt trước</div>
          <Ja>
            <span className="text-lg">図書館</span>
          </Ja>
        </div>
        <div
          className="guide-pop flex-1 rounded-lg border border-primary/30 bg-primary/5 p-2 text-center text-[11px] leading-4"
          style={iv(1)}
        >
          <div className="text-[9px] tracking-wide text-muted-foreground uppercase">Mặt sau</div>
          としょかん · Đồ Thư Quán
          <div className="text-muted-foreground">thư viện</div>
        </div>
      </div>
    ),
  },
];

// --- MCP -----------------------------------------------------------------------------------------

export const MCP_STEPS: WalkStep[] = [
  {
    title: 'Mở Edit Config',
    body: (
      <>
        Trong Claude Desktop: <em>Settings → Developer → Edit Config</em> — mở file{' '}
        <code>claude_desktop_config.json</code>.
      </>
    ),
    visual: (
      <Window title="Claude Desktop — Settings" icon={SlidersHorizontal}>
        <Field label="Developer" i={0}>
          <span className="relative inline-flex items-center rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
            Edit Config
            <ClickDot className="top-1/2 -right-3 -translate-y-1/2" />
          </span>
        </Field>
        <div className="guide-pop text-[10px] text-muted-foreground" style={iv(1)}>
          claude_desktop_config.json
        </div>
      </Window>
    ),
  },
  {
    title: 'Dán cấu hình sakubun',
    body: (
      <>
        Trỏ tới endpoint <code>sakubun.thientnse.site/api/mcp</code> qua <code>mcp-remote</code>,
        kèm header <code>Authorization: Bearer &lt;token&gt;</code> (token lấy ở trang{' '}
        <em>Tài khoản</em>). Windows: nếu lỗi spawn npx, dùng bản <code>cmd /c</code> ở phần tham
        khảo bên dưới.
      </>
    ),
    visual: (
      <Window title="claude_desktop_config.json" icon={Terminal}>
        <pre className="overflow-x-auto text-[10px] leading-4">
          <code>{`"sakubun": {
  "command": "npx",
  "args": ["-y", "mcp-remote",
    `}</code>
          <code className="rounded bg-primary/15 px-1 text-primary">
            {'"https://sakubun.thientnse.site/api/mcp"'}
          </code>
          <code>{`,
    "--header",
    `}</code>
          <code className="rounded bg-ok/15 px-1 text-ok">{'"Authorization: Bearer TOKEN"'}</code>
          <code>{`]
}`}</code>
        </pre>
      </Window>
    ),
  },
  {
    title: 'Khởi động lại & chọn prompt',
    body: (
      <>
        Mở lại Claude Desktop (cần có mạng — máy chủ luôn bật sẵn). Trong khung chat, danh sách
        prompt của sakubun xuất hiện — chọn <code>practice</code> hoặc <code>quiz</code> để bắt đầu.
      </>
    ),
    visual: (
      <Window title="Claude Desktop" icon={MessagesSquare}>
        {['practice', 'quiz', 'story_practice', 'import_grammar', 'enrich_backlog'].map(
          (p, idx) => (
            <div
              key={p}
              className="guide-pop flex items-center gap-2 rounded border bg-muted/30 px-2 py-1 text-[11px]"
              style={iv(idx)}
            >
              <MessagesSquare className="size-3 text-primary" />
              <code>{p}</code>
            </div>
          ),
        )}
      </Window>
    ),
  },
  {
    title: 'Sẵn sàng — Claude là gia sư',
    body: (
      <>
        Xong. Claude giờ đọc cài đặt, lấy bài đến hạn, ra đề, chấm và ghi lịch FSRS qua bộ tool +
        prompt của sakubun. Xem bảng đầy đủ ở tab <em>Tra cứu</em>.
      </>
    ),
    visual: (
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {[
            ['get_settings', 'muted'],
            ['get_due_items', 'primary'],
            ['stage_sentence', 'primary'],
            ['submit_review', 'ok'],
            ['add_vocab', 'info'],
            ['get_weak_report', 'warn'],
          ].map(([name, tone], idx) => (
            <Chip key={name} tone={tone as keyof typeof CHIP_TONES} i={idx}>
              <code>{name}</code>
            </Chip>
          ))}
        </div>
        <Chip tone="ok" i={6}>
          <Check className="size-3" /> MCP đã kết nối
        </Chip>
      </div>
    ),
  },
];
