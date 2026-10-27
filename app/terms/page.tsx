import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/layout/legal-page';
import { allowedEmail } from '@/lib/auth/login-policy';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng — sakubun',
  description: 'Điều kiện dùng sakubun.',
};

export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <LegalPage title="Điều khoản sử dụng" updated="27/10/2026">
      <p>
        Sakubun là app luyện tiếng Nhật miễn phí do một cá nhân tự vận hành. Khi tạo tài khoản, bạn
        đồng ý với các điều dưới đây.
      </p>

      <section>
        <h2>Dùng app</h2>
        <ul>
          <li>Mỗi người một tài khoản, đăng nhập bằng tài khoản Google của chính mình.</li>
          <li>
            Không dùng sakubun để làm hại người khác, không cố vào tài khoản hay dữ liệu không phải
            của mình, không làm quá tải máy chủ.
          </li>
          <li>Bạn chịu trách nhiệm về nội dung mình thêm vào kho học.</li>
        </ul>
      </section>

      <section>
        <h2>Nội dung và nhận xét của AI</h2>
        <p>
          Câu luyện, điểm và nhận xét do ứng dụng AI bạn kết nối soạn ra, có thể sai. Hãy coi chúng
          là gợi ý học, không phải đáp án chắc chắn.
        </p>
      </section>

      <section>
        <h2>Chặn và giới hạn</h2>
        <p>
          Số tài khoản có giới hạn. Quản trị có thể chặn hoặc xoá tài khoản vi phạm các điều trên.
          Bị chặn thì dữ liệu vẫn được giữ cho tới khi được bỏ chặn hoặc bị xoá.
        </p>
      </section>

      <section>
        <h2>Không bảo đảm</h2>
        <p>
          Sakubun được cung cấp nguyên trạng, không cam kết luôn chạy hay không mất dữ liệu. App có
          thể đổi, tạm dừng hoặc ngừng bất cứ lúc nào. Người vận hành không chịu trách nhiệm cho
          thiệt hại phát sinh từ việc dùng app.
        </p>
      </section>

      <section>
        <h2>Liên hệ</h2>
        <p>
          Câu hỏi hoặc yêu cầu xoá tài khoản: <ContactLine email={allowedEmail()} />.
        </p>
      </section>
    </LegalPage>
  );
}
