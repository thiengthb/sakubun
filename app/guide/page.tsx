import { Plug, Sparkles, Wrench } from 'lucide-react';
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageShell } from '@/components/shell/page-shell';
import { IntroHint } from '@/components/dashboard/intro-hint';
import {
  AnkiWalkthrough,
  McpWalkthrough,
  StartWalkthrough,
} from '@/components/guide/guide-walkthrough';
import { MCP_CATALOG } from '@/lib/mcp/catalog';
import { getOptionalSessionUser } from '@/lib/current-user';
import { getStartProgress } from '@/lib/guide-progress';
import { GuideFeaturesTab } from '@/components/guide/guide-features';
import { GuideToolTable } from '@/components/guide/guide-tool-table';
import type { GuideRecipeId } from '@/components/guide/guide-topic-meta';
import { GuideTabs } from '@/components/guide/guide-tabs';
import { Code, RefHeading } from '@/components/guide/guide-reference';

export const metadata = { title: 'Hướng dẫn — sakubun' };

// Four tabs (2026-07-23: merged the old "Cách hoạt động" EXPLANATION tab into the "Tính năng" tour —
// the loop walkthrough + FSRS-signal + why-Claude-grades content now live INSIDE the flagship
// "Luyện dịch" feature topic, since that IS how translation practice works):
//   Bắt đầu   = TUTORIAL  — one linear, self-sufficient path from nothing to a graded sentence
//   Tính năng = tour      — what exists in the app (+ the loop explanation, in the Luyện dịch topic)
//   Theo việc = HOW-TO    — short recipes for a task you already know you want to do
//   Tra cứu   = REFERENCE — the config blocks and the tool/prompt table, nothing narrative
// Before 2026-07-20 the modes were mixed per tab and the tutorial was NOT self-sufficient: its last
// step told the reader to run `/practice` while the MCP configuration lived on another tab. Keep the
// tutorial complete — if a new step needs a prerequisite, state it in the step, do not link away.

// Deployed + authed: mcp-remote sends your PERSONAL token as a bearer header. Get the token at the
// Tài khoản page (Tạo token MCP); it identifies you to the shared server. Never share it.
const CLAUDE_CONFIG = `{
  "mcpServers": {
    "sakubun": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "https://sakubun.thientnse.site/api/mcp",
        "--header", "Authorization: Bearer DÁN_TOKEN_CỦA_BẠN"
      ]
    }
  }
}`;

const CLAUDE_CONFIG_WINDOWS = `{
  "mcpServers": {
    "sakubun": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y", "mcp-remote", "https://sakubun.thientnse.site/api/mcp",
        "--header", "Authorization: Bearer DÁN_TOKEN_CỦA_BẠN"
      ]
    }
  }
}`;

/**
 * One how-to recipe: a task-shaped heading + the steps to do it. `id` makes it ADDRESSABLE — another
 * screen links at `/guide?tab=howto&recipe=<id>` and `GuideTabs` scrolls here (ids are a closed union in
 * `guide-topic-meta.ts`, so a link can't point at a recipe that does not exist).
 */
