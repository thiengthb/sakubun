import { Sparkles } from 'lucide-react';
import { TabsContent } from '@/components/ui/tabs';
import { HowWalkthrough } from '@/components/guide/guide-walkthrough';
import {
  GuideTopicBrowser,
  GuideTopicGroupHeading,
  GuideTopicItem,
} from '@/components/guide/guide-search';
import { RefHeading } from '@/components/guide/guide-reference';

/**
 * The /guide "Tính năng" tab — a reference for what the app LETS THE LEARNER DO, grouped by
 * `GUIDE_TOPIC_GROUPS` (Luyện tập → Kho học & theo dõi → Nghe, nhìn & trải nghiệm) and searchable.
 *
 * A tour describes what SHIPS. When a capability is cut, its body comes out of here in the same commit
 * — a guide that advertises a screen the learner cannot find is worse than no guide, because it reads
 * as "I am too stupid to find it". 2026-08-05: Thư viện chung, Feed cộng đồng and Thông báo went out
 * with the multi-user surface (2026-08-03) and their entries are gone.
 *
 * This file holds ONLY the topic BODIES, and it is a SERVER component on purpose: the bodies are the bulk
 * of the guide's copy, so keeping them here costs zero client JS. Everything interactive (the search box,
 * which topic is open, the icons) lives in `guide-search.tsx`; every title/summary/keyword lives once in
 * `guide-topic-meta.ts` — a body whose id is missing from that registry does not type-check.
 *
 * Pure Vietnamese end-user copy (the one surface exempt from the English-dev-artifact rule).
 *
 * This tab is a CAPABILITY tour, not a changelog: describe the outcome for the user ("luyện dịch có
 * người chấm"), not a small mechanical control. Ship a user-facing capability ⇒ add its entry to the
 * registry + its body here (same discipline as invariant #3 for the MCP tab).
 */
