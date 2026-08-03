'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  Check,
  CircleSlash,
  Download,
  Globe2,
  GraduationCap,
  Languages,
  LineChart,
  ListChecks,
  PenLine,
  Plug,
  SearchCheck,
  ServerCog,
  Volume2,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  fadeUp,
  Reveal,
  StaggerGroup,
  StaggerItem,
  staggerContainer,
} from '@/components/shared/motion-primitives';
import { LandingFaq } from '@/components/landing/landing-faq';
import { BrandMark, MockCard } from '@/components/landing/landing-hero-card';
import { PublicTopBar } from '@/components/shell/public-top-bar';
import Image from 'next/image';
import { LOOP_STEPS } from '@/components/shared/loop-steps';

// Captured viewport of the shots in public/screens (1440x900 window). Explicit dimensions keep the
// section out of the page's CLS budget.
const SHOT_W = 1536;
const SHOT_H = 687;

/**
 * Public landing page shown at "/" to signed-out visitors (app/page.tsx renders the dashboard for
 * signed-in users instead). Reuses the app's design tokens + the /guide feature & how-it-works copy;
 * animation is Motion (the platform standard), reduced-motion handled globally by MotionConfig.
 */

const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-6';

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Languages,
    title: 'Luyện dịch, Claude chấm',
    desc: 'Claude ra câu vừa sức quanh mẫu đến hạn, bạn dịch, được chấm điểm 1–4 + sửa lỗi. Lịch ôn FSRS tự giãn theo trí nhớ.',
  },
  {
    icon: ListChecks,
    title: 'Quiz trắc nghiệm A–D',
    desc: 'Muốn ôn nhanh: mỗi câu một mẫu, một chỗ trống và 4 đáp án — chỉ chọn một chữ cái, Claude giảng vì sao.',
  },
  {
    icon: GraduationCap,
    title: 'Luyện thành thạo',
    desc: 'Hết mẫu đến hạn cũng không dừng — Claude tái tổ hợp mẫu bạn đã thuộc vào câu khó hơn để luyện vận dụng.',
  },
  {
    icon: BookOpen,
    title: 'Từ vựng trong ngữ cảnh',
    desc: 'Tra từ khi luyện → lưu vào kho, được dệt lại vào câu dịch sau này và ôn theo FSRS trên ngân sách riêng.',
  },
  {
    icon: LineChart,
    title: 'Theo dõi tiến độ & điểm yếu',
    desc: 'Tỉ lệ nhớ thực tế, điểm yếu 30 ngày, biểu đồ chính xác/thời gian và đường cong quên của từng mẫu.',
  },
  {
    icon: Volume2,
    title: 'Nghe & nói đa giác quan',
    desc: 'Ra đề / trả lời bằng giọng qua voice mode của Claude Desktop; nút phát âm tham khảo ở mọi câu tiếng Nhật.',
  },
];

/**
 * The PROBLEM block, above the feature grid: a visitor who has not been told which problem this solves
 * reads a feature list as noise (message flow problem → solution → product, see the plan's sources).
 * Each entry is one honest pain + what sakubun actually does about it — no vague "supercharge your
 * learning" claims.
 */
const PROBLEMS: { icon: LucideIcon; pain: string; answer: React.ReactNode }[] = [
  {
    icon: PenLine,
    pain: 'Nhận ra được nhưng không tự đặt được câu',
    answer: (
      <>
        Thẻ ghi nhớ chỉ hỏi “mẫu này nghĩa gì”. Ở đây mỗi lượt bạn <b>tự dịch / tự viết</b> một câu
        mới, rồi được chấm từng mẫu.
      </>
    ),
  },
  {
    icon: CalendarClock,
    pain: 'Không biết hôm nay nên học gì',
    answer: (
      <>
        Không phải tự chọn trong danh sách dài: <b>FSRS</b> lấy đúng mục đến hạn theo trí nhớ của
        bạn, hết bài thì chuyển sang luyện vận dụng.
      </>
    ),
  },
  {
    icon: SearchCheck,
    pain: 'Sai mà không biết sai ở đâu',
    answer: (
      <>
        Tự chấm bài mình thì khó khách quan. Claude chỉ ra <b>lỗi ở đâu, vì sao</b>, kèm bản dịch
        tham khảo — rồi kết quả đó xếp lại lịch ôn.
      </>
    ),
  },
];