function Recipe({
  id,
  title,
  children,
}: {
  id: GuideRecipeId;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`guide-recipe-${id}`} className="space-y-2 rounded-xl border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default async function GuidePage() {
  // The "Bắt đầu" tutorial shows the learner's REAL progress (derived — see lib/guide-progress.ts).
  // A guest gets `null` and the tutorial renders exactly as it always did, so /guide stays fully
  // readable without an account.
  const user = await getOptionalSessionUser();
  const progress = user ? await getStartProgress(user.id) : null;

  return (
    <GuideTabs>
      <PageShell
        section="guide"
        headerAside={
          <>
            <TabsList>
              <TabsTrigger value="start">Bắt đầu</TabsTrigger>
              <TabsTrigger value="features">Tính năng</TabsTrigger>
              <TabsTrigger value="howto">Theo việc</TabsTrigger>
              <TabsTrigger value="reference">Tra cứu</TabsTrigger>
            </TabsList>
            {/* Lightbulb at the far right of the tab row — glows until first read; the intro that used
                to be a paragraph now lives in its hover tooltip, split into scannable sections. */}
            <IntroHint
              storageKey="guide-intro"
              label="sakubun là gì? Bắt đầu từ đâu?"
              className="ml-auto"
            >
              <p>
                <b>sakubun</b> = kho <b>mẫu ngữ pháp</b> (＋ từ vựng bạn tra khi luyện) + lịch ôn{' '}
                <b>FSRS</b>. <b>Claude Desktop</b> = gia sư ra đề dịch và chấm bài qua MCP.
              </p>
              <p>
                <b>Chưa dùng bao giờ?</b> Đi hết tab <b>«Bắt đầu»</b> theo thứ tự — 7 bước, mỗi bước
                có «Cần trước đó» và «Xong chưa?» để biết mình đã làm đúng.
              </p>
              <p>
                <b>Đã quen rồi?</b> Sang <b>«Theo việc»</b> để làm nhanh một việc cụ thể.
              </p>
            </IntroHint>
          </>
        }
      >
        {/* ---------- TUTORIAL ---------- */}
        <TabsContent value="start" className="space-y-5 pt-4 text-sm leading-6">
          <StartWalkthrough progress={progress} />
          <section className="space-y-2">
            <RefHeading>Ghi chú thêm</RefHeading>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <strong>Dấu tích ở mỗi bước là thật</strong>: khi bạn đã đăng nhập, app tự kiểm từ{' '}
                <strong>dữ liệu của bạn</strong> — đã tạo token chưa, Claude Desktop đã kết nối lần
                nào chưa, kho có mẫu chưa, đã có thẻ chi tiết chưa, đã lưu cài đặt chưa, đã ôn lần
                nào chưa. Bạn không phải tự đánh dấu, và mở lại trang này lúc nào cũng biết mình còn
                thiếu bước nào (bấm <em>«Tới bước còn thiếu»</em>).
              </li>
              <li>
                <strong>Không cần cài gì</strong>: sakubun chạy trên máy chủ chung,{' '}
                <strong>luôn bật</strong> — bạn chỉ cần trình duyệt và đăng nhập ở{' '}
                <code>sakubun.thientnse.site</code>. Dữ liệu mỗi người tách riêng theo tài khoản.
                Máy bạn không phải mở gì (chỉ cần Claude Desktop khi luyện, và có mạng).
              </li>
              <li>
                <strong>File .xlsx</strong>: cột <code>pattern / phonetic / mean / comment</code>{' '}
                (nghĩa dài tự cắt gọn, comment thành ghi chú). Hoặc dán bảng Excel copy, hoặc từng
                dòng <code>mẫu (cách đọc) : nghĩa N5</code>.
              </li>
              <li>
                Menu «Hôm nay luyện gì?» đầu buổi: <strong>Điểm yếu</strong> = ôn mẫu hay sai +
                leech; <strong>Ngẫu nhiên</strong> khi không biết chọn gì.
              </li>
            </ul>
          </section>
        </TabsContent>

        {/* ---------- HOW-TO ---------- */}
        <TabsContent value="howto" className="space-y-4 pt-4 text-sm leading-6">
          <p className="text-muted-foreground">
            Mỗi mục dưới là một việc cụ thể, làm được ngay — không cần đọc theo thứ tự.
          </p>

          <Recipe id="paste-material" title="Có một email / trang truyện / đề thi thử tiếng Nhật">
            <p>
              Cứ <strong>dán thẳng vào Claude</strong> và nói{' '}
              <em>“có gì đáng học trong này không?”</em>— kể cả chữ bạn đọc được từ một ảnh chụp.
              Claude bóc ra các mẫu ngữ pháp và từ đáng học, rồi{' '}
              <strong>đối chiếu với kho của bạn trước khi thêm bất cứ gì</strong>, và nó cho bạn xem
              bản đối chiếu đó:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Thêm được</strong> — kho bạn chưa có, thêm là xong.
              </li>
              <li>
                <strong>Đã có rồi</strong> — kể cả khi tài liệu viết khác đi (
                <span lang="ja">「〜わけにはいかない」</span> trong ngoặc vs{' '}
                <span lang="ja">わけにはいかない</span> trong kho vẫn là MỘT mẫu). Nếu mẫu đó đang
                tạm ngưng, việc cần làm là <strong>bật lại</strong>, không phải thêm bản thứ hai.
              </li>
              <li>
                <strong>Cần bạn quyết</strong> — ví dụ đã có người chia sẻ bản{' '}
                <strong>kèm thẻ đầy đủ</strong> (lấy về thì được luôn cả thẻ, hơn là thêm một dòng
                trắng), hoặc bạn đã có đúng chữ đó ở loại khác.
              </li>
            </ul>
            <p>
              Không có gì được ghi vào kho trước khi bạn <strong>đồng ý</strong>. Mẹo: cứ để Claude
              chọn lọc — mục tiêu là mấy mẫu bạn thật sự sẽ gặp lại, không phải mọi trợ từ trong
              bài.
            </p>
          </Recipe>

          <Recipe id="focus" title="Luyện đúng một mẫu, một cấp độ, hay đúng điểm yếu">
            <p>
              Chọn ở menu «Hôm nay luyện gì?» đầu buổi, hoặc nói giữa buổi «luyện 〜ばかりに» / «đổi
              trọng tâm sang N2» / «luyện điểm yếu». Mẫu bạn yêu cầu được ưu tiên kể cả chưa đến
              hạn; nếu ít hơn số mẫu mỗi câu, server tự bù mẫu khác.
            </p>
          </Recipe>

          <Recipe id="tidy-library" title="Dọn kho: tìm những thẻ chưa đủ để học">
            <p>
              Cách nhanh nhất là <strong>hỏi Claude</strong>: <em>“kho của tôi thế nào?”</em> — nó
              trả về bản khám kèm đúng một việc nên làm trước, đồng ý là nó soạn bù luôn. Mở buổi
              học nào cũng vậy, khối <em>Tiến độ</em> tự kèm gợi ý đó nếu có gì đáng làm.
            </p>
            <p>
              Muốn tự nhìn: vào <em>Tài nguyên → Ngữ pháp</em>, lọc <strong>Thẻ chi tiết</strong>{' '}
              theo <em>Thẻ chưa đạt</em> (gộp: chưa có thẻ, thẻ lỗi, thẻ còn thiếu) hoặc chọn riêng{' '}
              <em>Thẻ còn thiếu</em> / <em>Thẻ format cũ</em>. Mở một mẫu ra, thẻ tự nói nó{' '}
              <strong>thiếu phần nào</strong> — cách chia, ví dụ, bẫy hay phân biệt.
            </p>
          </Recipe>

          <Recipe id="groups" title="Gom mẫu/từ thành nhóm rồi luyện theo nhóm">
            <p>
              Vào trang <em>Nhóm</em> tạo một nhóm (chọn loại: ngữ pháp / từ vựng / hỗn hợp). Thêm
              thành viên bằng cách mở nhóm và bấm thêm, hoặc ở <em>Tài nguyên</em> chọn nhiều mục
              rồi «thêm vào nhóm». Sau đó nói với Claude <em>«luyện nhóm X»</em> — nó ưu tiên các
              mẫu trong nhóm đó. Không muốn tự gom? Nhờ Claude <em>«gợi ý một nhóm cho…»</em>: nó đề
              xuất tên + danh sách, bạn xem rồi <strong>duyệt</strong> mới tạo.
            </p>
          </Recipe>

          <Recipe id="share-items" title="Chia sẻ mẫu/từ và lấy về từ thư viện chung">
            <p>
              Mở chi tiết một mẫu/từ (từ bảng <em>Tài nguyên</em>) → bấm{' '}
              <em>«Chia sẻ vào thư viện»</em> để người khác thấy nội dung mục đó (lịch ôn của bạn
              không bị chia sẻ). Muốn lấy đồ người khác chia sẻ: vào trang <em>Thư viện</em>, tìm
              mẫu/từ cần, bấm <em>«Lấy về kho»</em> — nó vào kho bạn với lịch ôn mới, độc lập hoàn
              toàn.
            </p>
          </Recipe>

          <Recipe id="share-turn" title="Chia sẻ một lượt dịch để xin góp ý">
            <p>
              Vào <em>Lịch sử</em>, mở một lượt <strong>đã chấm</strong> → bấm{' '}
              <em>«Chia sẻ lên feed»</em>. Lượt đó hiện ở tab <em>Cộng đồng</em> (cùng trang Lịch
              sử) để thành viên khác đọc và bình luận; lịch ôn của bạn không bị lộ. Muốn góp ý cho
              người khác thì mở tab <em>Cộng đồng</em>, mở phần bình luận của một lượt và viết.
            </p>
          </Recipe>

          <Recipe id="settings" title="Đổi cài đặt giữa buổi">
            <p>
              Nói thẳng với Claude: «đổi sang N3», «câu dài hơn», «thêm từ vựng mỗi câu». Claude gọi{' '}
              <code>update_settings</code> — không cần rời khung chat. Muốn xem mình đang yếu chỗ
              nào thì hỏi «tôi yếu chỗ nào» (<code>get_weak_report</code>).
            </p>
          </Recipe>

          <Recipe id="modes" title="Đổi vị: luyện theo truyện hoặc luyện nói">
            <p>
              <strong>Theo truyện</strong> — prompt <code>story_practice</code> dệt 6–8 mục vào một
              đoạn hội thoại hoặc truyện ngắn, bạn dịch từng câu rồi nộp một lần.
            </p>
            <p>
              <strong>Nói theo tình huống</strong> — prompt <code>conversation</code> dựng một bối
              cảnh thật (bạn là ai, nói với ai, ở đâu) kèm văn phong và các mẫu/từ đến hạn; bạn tự
              đặt câu tiếng Nhật hợp cảnh, Claude chấm cả văn phong lẫn cách dùng từng mẫu rồi ghi
              vào lịch ôn. Đang ở buổi dịch hay quiz, chỉ cần nói «cho luyện nói» là sang ngay.
            </p>
          </Recipe>

          <Recipe id="mcp" title="Nối lại Claude Desktop (máy mới, hoặc mất kết nối)">
            <McpWalkthrough />
          </Recipe>

          <Recipe id="anki" title="Xuất từ vựng sang Anki (tuỳ chọn)">
            <p>
              Mặc định từ mới học thẳng trong sakubun (<code>add_vocab</code>) và được dệt lại vào
              câu dịch. Chỉ làm phần này nếu bạn còn muốn ôn chúng trong Anki.
            </p>
            <AnkiWalkthrough />
            <p>
              Tải lại lần sau sẽ <strong>cập nhật</strong> thẻ cũ chứ không tạo thẻ trùng, nên cứ
              xuất lại mỗi khi thêm từ mới. Lịch ôn của sakubun không đi kèm — Anki xếp lịch riêng
              cho bản sao của nó.
            </p>
          </Recipe>

          <section
            id="guide-recipe-troubleshoot"
            className="space-y-2 rounded-xl border bg-card p-4"
          >
            <h3 className="flex items-center gap-2 font-medium">
              <Wrench className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Xử lý sự cố — tra theo triệu chứng
            </h3>
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/5">Triệu chứng</TableHead>
                  <TableHead>Cách xử lý</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="align-top">Claude báo không kết nối được sakubun</TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Kiểm tra: mở <code>sakubun.thientnse.site</code> đăng nhập được không (mạng OK),
                    và token MCP chưa bị thu hồi. Rồi khởi động lại Claude Desktop. Máy chủ luôn bật
                    sẵn — bạn không phải tự chạy gì.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">
                    Claude báo <em>401 / Unauthorized</em> (chưa xác thực)
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Token sai, thiếu, hoặc đã bị thu hồi. Vào <em>Tài khoản</em> tạo token mới, cập
                    nhật lại header <code>Authorization: Bearer …</code> trong config rồi khởi động
                    lại Claude Desktop.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">
                    Gõ <code>/</code> trong Claude không thấy <code>practice</code>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Cấu hình chưa được nạp: kiểm tra lại <code>claude_desktop_config.json</code>{' '}
                    (tab <em>Tra cứu</em>) và khởi động lại Claude Desktop hoàn toàn.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">
                    Windows: lỗi <em>spawn npx</em>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Dùng bản cấu hình <code>cmd /c</code> ở tab <em>Tra cứu</em>.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">Tool lỗi «Tham số không hợp lệ»</TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Claude gửi sai định dạng; bảo Claude đọc lại mô tả tool và thử lại. Lượt đó
                    không bị ghi vào lịch sử.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">«Không tạo được tệp Anki»</TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Thử tải lại sau giây lát. Nếu vẫn lỗi, xem log của container — không dữ liệu nào
                    bị ảnh hưởng, đây chỉ là bước tạo tệp để tải về.
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="align-top">Tệp Anki tải về trống</TableCell>
                  <TableCell className="align-top whitespace-normal">
                    Bạn chưa có từ vựng nào trong sakubun. Nhờ Claude thêm từ (
                    <code>add_vocab</code>) rồi tải lại — bộ thẻ chỉ gồm từ vựng, không gồm mẫu ngữ
                    pháp.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        {/* ---------- FEATURE TOUR ---------- */}
        <GuideFeaturesTab />

        {/* ---------- REFERENCE ---------- */}
        <TabsContent value="reference" className="space-y-5 pt-4 text-sm leading-6">
          <section className="space-y-2">
            <RefHeading>
              <Plug className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
              Cấu hình Claude Desktop
            </RefHeading>
            <p>
              Trước tiên vào <em>Tài khoản → Token MCP</em>, đặt tên rồi bấm{' '}
              <strong>Tạo token</strong> để lấy token cá nhân (chỉ hiện MỘT lần — bấm sao chép, lưu
              lại ngay). Rồi mở <em>Claude Desktop → Settings → Developer → Edit Config</em> (file{' '}
              <code>claude_desktop_config.json</code>) và thêm, thay <code>DÁN_TOKEN_CỦA_BẠN</code>{' '}
              bằng token vừa tạo:
            </p>
            <Code copyLabel="Chép cấu hình">{CLAUDE_CONFIG}</Code>
            <p className="text-muted-foreground">
              Windows: nếu Claude không khởi động được server (lỗi spawn npx), dùng bản này:
            </p>
            <Code copyLabel="Chép cấu hình (Windows)">{CLAUDE_CONFIG_WINDOWS}</Code>
            <p>
              Endpoint: <code>https://sakubun.thientnse.site/api/mcp</code>. Server chung, có{' '}
              <strong>xác thực bằng token cá nhân</strong> — Claude Desktop kết nối DƯỚI DANH NGHĨA
              bạn. Đừng chia sẻ token; mất/lộ thì vào <em>Tài khoản</em> thu hồi rồi tạo token mới
              (token cũ hết hiệu lực ngay).
            </p>
          </section>

          <section className="space-y-2">
            <RefHeading>Bộ thẻ Anki xuất ra</RefHeading>
            <p className="text-muted-foreground">
              Tệp <code>.apkg</code> tải từ <em>Cài đặt → Dữ liệu</em> là một bộ thẻ Anki tiêu
              chuẩn: deck <code>sakubun</code>, loại thẻ 2 mặt (Front/Back), thẻ gắn nhãn{' '}
              <code>sakubun</code>. Mở tệp bằng Anki trên máy bạn là nó tự nhập — không cần add-on,
              không cần mở sẵn Anki, và dùng được kể cả khi bạn truy cập sakubun từ xa.
            </p>
            <p className="text-muted-foreground">
              Mỗi thẻ mang một mã ổn định theo từ, nên lần tải sau Anki <strong>cập nhật</strong>{' '}
              thẻ cũ thay vì tạo bản trùng. Thẻ nhập vào là thẻ MỚI: lịch ôn FSRS của sakubun không
              đi kèm, Anki xếp lịch riêng.
            </p>
          </section>

          <section className="space-y-2">
            <RefHeading>
              <Sparkles className="mr-1.5 inline size-4 align-text-bottom" aria-hidden />
              Tool &amp; prompt ({MCP_CATALOG.length})
            </RefHeading>
            <GuideToolTable />
          </section>
        </TabsContent>
      </PageShell>
    </GuideTabs>
  );
}