export function GuideFeaturesTab() {
  return (
    <TabsContent value="features" className="pt-4">
      <GuideTopicBrowser>
        <GuideTopicGroupHeading group="practice" />

        <GuideTopicItem id="translate">
          <p>
            Đây là <strong>trái tim của sakubun</strong>. Mở Claude Desktop (đã kết nối sakubun),
            nói <em>“luyện dịch”</em> — Claude lấy một mẫu ngữ pháp <strong>đang đến hạn ôn</strong>{' '}
            của bạn rồi viết một câu tự nhiên buộc phải dùng mẫu đó, kèm chủ đề mới lạ để không
            nhàm.
          </p>
          <p>
            Bạn <strong>tự dịch</strong> (Nhật → Việt hoặc Việt → Nhật, Claude tự nhận ra chiều theo
            câu bạn gõ). Claude <strong>chấm điểm /100 + cho rating 1–4</strong> cho từng mẫu, chỉ
            ra <strong>sai ở đâu, vì sao</strong>, và đưa bản dịch tham khảo. Dựa trên rating đó,{' '}
            <strong>FSRS</strong> tự tính khi nào nên ôn lại từng mẫu: nhớ tốt thì giãn ra, quên thì
            kéo gần lại — bạn không phải tự quyết học gì hôm nay.
          </p>
          <p>
            Mỗi lượt được lưu vào <em>Lịch sử</em>: câu đề, bài bạn dịch, bản tham khảo, nhận xét,
            điểm, thời gian làm — nghe lại phát âm và xem furigana ngay trong đó. Chưa kịp trả lời
            một câu đã ra? Nói <em>“bỏ qua”</em> — câu vẫn lưu để xem lại nhưng không tính vào lịch
            ôn.
          </p>

          <RefHeading>Vòng lặp một lượt luyện — xem thử</RefHeading>
          <p className="text-muted-foreground">
            Bấm <em>«Tiếp»</em> để đi qua năm bước, từ lúc server chọn bài đến hạn cho tới lúc xếp
            lịch ôn lại.
          </p>
          <HowWalkthrough />

          <RefHeading>4 tín hiệu (như Anki) quyết định lần ôn sau</RefHeading>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>1 Again</strong> — sai / không biết → học lại sau ~1 phút.
            </li>
            <li>
              <strong>2 Hard</strong> — đúng nhưng chật vật → khoảng cách ngắn.
            </li>
            <li>
              <strong>3 Good</strong> — đúng, lỗi nhỏ → khoảng cách chuẩn.
            </li>
            <li>
              <strong>4 Easy</strong> — hoàn hảo → khoảng cách dài (mục mới → ~8 ngày).
            </li>
          </ul>
          <p className="text-muted-foreground">
            <strong>Easy phải xứng đáng.</strong> Nếu bạn trả lời lâu, hoặc cần gợi ý / hỏi thêm
            nghĩa trước khi trả lời, app tự <strong>hạ Easy xuống Good</strong> và nói rõ lý do ngay
            trong khối kết quả. Lý do: cứ đúng là Easy thì lịch ôn giãn ra quá nhanh và bài tập
            ngừng thử thách bạn — đúng-nhưng-phải-nghĩ vốn là Good, không phải Easy.
          </p>
          <p className="text-muted-foreground">
            Thuật toán là <strong>FSRS</strong> (Anki 23.10+ dùng mặc định) qua thư viện{' '}
            <code>ts-fsrs</code>; mục tiêu ghi nhớ chỉnh được trong Cài đặt → tab <em>Nhịp học</em>.
          </p>

          <RefHeading>Vì sao điểm số đáng tin</RefHeading>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              App là nơi <strong>duy nhất</strong> giữ lịch ôn: bản dịch tham khảo được lưu{' '}
              <em>trước</em> khi bạn thấy đề, nên Claude không thể sửa đáp án theo bài bạn viết.
            </li>
            <li>
              Mẫu hay quên (<em>leech</em>) được gia sư luyện <strong>cô lập</strong> bằng câu ngắn
              thay vì bỏ qua.
            </li>
            <li>
              Toàn bộ lịch sử câu + rating nằm ở trang <em>Lịch sử</em> và trong DB —{' '}
              <strong>không bao giờ bị xoá</strong>, kể cả khi bạn xoá mẫu.
            </li>
          </ul>
        </GuideTopicItem>

        <GuideTopicItem id="quiz">
          <p>
            Muốn ôn nhanh mà không phải gõ cả câu: trong Claude Desktop{' '}
            <strong>nói “luyện quiz”</strong> — Claude chuyển sang trắc nghiệm ngay; nói “dịch” là
            quay lại luyện dịch. Cả hai{' '}
            <strong>dùng chung một kho học, một lịch FSRS và một bộ cài đặt</strong> (chủ đề, cỡ
            câu, độ khó, cấp độ, nhịp học) — chỉ khác cách hỏi.
          </p>
          <p>
            Mỗi câu Claude lấy <strong>MỘT mẫu đến hạn</strong>, viết câu tiếng Nhật có{' '}
            <strong>một chỗ trống</strong> <code>(＿＿)</code> kèm nghĩa tiếng Việt, và đưa{' '}
            <strong>4 đáp án A/B/C/D</strong> (mẫu đúng + 3 mẫu <em>dễ nhầm</em>). Bạn chọn một chữ
            cái; Claude chấm (sai thì mẫu tự quay lại hàng đợi ôn) và giảng vì sao đúng, phân biệt
            với mẫu gây nhiễu.
          </p>
          <p>
            <strong>Đề quiz được app kiểm, không phó mặc cho Claude.</strong> Vị trí đáp án đúng do{' '}
            <em>server</em> xếp ngẫu nhiên vào A–D — Claude không được chọn, nên không có chuyện đáp
            án cứ rơi vào một chữ cái. App cũng <strong>từ chối bộ đáp án bị trùng nhau</strong>{' '}
            trước khi câu hỏi hiện ra. Đúng <strong>một</strong> phương án được chấp nhận; ba phương
            án nhiễu phải khác nhau về <em>nghĩa</em>, không được chỉ là dạng chia hay thể lịch sự
            của cùng một từ.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="ask-anything">
          <p>
            Cứ <strong>hỏi Claude bất cứ mẫu hay từ nào</strong> — không cần mở app, không cần biết
            tool nào tên gì, không cần đang trong buổi luyện. Trước khi giảng, Claude{' '}
            <strong>tự tra kho của bạn</strong> để biết bạn đang đứng ở đâu với mẫu đó.
          </p>
          <p>
            Rồi nó nói thẳng bạn đang thiếu gì, và <strong>đề nghị làm hộ</strong>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Chưa có trong kho → <strong>thêm vào</strong> để học.
            </li>
            <li>
              Có rồi nhưng <strong>chưa có thẻ</strong>, thẻ <strong>còn thiếu</strong>, thẻ{' '}
              <strong>bị lỗi</strong>, hay thẻ theo <strong>format cũ</strong> → soạn/bổ sung. Nó
              nói rõ thiếu <em>phần nào</em> (bẫy? phân biệt? cách chia?), không nói chung chung.
            </li>
            <li>
              Mẫu đang <strong>tạm ngưng</strong> (sẽ không bao giờ ra đề) hay ở{' '}
              <strong>cấp ngoài phạm vi đang học</strong> → bật lại / mở rộng cấp.
            </li>
            <li>Đang đến hạn, chưa học lần nào, hay hay quên → luyện riêng mẫu đó ngay.</li>
          </ul>
          <p>
            Ngại bị hỏi đi hỏi lại? Trong <em>Cài đặt → Nội dung</em> có ô{' '}
            <strong>“Cho Claude tự làm giúp”</strong> — mặc định <strong>tắt hết</strong>. Bật một
            mục là bạn <strong>cho phép trước</strong> đúng loại việc đó (thêm từ bạn vừa hỏi · bổ
            sung phần thiếu vào thẻ): Claude làm luôn rồi báo lại một dòng.
            Chỉ những việc <strong>thêm vào và huỷ được</strong> mới có mặt ở đó — không có mục nào
            cho việc ghi đè hay đụng vào lịch ôn.
          </p>
          <p>
            Mỗi lần <strong>tối đa 2 đề nghị</strong> (giữa buổi luyện chỉ 1, để không chen ngang
            câu đang làm), và <strong>không bao giờ tự làm</strong> — bạn đồng ý thì nó mới làm. Lời
            giảng là <strong>của Claude</strong>: thẻ trong kho chỉ là tài liệu tham khảo, app cố
            tình <em>không</em> hiện nguyên văn thẻ ra để không thành đọc lại thẻ.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="production-ladder">
          <p>
            Dịch <strong>Việt → Nhật</strong> khó hơn <strong>Nhật → Việt</strong> rất nhiều — đó là
            chuyện bình thường, không phải bạn kém. Nhưng trước đây app chỉ có hai đầu đó, nên nếu
            tự dịch sang Nhật thấy quá khó thì cách duy nhất là ở lại Nhật → Việt mãi và{' '}
            <strong>không bao giờ luyện phần sản xuất</strong>. Giờ có hai bậc ở giữa:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Điền mẫu</strong> — Claude cho câu Việt <em>và</em> câu Nhật đã viết gần xong,
              chỉ để trống đúng chỗ của mẫu ngữ pháp. Bạn chỉ điền mẫu, không phải dựng cả câu. Nói
              «cho tôi điền mẫu».
            </li>
            <li>
              <strong>Dịch có khung</strong> — bạn tự viết cả câu Nhật, nhưng được cho sẵn mẫu (kèm
              dạng gắn) và 2–4 từ khoá kèm cách đọc. Bỏ gánh nhớ từ, giữ gánh dựng câu. Nói «cho gợi
              ý từ».
            </li>
          </ul>
          <p>
            Sai một câu tự dịch thì Claude sẽ <strong>đề nghị</strong> câu sau có khung, làm đúng
            vài câu liền thì đề nghị bỏ khung — luôn là đề nghị, bạn quyết. Và có trợ giúp thì câu
            đúng chỉ được tối đa <strong>3 (Good)</strong>, không được 4: nếu không lịch ôn sẽ tưởng
            bạn tự làm được trong khi bạn chỉ nhận ra.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="difficulty-anchors">
          <p>
            Bốn thứ trước đây hay bị gộp làm một, giờ là bốn ô riêng — mỗi ô một việc:{' '}
            <strong>Cấp JLPT</strong> quyết mẫu ngữ pháp nào được đưa vào học ·{' '}
            <strong>Trần từ vựng</strong> quyết từ vựng khó tới đâu (để «Theo cấp ngữ pháp» là nó tự
            đi theo) · <strong>Cỡ câu</strong> quyết độ dài · <strong>Độ phức tạp</strong> quyết{' '}
            <em>hình dạng</em> câu.
          </p>
          <p>
            Mỗi mức độ phức tạp 1–5 giờ có định nghĩa <strong>đếm được</strong> (số mệnh đề, độ sâu
            lồng nhau, sắc thái trợ từ) hiện ngay dưới thanh trượt — và Claude nhận đúng câu định
            nghĩa đó. Trước đây nó chỉ là con số 2/5, nên «4» của bạn và «4» của Claude có thể là
            hai thứ khác nhau.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="new-pattern-pace">
          <p>
            Mẫu chưa gặp lần nào được đưa vào <strong>từng cái một</strong>: mỗi mẫu mới đều kèm một
            bài giảng nhỏ, nên nhồi 2–3 mẫu lạ vào cùng một câu vừa quá tải vừa làm câu mất tự
            nhiên. Đây là hai hạn mức <em>khác nhau</em>, và chúng nằm ở hai tab khác nhau đúng vì
            chúng đo hai thứ khác nhau: <strong>mẫu mới/ngày</strong> (hạn mức theo NGÀY, ở{' '}
            <em>Nhịp học</em>) và <strong>mẫu mới tối đa/câu</strong> (ngân sách của MỘT câu, ở{' '}
            <em>Nội dung</em> → «Câu trông như thế nào», mặc định 1).
          </p>
          <p>
            Mẫu bị hoãn <strong>không mất đi</strong> — nó xuất hiện ở câu kế tiếp, và Claude sẽ nói
            rõ vì sao chưa đưa vào. Muốn học dồn hơn thì nâng con số đó lên.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="mastery">
          <p>
            Khi trong ngày bạn đã <strong>hết mẫu đến hạn</strong> VÀ đã{' '}
            <strong>đạt hạn mức mẫu mới/ngày</strong>, buổi học không kết thúc. Claude{' '}
            <strong>hỏi</strong> bạn có muốn chuyển sang <em>luyện thành thạo</em> không.
          </p>
          <p>
            Đồng ý thì nó lấy một nhóm <strong>đa dạng</strong> các mẫu bạn{' '}
            <strong>đã thuộc</strong> (ngẫu nhiên khắp kho, không phải mẫu sắp đến hạn) và tái tổ
            hợp vào câu <strong>khó/dài hơn</strong>, bối cảnh mới — luyện vận dụng chứ không giới
            thiệu mẫu mới. Dịch sai mẫu nào thì mẫu đó tự quay lại hàng ôn: đây là cách phát hiện
            điểm yếu.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="modes">
          <p>
            Vẫn cùng một kho, một lịch FSRS và một bộ cài đặt — chỉ đổi cách hỏi cho đỡ nhàm. Nói
            thẳng với Claude là chuyển ngay giữa buổi.
          </p>
          <p>
            <strong>Luyện theo truyện</strong> (<code>story_practice</code>): Claude dệt 6–8 mẫu/từ
            đến hạn vào <strong>một đoạn hội thoại hoặc truyện ngắn</strong> liền mạch. Bạn dịch
            từng câu rồi nộp một lần — luyện đọc hiểu mạch dài thay vì câu rời rạc.
          </p>
          <p>
            <strong>Luyện nói theo tình huống</strong> (<code>conversation</code>): Claude dựng một
            bối cảnh thật — bạn là ai, đang nói với ai, ở đâu — kèm văn phong cần dùng và các mẫu/từ
            đến hạn. Bạn <strong>tự đặt câu tiếng Nhật</strong> hợp cảnh (không phải dịch câu cho
            sẵn); Claude chấm cả mức hợp văn phong lẫn cách dùng từng mẫu rồi ghi vào lịch ôn. Đang
            ở buổi dịch hay quiz, chỉ cần nói <em>“cho luyện nói”</em> là sang ngay.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="teach-back">
          <p>
            Dịch đúng một mẫu chưa chắc là hiểu nó. Nói <em>“giảng lại”</em> (hoặc chạy{' '}
            <code>teach_back</code>): Claude đưa <strong>một mẫu</strong> và bạn{' '}
            <strong>giải thích bằng tiếng Việt</strong> — nghĩa là gì, gắn vào đâu, khi nào người
            Nhật dùng nó, kèm một ví dụ của riêng bạn.
          </p>
          <p>
            Claude chấm phần giải thích theo ba lớp: <strong>đúng</strong> (điều bạn nói có sai
            không), <strong>đủ</strong> (bạn bỏ sót gì) và <strong>ví dụ</strong> (câu bạn tự đặt có
            thật sự cần mẫu đó không), rồi cho rating 1–4 vào <strong>cùng lịch FSRS</strong> như
            mọi kiểu luyện khác. Chỗ bạn <em>bỏ sót</em> thường là thứ giá trị nhất buổi học tìm ra.
          </p>
          <p>
            Và nó chảy ngược vào kho: nếu bạn giảng tốt một mẫu <strong>chưa có thẻ</strong>, Claude
            hỏi có lưu <strong>chính lời bạn</strong> làm phần “cách dùng” của thẻ đó không. Thẻ
            được viết bằng cách nói đã giúp bạn nhớ — Claude chỉ sửa lỗi gõ, không viết lại theo
            giọng của nó, và không bao giờ tự lưu khi bạn chưa đồng ý.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="declared-scaffolding">
          <p>
            Một câu luyện hiếm khi chỉ chứa đúng mấy mẫu đến hạn — Claude phải chêm thêm ngữ pháp
            khác cho câu tự nhiên. Trước đây phần chêm đó <strong>vô hình</strong>: một mẫu bạn chưa
            từng gặp có thể trôi qua mà không ai nói gì, và quy tắc “không chêm mẫu khó hơn cấp đang
            luyện” thì không có gì kiểm được.
          </p>
          <p>
            Giờ Claude phải <strong>khai báo</strong> những mẫu nó dùng ngoài lô. sakubun đối chiếu
            với kho của bạn và trả lời từng mẫu: <strong>đã có</strong> (không cần làm gì) hay{' '}
            <strong>hoàn toàn mới với bạn</strong> — trường hợp sau Claude phải giảng một câu ngay
            trong lượt đó và hỏi có thêm vào kho không. Bạn không phải hỏi mới được giải thích.
          </p>
          <p>
            Kèm theo đó là một cái chặn: mẫu nào <strong>khó hơn cấp câu đang luyện</strong> sẽ bị
            báo, để Claude viết lại câu hoặc nói thẳng là nó đã với quá tay. Và vì mọi thứ được ghi
            lại, kho lịch sử biết chính xác bạn đã được tiếp xúc với những gì — không chỉ những gì
            được chấm điểm.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="vocab">
          <p>
            Đang luyện mà gặp từ chưa biết: hỏi Claude nghĩa (hoặc nói <em>“thêm từ này”</em>) —
            Claude lưu vào kho từ vựng của sakubun. Các từ này về sau được{' '}
            <strong>dệt lại vào câu dịch</strong> để bạn nhớ TRONG NGỮ CẢNH, và được ôn theo FSRS
            riêng. Xem chúng ở <em>Tài nguyên → Từ vựng</em>.
          </p>
          <p>
            Claude còn <strong>chủ động gợi ý</strong> từ đáng ôn: từ bạn vừa{' '}
            <strong>dùng sai</strong>, từ bạn <strong>chưa hiểu</strong> khi gặp, hoặc từ thông dụng
            ở cấp của bạn mà <strong>chưa dùng bao giờ</strong>. Mỗi từ mang một{' '}
            <strong>badge lý do</strong> và có bộ lọc riêng để ôn theo nhóm. Chúng chạy trên{' '}
            <strong>ngân sách riêng</strong> (chỉnh <em>“Từ vựng / câu”</em> trong Cài đặt → Nhịp
            học, 0–5) nên không lấn chỗ ngữ pháp; đặt 0 để tắt.
          </p>
        </GuideTopicItem>

        <GuideTopicGroupHeading group="store" />

        <GuideTopicItem id="enrichment">
          <p>
            Nhờ Claude chạy <code>enrich_backlog</code> một lần: nó soạn cho mỗi mẫu một{' '}
            <strong>thẻ enrichment</strong> gồm cách dùng, cụm đi kèm, ví dụ mẫu,{' '}
            <strong>bẫy hay gặp</strong> và <strong>phân biệt với mẫu gần nghĩa</strong>. Mẫu đã có
            thẻ hiện icon{' '}
            <Sparkles className="inline size-3.5 align-text-bottom text-primary" aria-hidden /> ở
            bảng <em>Ngữ pháp</em> — bấm vào mẫu để đọc thẻ ở tab <em>Thẻ chi tiết</em>.
          </p>
          <p>
            <strong>Từ vựng cũng có thẻ</strong>, và thước đo của nó khác: một từ không cần «cách
            chia», nhưng cần <strong>cụm / khung câu hay đi kèm</strong> (約束を守る, 会議に出る),{' '}
            <strong>từ đồng nghĩa và từ trái nghĩa</strong> — mỗi từ kèm cách đọc và nghĩa tiếng Việt,
            bấm nghe được, và nếu từ đó cũng nằm trong kho thì có link sang thẳng nó — cùng ít nhất
            hai ví dụ <strong>đều có bản dịch</strong>. Bảng <em>Từ vựng</em> có bộ lọc{' '}
            <em>Thẻ chi tiết</em> y như bảng ngữ pháp, nên bạn thấy ngay từ nào còn thiếu.
          </p>
          <p>
            Thẻ không chỉ để đọc: câu luyện và lời giảng của Claude <strong>bám theo thẻ</strong>{' '}
            nên sắc và đúng trọng tâm hơn, còn đáp án nhiễu của <em>quiz</em> lấy từ phần “phân biệt
            mẫu gần nghĩa”. Trang <em>Phân tích</em> còn <strong>nhắc</strong> khi mẫu ở đúng trình
            độ bạn đang học mà <strong>chưa có thẻ</strong>, để bạn enrich nốt.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="card-ratchet">
          <p>
            Thẻ không phải soạn một lần rồi thôi. <strong>Mỗi lần bạn hỏi Claude về một mẫu</strong>
            , nó đọc thẻ hiện có, giảng bằng lời của nó, rồi nếu trong lời giảng có{' '}
            <strong>một mẫu gần nghĩa, một cái bẫy hay một ví dụ mà thẻ còn thiếu</strong>, nó hỏi
            bạn một câu: thêm phần đó vào thẻ chứ? Bạn đồng ý thì thẻ dày thêm — nên càng dùng lâu,
            kho càng ra chất của <em>bạn</em>.
          </p>
          <p>
            Điểm quan trọng: phần thêm là <strong>thêm, không ghi đè</strong>. Mọi thứ đã có trên
            thẻ được giữ nguyên; trùng thì bỏ qua; đầy chỗ thì nói rõ là đã bỏ phần nào chứ không im
            lặng. Nếu thẻ đang <strong>nói sai</strong> so với điều Claude biết, nó cũng nói ra và
            xin phép sửa lại — thẻ tự chữa được, không đóng băng theo một lần soạn hỏng.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="mistake-mining">
          <p>
            Khi chấm một câu sai, Claude không chỉ ghi <em>“sai loại gì”</em> nữa mà ghi cả{' '}
            <strong>cặp nhầm lẫn</strong>: bạn đã <strong>dùng</strong> cái gì, trong khi câu{' '}
            <strong>cần</strong> cái gì. Khác biệt nghe nhỏ nhưng quyết định: “sai chọn từ” là một
            cái nhãn, còn <em>“dùng 「ほかに」 ở chỗ đáng ra là 「〜どころか」”</em> là một bài học
            dạy được.
          </p>
          <p>
            Nhầm đúng cặp đó <strong>từ 3 lần trở lên</strong> và vẫn còn gần đây, lần sau bạn hỏi
            về mẫu ấy, app sẽ nói thẳng:{' '}
            <em>
              “bạn đã 3 lần dùng 「ほかに」 ở chỗ đáng ra là 「〜どころか」 — thêm mục phân biệt vào
              thẻ chứ?”
            </em>{' '}
            Nếu mẫu đó <strong>chưa có thẻ</strong>, lời nhắc đi kèm luôn vào đề nghị soạn thẻ, để
            phần phân biệt được viết ngay từ đầu.
          </p>
          <p>
            Hai chi tiết cố ý: lỗi <strong>cũ dần thì nhẹ dần</strong> (ba lần nhầm của hai tháng
            trước không còn là khó khăn hiện tại), và mỗi đề nghị đều{' '}
            <strong>kèm câu cụ thể</strong> bạn đã sai để bạn kiểm chứng — app không được phép kết
            luận về bạn mà không đưa bằng chứng.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="library-health">
          <p>
            Hỏi Claude <em>“kho của tôi đang thế nào?”</em> là đủ. Nó trả về một bản khám gọn: kho
            có bao nhiêu mẫu, <strong>bao nhiêu thẻ đạt / chưa đạt</strong>, cấp bạn đang học còn
            thiếu thẻ ở đâu, còn bao nhiêu mẫu <strong>dưới cấp</strong> vẫn nằm trong hàng đợi, và{' '}
            <strong>bạn nhớ thực tế bao nhiêu phần trăm</strong> so với mục tiêu lịch ôn đang đặt.
          </p>
          <p>
            Con số quan trọng nhất là con số cuối. Lịch ôn FSRS luôn <em>nhắm</em> tới một mức ghi
            nhớ — nhưng có khớp với trí nhớ thật của bạn hay không thì phải đo. Quên nhiều hơn mức
            nhắm ⇒ đề nghị <strong>nâng mục tiêu</strong> (ôn dày hơn); nhớ tốt hơn hẳn ⇒ đề nghị{' '}
            <strong>hạ xuống</strong> để ôn thưa mà vẫn đạt. Chưa đủ dữ liệu thì nó nói thẳng là
            chưa đủ, thay vì vẽ ra một tỉ lệ nghe có vẻ chắc chắn.
          </p>
          <p>
            Cuối bản khám tối đa <strong>hai việc nên làm trước</strong> — soạn bù thẻ, cập nhật thẻ
            format cũ, gom các mẫu đang cùng dính một loại lỗi thành nhóm luyện, hay tạm ẩn phần
            dưới cấp để đi thẳng vào trình độ của bạn. Đồng ý cái nào thì Claude làm cái đó; không
            đồng ý thì không có gì thay đổi.
          </p>
          <p>
            Bạn cũng không cần nhớ hỏi: <strong>mở buổi học nào cũng vậy</strong>, khối{' '}
            <em>Tiến độ</em> sẽ kèm <strong>đúng một</strong> gợi ý dọn kho nếu có gì đáng làm — hỏi
            một câu, có hoặc không, rồi vào học. Không có gì đáng nhắc thì nó im lặng, và trong buổi
            đó nó không nhắc lại lần hai.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="library">
          <p>
            Trang <em>Tài nguyên</em> là nơi bạn <strong>làm chủ kho học</strong>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Thêm ngữ pháp và từ vựng</strong> bằng ba cách, chọn ở thanh tab đầu trang:{' '}
              <strong>gõ từng mục theo trường</strong>, <strong>dán cả danh sách</strong>, hoặc tải{' '}
              <strong>file Excel</strong> từ Mazii (hoặc nhờ Claude nhập bằng prompt) — tuỳ danh
              sách một mục hay hàng trăm mục. Màn hình rộng thì mở ra <strong>modal</strong> ngay
              trên danh sách; điện thoại thì mở <strong>một trang riêng</strong> (có nút back, có
              URL, gõ dở không mất khi lỡ chuyển màn).
            </li>
            <li>
              <strong>Tìm nhanh</strong> bằng kanji, kana hoặc <strong>romaji</strong>: gõ{' '}
              <code>toshokan</code> vẫn ra <span lang="ja">図書館</span>, không cần bộ gõ tiếng
              Nhật.
            </li>
            <li>
              <strong>Tạm ngưng</strong> một mẫu bạn đã thuộc (ẩn khỏi lịch ôn, không xoá — bật lại
              lúc nào cũng được), hoặc <strong>chọn nhiều mục</strong> để tạm ngưng / xoá{' '}
              <strong>hàng loạt</strong>.
            </li>
            <li>
              <strong>Nhảy nhanh tới đúng trình độ</strong>: nhờ Claude ẩn hàng loạt mẫu{' '}
              <strong>dưới cấp hiện tại</strong> để chỉ ôn mẫu đúng tầm (bật lại bất cứ lúc nào).
            </li>
            <li>
              Tuỳ biến bảng: hiện/ẩn cột (kể cả cột STT), kéo đổi thứ tự và độ rộng cột, lọc theo
              cấp / trạng thái / đánh dấu sao.
            </li>
            <li>
              <strong>Làm hàng loạt</strong>: tick chọn nhiều dòng, các nút tác vụ hiện thành một{' '}
              <strong>cột icon dọc bên phải màn hình</strong> — ô đầu là{' '}
              <strong>số mục đã chọn</strong>, kế đó là nút <strong>×</strong> để bỏ chọn, rồi tạm
              ngưng / thêm-gỡ nhóm / xoá. Đưa chuột vào từng icon để xem tên tác vụ.
            </li>
            <li>
              <strong>Phím tắt bàn phím</strong> cho bảng (xem danh sách ở icon <em>ⓘ</em> góc trên
              phải bảng): <code>/</code> vào ô tìm, <code>n</code> / <code>p</code> sang trang
              sau/trước, <code>a</code> chọn cả trang, <code>c</code> mở menu Cột, <code>Esc</code>{' '}
              xoá từ khoá rồi bỏ chọn. Mọi ô nhập trong app đều có nút <strong>×</strong> để xoá
              nhanh nội dung đang gõ.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Xoá một mẫu/từ chỉ gỡ khỏi kho học — <strong>lịch sử câu đã dịch vẫn được giữ</strong>{' '}
            để thống kê.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="groups">
          <p>
            Nhóm là một <strong>tập hợp có tên</strong> các mẫu ngữ pháp và/hoặc từ vựng bạn muốn
            học cùng nhau (một bài, một chủ đề, một đợt thi). Mỗi nhóm có <strong>loại</strong>:{' '}
            <em>ngữ pháp</em> (chỉ nhận mẫu), <em>từ vựng</em> (chỉ nhận từ), hay <em>hỗn hợp</em>{' '}
            (nhận cả hai). Một mục có thể nằm trong nhiều nhóm.
          </p>
          <p>
            Quản lý ở <em>Tài nguyên → tab «Nhóm»</em>: tạo, sửa, xoá, và mở một nhóm ra để{' '}
            <strong>thêm / gỡ thành viên</strong>. Trong nhóm còn có{' '}
            <strong>chế độ flashcard</strong> để lướt nhanh: lật thẻ, tự chấm nhớ/quên, xáo thứ tự,
            phóng toàn màn hình. Xoá một nhóm chỉ xoá cái nhóm —{' '}
            <strong>mẫu và từ trong đó vẫn nguyên trong kho</strong>, kèm lịch ôn của chúng.
          </p>
          <p>
            Không phải vào tận trong nhóm mới thêm được. Ở hai tab <em>Ngữ pháp</em> /{' '}
            <em>Từ vựng</em>, tick chọn nhiều dòng rồi dùng{' '}
            <strong>«Thêm vào nhóm» / «Gỡ khỏi nhóm»</strong> trong cột icon bên phải —{' '}
            <em>Gỡ</em> chỉ liệt kê những nhóm mà các dòng đang chọn thật sự thuộc về, và nhóm sai
            loại không bao giờ được đề xuất. Trang chi tiết một mẫu/từ hiện các nhóm nó đang thuộc
            thành <strong>chip bấm được</strong>, mỗi chip có nút gỡ, cạnh đó là nút thêm vào một
            nhóm khác.
          </p>
          <p>
            Luyện tập trung một nhóm: trong Claude Desktop nói <em>“luyện nhóm X”</em> — Claude lấy
            các mẫu <strong>trong nhóm đó</strong> làm trọng tâm (thiếu độ dài thì bù mẫu khác như
            luyện theo cấp). Claude cũng có thể <strong>đề xuất một nhóm</strong> (tên + các mục)
            khi bạn nhờ; nó cho bạn xem trước, <strong>bạn duyệt</strong> rồi mới tạo thật. Nhóm chỉ
            để tổ chức và khoanh vùng luyện — <strong>không đụng tới lịch ôn FSRS</strong>.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="star">
          <p>
            Bấm ngôi sao để <strong>ghim</strong> những gì bạn muốn quay lại: một mẫu ngữ pháp khó
            nhằn, một từ hay quên, hay một <strong>lượt dịch trong Lịch sử</strong> có câu/nhận xét
            đáng nhớ. Sao có ở bảng <em>Ngữ pháp</em>, <em>Từ vựng</em>, trang chi tiết mẫu và mỗi
            thẻ trong <em>Lịch sử</em>.
          </p>
          <p>
            Sau đó dùng bộ lọc <em>“Đã đánh dấu sao”</em> ở mỗi trang để chỉ xem những mục đã ghim —
            một danh sách xem lại do chính bạn chọn. Sao chỉ để sắp xếp,{' '}
            <strong>không ảnh hưởng lịch ôn FSRS</strong>.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="progress">
          <p>
            Trang <em>Phân tích</em> cho bạn thấy mình đang học tới đâu và{' '}
            <strong>chỗ nào đang yếu</strong>, không chỉ “đã làm bao nhiêu câu”:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Tỉ lệ nhớ thực tế</strong> so với mục tiêu bạn đặt — biết cả kho đang được giữ
              ở mức nào.
            </li>
            <li>
              <strong>Điểm yếu 30 ngày</strong>: những mẫu/từ hay sai nhất, gom theo loại lỗi — bấm
              vào là tới thẳng trang mẫu đó để luyện riêng.
            </li>
            <li>
              Tab <em>Thống kê</em>: biểu đồ <strong>độ chính xác</strong> &amp;{' '}
              <strong>thời gian làm bài</strong> theo ngày/tuần/tháng, điểm theo{' '}
              <strong>độ khó / độ dài câu</strong> — để biết mình đuối ở dạng câu nào.
            </li>
            <li>
              Ngay trang chủ còn có <strong>lịch nhiệt 1 năm</strong> (ngày nào có học),{' '}
              <strong>dự báo 14 ngày tới</strong> (mỗi ngày bao nhiêu mục đến hạn), và phân bố kho
              theo <strong>cấp JLPT</strong> cùng <strong>trạng thái ghi nhớ</strong> — nhìn phát
              biết hôm tới nặng hay nhẹ.
            </li>
          </ul>
          <p>
            Mở trang chi tiết một mẫu (từ bảng Tài nguyên) còn có <strong>đường cong quên</strong>{' '}
            riêng của mẫu đó: xác suất bạn còn nhớ ngay bây giờ, độ bền trí nhớ, khi nào đến hạn ôn.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="learner-profile">
          <p>
            Càng dùng lâu, app càng rút ra được vài điều về <em>riêng bạn</em> — và mục{' '}
            <strong>Hồ sơ học của bạn</strong> ở trang <em>Phân tích</em> cho bạn xem đúng những gì
            Claude được đọc trước khi ra đề. Không có gì giấu ở đằng sau.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Hay nhầm</strong>: bạn hay với tay sang mẫu nào trong khi câu cần mẫu nào —
              lấy từ chính lỗi Claude chấm, phải lặp lại đủ nhiều và còn mới thì mới hiện.
            </li>
            <li>
              <strong>Nhịp học của bạn</strong>: trung bình bạn cần gặp một mẫu bao nhiêu lần thì nó
              vào nhịp ôn, văn phong lệch bao nhiêu phần trăm lượt hội thoại, chủ đề nào bạn viết
              tốt nhất.
            </li>
            <li>
              <strong>Claude ghi nhận</strong>: tối đa 5 nhận xét bằng lời, mỗi nhận xét{' '}
              <strong>bắt buộc kèm câu làm bằng chứng</strong> (bấm nghe được, hoặc mở thẳng trong
              Lịch sử). Nhận xét tự hết hạn sau 60 ngày nếu không lặp lại.
            </li>
          </ul>
          <p>
            Thấy dòng nào sai thì cứ nói lại với Claude trong buổi học — đó là lý do mỗi nhận xét
            đều phải chỉ ra được câu nào khiến nó nghĩ vậy. Chưa đủ dữ liệu thì mục này{' '}
            <strong>không hiện</strong>, chứ không đoán bừa.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="streak">
          <p>
            Mỗi ngày có luyện là một mắt xích của <strong>chuỗi</strong>. Trên trang{' '}
            <em>Phân tích</em>, chuỗi hiện dưới dạng <strong>ngọn lửa</strong> — càng dài càng đổi
            màu/rực theo mốc (3 · 7 · 14 · 30 · 100…). Lập mốc mới thì có hiệu ứng{' '}
            <strong>ăn mừng</strong> giữa màn hình; bấm vào ngọn lửa để xem lại bất cứ lúc nào.
          </p>
          <p className="text-muted-foreground">
            Chuỗi tính theo “ngày học” (mốc chốt ngày trong Cài đặt) nên luyện khuya vẫn đúng ngày.
            Tôn trọng <em>prefers-reduced-motion</em> — tắt hiệu ứng hệ thống thì chỉ hiện tĩnh.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="data">
          <p>
            Vào <em>Cài đặt → Dữ liệu</em>. <strong>Xuất JSON</strong> tải về toàn bộ kho + lịch ôn
            + lịch sử của riêng bạn thành một tệp — để sao lưu hoặc chuyển máy.{' '}
            <strong>Nhập gộp</strong> đưa tệp đó trở lại: có <strong>xem trước</strong> và chỉ THÊM
            / CẬP NHẬT, <strong>không bao giờ xoá</strong> gì đang có.
          </p>
          <p>
            Ngoài ra có <strong>xuất từ vựng sang Anki</strong> (tệp <code>.apkg</code>) nếu bạn
            muốn ôn từ trong Anki — các bước chi tiết ở tab <em>Theo việc</em>.
          </p>
        </GuideTopicItem>

        <GuideTopicGroupHeading group="experience" />

        <GuideTopicItem id="sensory">
          <p>
            Trong Cài đặt → tab <em>Nghe &amp; nói</em> chọn <strong>cách ra đề</strong> (chỉ chữ ·
            vừa chữ vừa nói · chỉ nói — giấu chữ để luyện nghe) và <strong>cách trả lời</strong>{' '}
            (được nói hoặc viết · chỉ nói để bắt phát âm). Claude phát/nhận giọng qua{' '}
            <strong>voice mode của Claude Desktop</strong> (bạn tự bật).
          </p>
          <p>
            Ở khắp nơi có câu tiếng Nhật (Lịch sử, Tài nguyên, xem trước trong Cài đặt) đều có{' '}
            <strong>nút phát âm tham khảo</strong> (giọng VOICEVOX). Mẹo:{' '}
            <strong>bấm lại ngay lần 2 sẽ đọc chậm</strong> (như nút loa Google Dịch) để nghe kỹ câu
            khó; đổi tốc độ mặc định bằng thanh trượt <em>“Tốc độ đọc”</em>. App không ghi âm bạn.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="furigana">
          <p>
            Cài đặt → tab <em>Nội dung</em> → <em>Furigana</em> có <strong>4 chế độ</strong> (app
            luôn sẵn dữ liệu cách đọc — mục này chỉ chọn NƠI hiển thị): chỉ trong app · chỉ bên
            Claude (chèn （かな） vào câu đề) · cả hai · tắt.
          </p>
          <p>
            Trong app, furigana <strong>hiện khi rê chuột</strong> vào câu tiếng Nhật (điện thoại
            hiện luôn) — là gợi ý, không lộ sẵn. Khi bấm phát âm, chữ{' '}
            <strong>sáng dần theo giọng đọc</strong> (hiệu ứng karaoke), đồng bộ ở mọi nơi có tiếng
            Nhật.
          </p>
        </GuideTopicItem>

        <GuideTopicItem id="quality">
          <p>
            <strong>Sáng / tối</strong>: đổi giao diện ở thanh bên (theo hệ thống hoặc chọn tay) —
            toàn app đổi theme đồng bộ.
          </p>
          <p>
            <strong>Tự làm mới</strong>: khi bạn luyện bên Claude Desktop, các trang{' '}
            <em>Lịch sử</em>, <em>Phân tích</em>, <em>Tài nguyên</em> tự cập nhật sau vài giây —
            không phải bấm tải lại để thấy lượt vừa xong.
          </p>
          <p>
            <strong>Trợ giúp đúng lúc</strong>: trang này có <strong>ô tìm</strong> — gõ vài chữ (kể
            cả không dấu, vd <code>cach doc</code>) là ra đúng mục, khỏi phải cuộn. Ngược lại, ở
            những chỗ dễ mắc trong app (kho còn trống, thẻ token MCP, mẫu chưa có thẻ chi tiết) đều
            có một dòng <em>«Xem hướng dẫn»</em> nhỏ mở <strong>đúng mục</strong> của trang này.
          </p>
          <p>
            <strong>Điều hướng nhanh trên màn hình nhỏ</strong>: khi cửa sổ hẹp, thanh bên thu lại
            thành nút nằm cùng hàng breadcrumb. Lúc đó có một <strong>vạch mỏng ở rìa trái</strong>{' '}
            màn hình — đưa chuột vào (hoặc chạm) là trượt ra <strong>dải icon các trang</strong>,
            bấm một lần là sang trang, không cần mở thanh bên.
          </p>
        </GuideTopicItem>
      </GuideTopicBrowser>
    </TabsContent>
  );
}
