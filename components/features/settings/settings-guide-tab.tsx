import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Bot,
  CalendarClock,
  Globe,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  MessageSquareText,
  MessagesSquare,
  Plug,
  type LucideIcon,
} from 'lucide-react';
import { IconTile } from '@/components/common/icon-tile';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { SettingsTab } from '@/components/features/settings/settings-tab';
import { SettingsSection } from '@/components/features/settings/settings-section';

// Roadmap 7.3 (plan docs/plans/2026-10-27-phase7-3-guide.md): how a new learner gets from sign-in to a
// graded sentence. The web never writes or grades sentences, so the one thing a learner must do is
// connect an AI app; everything here serves that. Static text, read in two minutes.

export const START_PHRASE = 'Học tiếng Nhật với sakubun';

function GuideRow({
  icon,
  title,
  children,
  wide = false,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-full flex gap-3 px-4 py-3' : 'flex gap-3 px-4 py-3'}>
      <IconTile icon={icon} tone="primary" />
      <div className="min-w-0 flex-1 space-y-1.5 text-sm">
        <h3 className="font-medium">{title}</h3>
        <div className="space-y-2 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{value}</code>
      <CopyCommandButton
        command={value}
        label={label}
        size="icon-sm"
        variant="ghost"
        showCopiedText={false}
        toastDescription="none"
      />
    </div>
  );
}

function TabLink({
  tab,
  openTab,
  children,
}: {
  tab: string;
  openTab: (tab: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => openTab(tab)}
      className="text-foreground underline underline-offset-4"
    >
      {children}
    </button>
  );
}