/** What you must have before signing up — stated UP FRONT, so nobody creates an account they can't use. */
const NEEDS: { icon: LucideIcon; title: string; body: React.ReactNode }[] = [
  {
    icon: Bot,
    title: 'Claude Desktop trên máy tính',
    body: 'Claude là người ra đề và chấm bài. Không có nó thì sakubun chỉ là cái kho — không luyện được.',
  },
  {
    icon: Plug,
    title: 'Nối MCP một lần, khoảng 5 phút',
    body: 'Dán một đoạn cấu hình + token cá nhân vào Claude Desktop. Làm một lần cho mỗi máy.',
  },
  {
    icon: Globe2,
    title: 'Trình duyệt + mạng',
    body: 'Kho học, tiến độ và cài đặt nằm trên web. Máy bạn không phải chạy hay cài thêm gì.',
  },
];

/** The honest "not for you if…" list — the other half of the same promise. */
const NOT_FOR: string[] = [
  'Bạn muốn một app điện thoại độc lập, học mà không mở Claude.',
  'Bạn cần bài giảng video hoặc giáo trình có sẵn — sakubun luyện trên kho của chính bạn.',
  'Bạn cần dùng offline.',
];

/**
 * Proof placed next to the final CTA. Product proof ONLY — no testimonials, no user counts, no logos we
 * have no right to. Every line here is checkable.
 */
const PROOF: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Brain,
    title: 'FSRS',
    body: 'Thuật toán xếp lịch ôn mà Anki dùng mặc định từ 23.10, qua thư viện ts-fsrs.',
  },
  {
    icon: Plug,
    title: 'MCP',
    body: 'Chuẩn mở của Anthropic để Claude nói chuyện với ứng dụng — không phải tiện ích riêng.',
  },
  {
    icon: Download,
    title: 'Xuất được sang Anki',
    body: 'Từ vựng tải về dạng .apkg, mở bằng Anki là nhập — không cần add-on.',
  },
  {
    icon: ServerCog,
    title: 'Dữ liệu trên máy chủ của bạn',
    body: 'Tự dựng, tự sao lưu; xuất toàn bộ ra JSON bất cứ lúc nào.',
  },
];

/**
 * One real screenshot, in whichever theme the visitor is viewing.
 *
 * Both files ship and CSS picks one (`dark:hidden` / `hidden dark:block`) rather than a `useTheme()`
 * swap: the theme is already resolved before hydration, so a JS-chosen source would flash the wrong
 * one on first paint. `SHOT_W/H` are the captured pixel size — passing them explicitly is what lets
 * Next reserve the box and keeps this section out of the page's layout shift. `priority` stays off on
 * purpose: this sits below the hero, so eager-loading it would compete with the first paint.
 */
