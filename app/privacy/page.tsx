import type { Metadata } from 'next';
import { ContactLine, LegalPage } from '@/components/layout/legal-page';
import { allowedEmail } from '@/lib/auth/login-policy';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — sakubun',
  description: 'Sakubun lưu gì về bạn, để làm gì, và cách xoá.',
};

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <LegalPage title="Chính sách bảo mật" updated="27/10/2026">
      <p>
        Sakubun là app luyện tiếng Nhật do một cá nhân tự vận hành, miễn phí, không quảng cáo. Trang
        này nói sakubun lưu gì về bạn, dùng để làm gì và cách xoá.
      </p>

      <section>
        <h2>Sakubun lưu gì</h2>
        <ul>
          <li>
            Từ tài khoản Google khi bạn đăng nhập: tên, email và ảnh đại diện. Sakubun không xin
            quyền đọc Gmail, Drive hay dữ liệu Google nào khác.
          </li>
          <li>
            Dữ liệu học bạn tạo ra: mục ngữ pháp và từ vựng, lịch ôn, lịch sử ôn, câu dịch và nhận
            xét, nhóm, cài đặt.
          </li>
          <li>
            Phiên đăng nhập: thời điểm, địa chỉ IP và trình duyệt, để giữ bạn đăng nhập và để quản
            trị chặn được tài khoản bị lạm dụng.
          </li>
          <li>
            Token MCP và quyền bạn cấp cho ứng dụng AI (claude.ai, ChatGPT), cùng thời điểm chúng
            được dùng.
          </li>
        </ul>
      </section>

      <section>
        <h2>Dùng để làm gì</h2>
        <ul>
          <li>Đăng nhập, lên lịch ôn và hiện tiến độ học của riêng bạn.</li>
          <li>
            Cho ứng dụng AI bạn đã kết nối đọc và ghi dữ liệu học của bạn khi bạn luyện với chúng.
            Khi đó nội dung đi tới ứng dụng ấy và chịu chính sách của nó.
          </li>
          <li>Quản trị xem số liệu tổng quát của từng tài khoản để chặn lạm dụng và sửa lỗi.</li>
        </ul>
        <p className="mt-2">
          Sakubun không bán, không cho thuê và không chia sẻ dữ liệu của bạn cho bên nào khác, không
          dùng nó để quảng cáo.
        </p>
      </section>

      <section>
        <h2>Lưu ở đâu</h2>
        <p>
          Trên máy chủ riêng của người vận hành, kèm bản sao lưu định kỳ trên cùng máy. Giọng đọc
          tiếng Nhật cũng được tạo trên máy chủ đó. Mỗi tài khoản chỉ thấy dữ liệu của chính mình.
        </p>
      </section>

      <section>
        <h2>Cookie</h2>
        <p>
          Chỉ có cookie phiên đăng nhập và vài lựa chọn giao diện (thanh bên, giao diện tối). Không
          có cookie theo dõi hay quảng cáo.
        </p>
      </section>

      <section>
        <h2>Xoá dữ liệu</h2>
        <ul>
          <li>Thu hồi quyền của ứng dụng AI bất cứ lúc nào trong Cài đặt &gt; Tài khoản.</li>
          <li>
            Muốn xoá tài khoản cùng toàn bộ dữ liệu học, gửi email tới{' '}
            <ContactLine email={allowedEmail()} />. Bản sao lưu cũ tự bị thay sau một thời gian.
          </li>
        </ul>
      </section>

      <section>
        <h2>Thay đổi</h2>
        <p>Khi chính sách đổi, ngày cập nhật ở đầu trang đổi theo.</p>
      </section>
    </LegalPage>
  );
}
