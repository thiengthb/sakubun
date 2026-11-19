// Builds the three frames; each option page defines laptop(), phone() and sheet() returning HTML.
const SIDE = `<div class="side"><div class="brand"><div class="logo">作文</div><div><b>Sakubun</b><div class="meta" style="margin:0">Luyện dịch Nhật–Việt</div></div></div>
<div class="g">Học</div><div class="i">Hôm nay</div><div class="i">Ôn nhanh</div><div class="i">Hội thoại</div>
<div class="g">Kho</div><div class="i on">Kho</div><div class="g">Bạn</div><div class="i">Tiến độ</div><div class="i">Phân tích</div><div class="i">Cài đặt</div></div>`;
const TABS = `<div class="tabs" style="z-index:3"><span>Hôm nay</span><span>Ôn nhanh</span><span>Hội thoại</span><span class="on">Kho</span><span>Bạn</span></div>`;
// Sample items outside JLPT: [expression, reading, meaning, source, state]. Source: c Claude soạn, m tự viết, s từ bộ chia sẻ.
const IT = [['締め切り','しめきり','hạn chót','c','due'],['見積もり','みつもり','báo giá','c','learn'],['気まずい','きまずい','ngượng ngùng','c','ok'],['推し','おし','người mình hâm mộ','c','ok'],['積ん読','つんどく','mua sách rồi để đó','c','new'],['手応え','てごたえ','cảm giác có kết quả','c','learn'],['打ち合わせ','うちあわせ','buổi họp bàn','c','ok'],['微妙','びみょう','khó nói, tế nhị','c','due'],
['先輩','せんぱい','tiền bối','m','ok'],['名刺','めいし','danh thiếp','m','ok'],['了解','りょうかい','đã hiểu','m','ok'],['残業','ざんぎょう','làm thêm giờ','m','learn'],['有給','ゆうきゅう','nghỉ phép có lương','m','new'],
['仕様','しよう','đặc tả','s','learn'],['不具合','ふぐあい','lỗi (phần mềm)','s','due'],['納期','のうき','hạn giao hàng','s','new'],['本番','ほんばん','môi trường thật','s','new'],['共有','きょうゆう','chia sẻ','s','ok']];
const SRC = {c:'Claude soạn',m:'Tự viết',s:'Bộ "IT công sở" của Minh'};
const LABEL = {ok:'Đã thuộc',learn:'Đang học',due:'Đến hạn',new:'Chưa học'};
const pill = s => `<span class="pill" style="background:var(--${s==='new'?'new':s}-soft);color:var(--${s==='new'?'mute':s})">${LABEL[s]}</span>`;
// A strip of n state dots drawn from a pattern string (o ok, l learn, d due, n new).
const MAP = {o:'ok',l:'learn',d:'due',n:'new'};
const dots = p => `<div class="dots">${[...p].map(c=>`<i class="d-${MAP[c]}"></i>`).join('')}</div>`;
const WAYS = [
 ['N','#f3d9cc','var(--brand)','Lấy theo cấp JLPT','Mở bảng N5–N1, lấy từng chặng 20 từ'],
 ['B','#d5ebdd','var(--ok)','Bộ người khác chia sẻ','Mở Kho chung: bộ theo chủ đề, lấy về là của bạn'],
 ['C','#e7e2f6','#5b4bb0','Nhờ Claude soạn','Gửi Claude đoạn văn hay chủ đề, Claude thêm vào kho qua Sakubun'],
 ['+','#e7eaee','var(--ink)','Tự viết','Gõ chữ, cách đọc, nghĩa; thêm một mục ngay'],
];
const way = w => `<div class="way"><div class="ic" style="background:${w[1]};color:${w[2]}">${w[0]}</div><div><b>${w[3]}</b><span class="s">${w[4]}</span></div></div>`;
document.body.insertAdjacentHTML("beforeend", `<div class="laptop">${SIDE}<div class="main">${laptop()}</div></div><div class="phone"><div class="main">${phone()}</div>${TABS}</div><div class="phone">${sheet()}</div>`);