function Shot({ name, alt, caption }: { name: string; alt: string; caption: string }) {
  const frame = 'w-full rounded-xl border border-border bg-card object-cover object-top shadow-sm';
  return (
    <figure className="h-full">
      <Image
        src={`/screens/${name}-light.webp`}
        alt={alt}
        width={SHOT_W}
        height={SHOT_H}
        sizes="(min-width: 640px) 50vw, 100vw"
        className={`${frame} dark:hidden`}
      />
      <Image
        src={`/screens/${name}-dark.webp`}
        alt={alt}
        width={SHOT_W}
        height={SHOT_H}
        sizes="(min-width: 640px) 50vw, 100vw"
        className={`hidden ${frame} dark:block`}
      />
      <figcaption className="mt-2.5 text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <PublicTopBar containerClassName={CONTAINER} guide />

      {/* hero */}
      <section className="relative py-16 sm:py-20">
        <motion.span
          aria-hidden
          animate={{ x: [0, 24, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -top-28 -right-20 size-[460px] rounded-full bg-primary/15 blur-[70px]"
        />
        <motion.span
          aria-hidden
          animate={{ x: [0, -20, 0], y: [0, -16, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none absolute -bottom-40 -left-28 size-[380px] rounded-full bg-accent-brand/10 blur-[70px]"
        />
        <div className={`${CONTAINER} relative`}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14"
          >
            <div>
              <motion.span
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-accent-brand uppercase"
              >
                <span className="size-1.5 rounded-full bg-accent-brand" />
                Học tiếng Nhật cùng Claude Desktop
              </motion.span>
              <motion.h1
                variants={fadeUp}
                className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]"
              >
                Luyện dịch tiếng Nhật, <span className="text-primary">Claude chấm từng câu</span>
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-5 max-w-xl text-lg text-muted-foreground">
                sakubun giữ kho <b className="font-semibold text-foreground">mẫu ngữ pháp</b> (＋ từ
                vựng bạn tra khi luyện) và lịch ôn{' '}
                <b className="font-semibold text-foreground">FSRS</b>. Claude Desktop là gia sư: ra
                câu vừa sức, chấm điểm và sửa lỗi — lịch ôn tự giãn theo trí nhớ của bạn.
              </motion.p>
              <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="h-11 px-6 text-base">
                  <Link href="/register">
                    Bắt đầu miễn phí <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-11 px-6 text-base">
                  <Link href="/login">Mình đã có tài khoản</Link>
                </Button>
              </motion.div>
              <motion.p
                variants={fadeUp}
                className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-4 text-ok" />
                Miễn phí · kết nối qua MCP · dữ liệu học nằm trên máy chủ của bạn
              </motion.p>
            </div>

            <MockCard />
          </motion.div>
        </div>
      </section>

      {/* problem — read BEFORE the feature grid, so the features answer something */}
      <section className="py-14 sm:py-16">
        <div className={CONTAINER}>
          <Reveal className="max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
              Vấn đề
            </div>
            <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Học ngữ pháp bằng thẻ ghi nhớ có ba lỗ hổng
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Đây là ba chỗ người học tiếng Nhật mắc lại nhiều nhất — và sakubun được dựng quanh
              đúng ba chỗ đó.
            </p>
          </Reveal>

          <StaggerGroup className="mt-9 grid gap-4 sm:grid-cols-3">
            {PROBLEMS.map((p) => {
              const Icon = p.icon;
              return (
                <StaggerItem key={p.pain}>
                  <div className="h-full rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-border bg-muted text-muted-foreground">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mb-1.5 font-semibold tracking-tight">{p.pain}</h3>
                    <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <ArrowRight className="mt-1 size-4 shrink-0 text-accent-brand" aria-hidden />
                      <span>{p.answer}</span>
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* features */}
      <section className="py-14 sm:py-16">
        <div className={CONTAINER}>
          <Reveal className="max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
              Tính năng
            </div>
            <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Mọi thứ để luyện tiếng Nhật một cách có chủ đích
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Không chỉ đếm “đã làm bao nhiêu câu” — sakubun theo sát điều bạn đang yếu và luyện
              đúng chỗ đó.
            </p>
          </Reveal>

          <StaggerGroup className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <StaggerItem key={f.title}>
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    className="h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                  >
                    <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mb-1.5 text-[1.06rem] font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* real screens — placed AFTER the features so it answers "show me", not "look at this" */}
      <section className="py-14 sm:py-16">
        <div className={CONTAINER}>
          <Reveal className="max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
              Xem thử
            </div>
            <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Ba màn hình bạn dùng nhiều nhất
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Ảnh chụp thật từ app đang chạy — không phải bản vẽ minh hoạ.
            </p>
          </Reveal>

          <Reveal className="mt-9">
            <Shot
              name="dashboard"
              alt="Trang Phân tích: số mẫu đến hạn, chuỗi ngày học, tiến độ hôm nay và bản đồ hoạt động một năm"
              caption="Phân tích — đến hạn bao nhiêu, đúng bao nhiêu, và lịch ôn 14 ngày tới."
            />
          </Reveal>

          <StaggerGroup className="mt-4 grid gap-4 sm:grid-cols-2">
            <StaggerItem>
              <Shot
                name="resources"
                alt="Trang Tài nguyên: bảng mẫu ngữ pháp với nghĩa, cấp độ JLPT, trạng thái và ngày đến hạn"
                caption="Tài nguyên — kho mẫu của bạn, kèm cấp độ và trạng thái ôn."
              />
            </StaggerItem>
            <StaggerItem>
              <Shot
                name="history"
                alt="Trang Lịch sử: từng lượt luyện dịch và quiz đã chấm, kèm thời gian trả lời"
                caption="Lịch sử — mọi lượt đã chấm, kèm thời gian bạn mất để trả lời."
              />
            </StaggerItem>
          </StaggerGroup>
        </div>
      </section>

      {/* how it works */}
      <section className="py-14 sm:py-16">
        <div className={CONTAINER}>
          <Reveal className="max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
              Cách hoạt động
            </div>
            <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Một vòng luyện, năm bước
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              App sở hữu dữ liệu + FSRS + cài đặt; Claude sinh câu và chấm bài. Hai vai tách bạch
              nên bản dịch tham khảo được lưu trước khi bạn thấy đề.
            </p>
          </Reveal>

          <StaggerGroup className="mt-8">
            {LOOP_STEPS.map((s, i) => (
              <StaggerItem key={s.title}>
                <div className="relative grid grid-cols-[44px_1fr] gap-4 pb-6 sm:gap-5">
                  {/* connector line between steps */}
                  {i < LOOP_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-12 bottom-0 left-[21px] w-px bg-gradient-to-b from-border to-transparent"
                    />
                  )}
                  <span className="grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-[1.02rem] font-bold text-primary tabular-nums">
                    {i + 1}
                  </span>
                  <div className="pt-1">
                    <h3 className="text-[1.08rem] font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-1 max-w-2xl text-[0.96rem] text-muted-foreground">
                      {s.landingBody}
                    </p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* prerequisites + who it is NOT for — before the CTA on purpose: a signup that cannot practise
          is worse than no signup, so the requirement is stated where it still changes the decision */}
      <section className="py-14 sm:py-16">
        <div className={CONTAINER}>
          <Reveal className="max-w-2xl">
            <div className="text-xs font-semibold tracking-widest text-accent-brand uppercase">
              Cần gì để dùng
            </div>
            <h2 className="mt-2.5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Ba thứ, không cài đặt gì thêm
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Nói trước cho rõ: sakubun <b className="font-semibold text-foreground">cần</b> Claude
              Desktop. Đây là điều kiện, không phải tuỳ chọn.
            </p>
          </Reveal>

          <StaggerGroup className="mt-9 grid gap-4 sm:grid-cols-3">
            {NEEDS.map((n) => {
              const Icon = n.icon;
              return (
                <StaggerItem key={n.title}>
                  <div className="h-full rounded-2xl border border-border bg-card p-5">
                    <div className="mb-3.5 grid size-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mb-1.5 font-semibold tracking-tight">{n.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          <Reveal className="mt-4 rounded-2xl border border-border bg-muted/30 p-5">
            <h3 className="flex items-center gap-2 font-semibold tracking-tight">
              <CircleSlash className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Chưa phù hợp nếu…
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
              {NOT_FOR.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <LandingFaq container={CONTAINER} />

      {/* proof — deliberately the LAST thing before the CTA (the researched placement). Product proof
          only: every line is checkable, and there is nothing here we could not back up. */}
      <div className={`${CONTAINER} pt-4`}>
        <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => {
            const Icon = p.icon;
            return (
              <StaggerItem key={p.title}>
                <div className="flex h-full gap-3 rounded-2xl border border-border bg-card p-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-accent-brand" aria-hidden />
                  <div className="min-w-0">
                    <div className="font-semibold tracking-tight">{p.title}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>

      {/* final CTA */}
      <div className={`${CONTAINER} py-10`}>
        <Reveal className="rounded-3xl border border-primary/25 bg-primary/10 px-6 py-12 text-center sm:px-10">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Sẵn sàng cho buổi luyện đầu tiên?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            Tạo tài khoản, nối Claude Desktop qua MCP, nhập kho ngữ pháp — rồi nói “luyện dịch”.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-11 px-6 text-base">
              <Link href="/register">
                Tạo tài khoản <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-6 text-base">
              <Link href="/login">Đăng nhập</Link>
            </Button>
          </div>
        </Reveal>
      </div>

      {/* footer */}
      <footer className="border-t border-border py-7 text-sm text-muted-foreground">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-center gap-2.5 font-semibold text-foreground">
            <BrandMark className="size-6 text-[10px]" />
            sakubun
          </div>
          <span>Luyện dịch Nhật–Việt bằng spaced repetition, học qua Claude Desktop.</span>
        </div>
      </footer>
    </div>
  );
}