export function GuideTab({
  mcpUrl,
  openTab,
}: {
  mcpUrl: string;
  /** Switches the Settings tab in place: a link to ?tab= would keep the tab stored for this session. */
  openTab: (tab: string) => void;
}) {
  return (
    <SettingsTab value="guide" surface="bare">
      <p className="text-sm text-muted-foreground">
        Sakubun giữ kho ngữ pháp và từ vựng của bạn, lịch ôn và hạn mức mỗi ngày. Claude hoặc
        ChatGPT là thầy: soạn câu, chấm bài và giải thích. Web không tự ra câu, nên việc đầu tiên là
        kết nối một ứng dụng AI.
      </p>

      <SettingsSection title="Bắt đầu">
        <GuideRow icon={Plug} title="1. Kết nối Claude" wide>
          <p>
            Trên claude.ai, mở Customize &gt; Connectors, bấm + Add &gt; Add custom connector. Điền
            Name là sakubun, MCP server URL là địa chỉ này, bấm Continue rồi Connect:
          </p>
          <CopyField value={mcpUrl} label="Chép địa chỉ MCP" />
          <p>
            Claude mở trang &quot;Cho phép truy cập Sakubun?&quot;, bấm Cho phép là xong, không cần
            token. Trang này cấp quyền cho tài khoản sakubun đang đăng nhập trong trình duyệt, nên
            nếu trình duyệt đang mở sakubun bằng tài khoản khác thì đăng xuất trước. Kết nối xong
            thì dùng được trên claude.ai, Claude Desktop và app Claude trên điện thoại.
          </p>
        </GuideRow>
        <GuideRow icon={Globe} title="2. Lấy mẫu từ Kho chung" wide>
          <p>
            Kho của tài khoản mới để trống. Mở{' '}
            <Link href="/library" className="text-foreground underline underline-offset-4">
              Kho chung
            </Link>
            , lấy cả một bộ như N5 · Ngữ pháp hoặc tìm từng mục rồi bấm Lấy. Mục lấy về là của riêng
            bạn, với lịch ôn mới. Claude cũng thêm được mục mới khi bạn luyện.
          </p>
        </GuideRow>
        <GuideRow icon={MessageSquareText} title="3. Bắt đầu luyện" wide>
          <p>Mở một chat mới, kiểm sakubun đang bật trong nút + &gt; Connectors, rồi gõ:</p>
          <CopyField value={START_PHRASE} label="Chép câu bắt đầu" />
          <p>
            Hoặc chọn sẵn lời dặn cho Claude: nút + &gt; Connectors &gt; Add from sakubun &gt; Hoc.
          </p>
          <p>
            Claude đưa một câu dùng mục đến hạn, tiếng Nhật hoặc tiếng Việt theo Hướng dịch ở tab{' '}
            <TabLink tab="practice" openTab={openTab}>
              Luyện tập
            </TabLink>
            . Bạn dịch, Claude chấm và nhận xét, sakubun xếp lịch ôn lần sau. Muốn đổi chủ đề hay
            câu dài hơn thì cứ nói với Claude; gõ &quot;dừng&quot; để nghỉ.
          </p>
        </GuideRow>
        <GuideRow icon={CalendarClock} title="4. Hạn mức mỗi ngày" wide>
          <p>
            Số mẫu mới, từ mới và lượt ôn tối đa mỗi ngày chỉnh ở tab{' '}
            <TabLink tab="practice" openTab={openTab}>
              Luyện tập
            </TabLink>
            . Hết hạn mức thì Claude báo đã xong hôm nay.
          </p>
        </GuideRow>
      </SettingsSection>

      <SettingsSection title="Ứng dụng khác">
        <GuideRow icon={Bot} title="ChatGPT">
          <p>
            Bật Developer mode, vào Settings &gt; Apps &gt; Create, dán cùng địa chỉ ở trên và chọn
            OAuth. Ghi bài qua MCP chỉ có ở một số gói ChatGPT.
          </p>
        </GuideRow>
        <GuideRow icon={KeyRound} title="Claude Desktop bằng token">
          <p>
            Nếu không dùng connector, tạo token ở tab{' '}
            <TabLink tab="account" openTab={openTab}>
              Tài khoản
            </TabLink>{' '}
            &gt; Token MCP; hộp thoại tạo token có sẵn đoạn cấu hình để dán.
          </p>
        </GuideRow>
      </SettingsSection>

      <SettingsSection title="Các trang">
        <GuideRow icon={LayoutDashboard} title="Phân tích">
          <p>Số mục đến hạn, chuỗi ngày học, độ nhớ và điểm yếu.</p>
        </GuideRow>
        <GuideRow icon={Layers} title="Ôn nhanh">
          <p>Ôn bằng thẻ ngay trên web, không cần AI. Lượt ôn tính vào cùng lịch.</p>
        </GuideRow>
        <GuideRow icon={MessagesSquare} title="Hội thoại">
          <p>
            Kịch bản hội thoại Claude soạn cùng bạn: nghe từng câu hoặc cả bài, chọn vai của mình,
            rê chuột lên một từ để xem nghĩa. Bấm Nhập vai với AI rồi dán vào Claude để nó đóng các
            vai còn lại.
          </p>
        </GuideRow>
        <GuideRow icon={Library} title="Tài nguyên">
          <p>Kho ngữ pháp, từ vựng và nhóm của riêng bạn, cùng lịch ôn của từng mục.</p>
        </GuideRow>
        <GuideRow icon={Globe} title="Kho chung">
          <p>
            Ngữ pháp và từ vựng mọi người cùng dùng, khởi đầu từ OpenJLPT. Lấy về một mục hay cả
            nhóm; bấm Chia sẻ ở trang một mục hay một nhóm của bạn để đưa nó lên cho người khác.
          </p>
        </GuideRow>
        <GuideRow icon={History} title="Lịch sử">
          <p>Những câu đã dịch, điểm và nhận xét của AI.</p>
        </GuideRow>
      </SettingsSection>

      <SettingsSection title="Câu hỏi thường gặp">
        <GuideRow icon={Plug} title="Thu hồi quyền của ứng dụng AI">
          <p>
            Ở tab{' '}
            <TabLink tab="account" openTab={openTab}>
              Tài khoản
            </TabLink>{' '}
            &gt; Ứng dụng đã kết nối. Ứng dụng mất quyền ngay ở lần gọi kế tiếp.
          </p>
        </GuideRow>
        <GuideRow icon={Bot} title="AI chấm sai">
          <p>
            Điểm và nhận xét do AI soạn, có thể sai. Nói lại với nó; các lần ôn sau sẽ chỉnh lịch
            theo bạn.
          </p>
        </GuideRow>
        <GuideRow icon={KeyRound} title="Dữ liệu và xoá tài khoản" wide>
          <p>
            Xem{' '}
            <Link href="/privacy" className="text-foreground underline underline-offset-4">
              Chính sách bảo mật
            </Link>{' '}
            và{' '}
            <Link href="/terms" className="text-foreground underline underline-offset-4">
              Điều khoản sử dụng
            </Link>
            ; muốn xoá tài khoản thì gửi email ghi ở đó.
          </p>
        </GuideRow>
      </SettingsSection>
    </SettingsTab>
  );
}
