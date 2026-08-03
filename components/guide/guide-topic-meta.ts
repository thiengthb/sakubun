/**
 * THE registry of `/guide` "Tính năng" topics — metadata only, deliberately free of JSX and icons so a
 * CLIENT component (the search box, a deep-link gate) can import it for a few kilobytes of strings while
 * the topic BODIES stay server-rendered in `guide-features.tsx` (they are the bulk of the copy and cost
 * zero client JS that way).
 *
 * One entry per topic, in READING ORDER within its group. `guide-features.tsx` supplies the body for each
 * id and `guide-search.tsx` the icon — both as `Record<GuideTopicId, …>`, so TypeScript itself fails the
 * build when an id here has no body/icon or vice versa (no drift test needed).
 *
 * Vietnamese copy on purpose: `title`/`summary` are what the learner reads (the `/guide` exemption from
 * the English-dev-artifact rule), `keywords` are the extra words someone would TYPE to find the topic
 * (synonyms, the English/technical token, the screen name) — they are searched, never displayed.
 */

export type GuideTopicGroupId = 'practice' | 'store' | 'community';

export interface GuideTopicGroup {
  id: GuideTopicGroupId;
  label: string;
  /** One line under the group heading — what this cluster of topics is about. */
  hint: string;
}

/** Group order = the order the tour renders in (most central to studying first). */
export const GUIDE_TOPIC_GROUPS: readonly GuideTopicGroup[] = [
  { id: 'practice', label: 'Luyện tập', hint: 'Các cách luyện với Claude Desktop.' },
  {
    id: 'store',
    label: 'Kho học & theo dõi',
    hint: 'Quản lý mẫu/từ của bạn và xem mình đang tới đâu.',
  },
  {
    id: 'community',
    label: 'Cộng đồng & trải nghiệm',
    hint: 'Chia sẻ với thành viên khác, nghe/nhìn và tiện ích giao diện.',
  },
];

export interface GuideTopicMeta {
  id: string;
  group: GuideTopicGroupId;
  title: string;
  summary: string;
  /** Extra search terms (never rendered). Keep ≥2 per topic. */
  keywords: readonly string[];
  /** When the topic first appeared — drives the "Mới cập nhật" list. Format YYYY-MM-DD. */
  addedOn: string;
}

export const GUIDE_TOPIC_META = [
  {
    id: 'translate',
    group: 'practice',
    title: 'Luyện dịch câu với người chấm là Claude',
    summary:
      'Tính năng cốt lõi: Claude ra câu vừa sức, bạn dịch, được chấm điểm + sửa lỗi, rồi lịch ôn tự giãn theo trí nhớ.',
    keywords: ['dịch', 'chấm điểm', 'rating', 'fsrs', 'vòng luyện', 'practice', 'lịch ôn'],
    addedOn: '2026-07-06',
  },
  {
    id: 'quiz',
    group: 'practice',
    title: 'Quiz trắc nghiệm A–D (nhanh hơn dịch)',
    summary:
      'Nói “quiz” với Claude; mỗi câu 1 mẫu ngữ pháp + 1 chỗ trống + 4 đáp án A–D — bạn chỉ chọn một chữ cái.',
    keywords: ['quiz', 'trắc nghiệm', 'chỗ trống', 'đáp án', 'abcd'],
    addedOn: '2026-07-13',
  },
  {
    id: 'ask-anything',
    group: 'practice',
    title: 'Hỏi Claude bất cứ mẫu nào — nó tự tra kho và đề nghị việc cần làm',
    summary:
      'Không cần mở app: Claude tra cả kho của bạn lẫn thư viện chung, rồi đề nghị lấy về / thêm / soạn thẻ / bật lại — bạn chỉ cần đồng ý.',
    keywords: [
      'hỏi',
      'tra cứu',
      'check_library',
      'đề xuất',
      'lấy về',
      'fork',
      'thẻ thiếu',
      'gia sư',
    ],
    addedOn: '2026-07-27',
  },
  {
    id: 'production-ladder',
    group: 'practice',
    title: 'Hai bậc giữa «đọc hiểu» và «tự dịch sang Nhật»',
    summary:
      'Việt → Nhật quá khó? Có bậc «điền mẫu» và «dịch có khung» ở giữa để leo dần, thay vì phải nhảy vực.',
    keywords: [
      'việt sang nhật',
      'vi_ja',
      'khó',
      'điền mẫu',
      'dịch có khung',
      'gợi ý',
      'thang',
      'sản xuất',
    ],
    addedOn: '2026-07-26',
  },
  {
    id: 'difficulty-anchors',
    group: 'practice',
    title: 'Bốn ô, bốn việc: cấp · từ vựng · độ dài · độ phức tạp',
    summary:
      'Ngữ pháp và từ vựng giờ đặt riêng, và mỗi mức «độ phức tạp» 1–5 có định nghĩa đếm được thay vì một con số suông.',
    keywords: ['độ khó', 'độ phức tạp', 'trần từ vựng', 'cấp jlpt', 'cỡ câu', 'setting'],
    addedOn: '2026-07-26',
  },
  {
    id: 'new-pattern-pace',
    group: 'practice',
    title: 'Mẫu mới vào từng cái một (không bị dồn)',
    summary:
      'Mỗi câu chỉ mang tối đa 1 mẫu bạn chưa gặp (đổi được ở Nhịp học) — mẫu bị hoãn sang câu sau, không mất.',
    keywords: ['mẫu mới', 'quá tải', 'nhịp học', 'hạn mức', 'mới mỗi câu'],
    addedOn: '2026-07-26',
  },
  {
    id: 'mastery',
    group: 'practice',
    title: 'Luyện thành thạo (không bao giờ hết bài)',
    summary:
      'Hết mẫu đến hạn trong ngày cũng không dừng — tái tổ hợp mẫu đã thuộc vào câu khó hơn để luyện vận dụng.',
    keywords: ['thành thạo', 'mastery', 'hết bài', 'vận dụng', 'câu khó'],
    addedOn: '2026-07-11',
  },
  {
    id: 'modes',
    group: 'practice',
    title: 'Đổi vị: luyện theo truyện & luyện nói theo tình huống',
    summary:
      'Chán dịch câu rời? Nói “luyện theo truyện” để dịch cả đoạn, hoặc “cho luyện nói” để tự đặt câu tiếng Nhật hợp cảnh.',
    keywords: [
      'truyện',
      'đoạn văn',
      'story_practice',
      'hội thoại',
      'luyện nói',
      'conversation',
      'tình huống',
    ],
    addedOn: '2026-07-23',
  },
  {
    id: 'teach-back',
    group: 'practice',
    title: 'Giảng lại: bạn dạy, Claude chấm',
    summary:
      'Nói “giảng lại” — Claude đưa một mẫu và BẠN giải thích bằng tiếng Việt; giải thích được mới là hiểu thật.',
    keywords: [
      'giảng lại',
      'giải thích',
      'teach back',
      'teach_back',
      'dạy lại',
      'kiểm tra hiểu',
      'protégé',
    ],
    addedOn: '2026-07-27',
  },
  {
    id: 'declared-scaffolding',
    group: 'practice',
    title: 'Ngữ pháp ngoài lô: không còn lướt qua âm thầm',
    summary:
      'Claude khai báo mẫu nó dùng ngoài lô hôm nay; mẫu nào bạn chưa từng gặp sẽ được giảng và mời thêm vào kho.',
    keywords: [
      'ngoài lô',
      'ngữ pháp lạ',
      'chưa học',
      'scaffolding',
      'giàn giáo',
      'extraPatterns',
      'vượt cấp',
    ],
    addedOn: '2026-07-28',
  },
  {
    id: 'vocab',
    group: 'practice',
    title: 'Học từ vựng trong ngữ cảnh',
    summary:
      'Tra từ khi luyện → lưu vào kho, được dệt lại vào câu dịch, ôn theo FSRS trên ngân sách riêng.',
    keywords: ['từ vựng', 'vocab', 'add_vocab', 'ngân sách', 'ngữ cảnh', 'badge lý do'],
    addedOn: '2026-07-11',
  },
  {
    id: 'enrichment',
    group: 'store',
    title: 'Thẻ chi tiết mẫu (enrichment)',
    summary:
      'Mỗi mẫu có một “thẻ” do Claude soạn: cách dùng, cụm đi kèm, ví dụ, bẫy hay gặp, phân biệt với mẫu gần nghĩa.',
    keywords: ['thẻ chi tiết', 'enrichment', 'enrich_backlog', 'bẫy', 'phân biệt', 'ví dụ'],
    addedOn: '2026-07-13',
  },
  {
    id: 'card-ratchet',
    group: 'store',
    title: 'Thẻ tự dày lên mỗi lần bạn hỏi',
    summary:
      'Hỏi Claude về một mẫu, phần nào trong lời giảng mà thẻ còn thiếu sẽ được đề nghị thêm vào thẻ — thêm, không ghi đè.',
    keywords: [
      'bổ sung thẻ',
      'thêm vào thẻ',
      'patch_enrichment',
      'không ghi đè',
      'thẻ dày lên',
      'lấy thẻ của người khác',
    ],
    addedOn: '2026-07-27',
  },
  {
    id: 'mistake-mining',
    group: 'store',
    title: 'Kho học từ chính lỗi của bạn',
    summary:
      'Nhầm cùng một cặp mẫu vài lần, app sẽ nhớ đúng CẶP đó và đề nghị ghi phần phân biệt vào thẻ.',
    keywords: ['lỗi lặp lại', 'nhầm mẫu', 'cặp nhầm lẫn', 'phân biệt', 'điểm yếu', 'học từ lỗi'],
    addedOn: '2026-07-27',
  },
  {
    id: 'library-health',
    group: 'store',
    title: 'Khám sức khoẻ cả kho trong một câu hỏi',
    summary:
      'Hỏi "kho của tôi thế nào?" — thẻ nào chưa đạt, lỗ hổng ở cấp đang học, lịch ôn có khớp trí nhớ thật không, và nên dọn gì trước.',
    keywords: [
      'sức khoẻ kho',
      'dọn kho',
      'thẻ chưa đạt',
      'ghi nhớ thực tế',
      'mục tiêu ghi nhớ',
      'dưới cấp',
    ],
    addedOn: '2026-07-27',
  },
  {
    id: 'notifications',
    group: 'store',
    title: 'Thông báo — chuyện gì đã xảy ra khi bạn không nhìn màn hình',
    summary:
      'Chuông ở góc phải mỗi trang gom lại mọi việc xảy ra ngoài tầm mắt: Claude thêm/sửa/xoá mục trong kho, bài được chấm xong, và ai đó lấy/thích/bình luận thứ bạn chia sẻ. Bấm một dòng là đi thẳng tới chỗ đó.',
    keywords: [
      'thông báo',
      'notification',
      'chuông',
      'bell',
      'chưa đọc',
      'đánh dấu đã đọc',
      'sự kiện',
      'hoạt động',
    ],
    addedOn: '2026-07-28',
  },
  {
    id: 'library',
    group: 'store',
    title: 'Quản lý kho học của bạn',
    summary:
      'Thêm ngữ pháp và từ vựng bằng ba cách (theo trường / dán danh sách / file Excel), tìm bằng kanji/kana/romaji, chọn nhiều mục để tạm ngưng hoặc xoá hàng loạt.',
    keywords: [
      'nhập kho',
      'import',
      'excel',
      'xlsx',
      'mazii',
      'dán danh sách',
      'romaji',
      'tạm ngưng',
      'xoá',
      'hàng loạt',
      'phím tắt',
      'bảng',
    ],
    addedOn: '2026-07-06',
  },
  {
    id: 'groups',
    group: 'store',
    title: 'Nhóm học (gom mẫu/từ để luyện tập trung)',
    summary:
      'Gom mẫu ngữ pháp và/hoặc từ vựng thành nhóm có tên, rồi luyện đúng một nhóm — nói “luyện nhóm X” với Claude.',
    keywords: ['nhóm', 'group', 'gom mẫu', 'luyện nhóm', 'flashcard'],
    addedOn: '2026-07-21',
  },
  {
    id: 'star',
    group: 'store',
    title: 'Đánh dấu sao (ghim mục cần chú ý)',
    summary:
      'Gắn sao cho mẫu ngữ pháp, từ vựng hoặc một lượt dịch đáng nhớ, rồi lọc riêng chúng để xem lại.',
    keywords: ['sao', 'star', 'ghim', 'đánh dấu', 'lọc'],
    addedOn: '2026-07-14',
  },
  {
    id: 'progress',
    group: 'store',
    title: 'Theo dõi tiến độ & điểm yếu',
    summary:
      'Trang Phân tích: xác suất còn nhớ, đường cong quên từng mẫu, điểm yếu 30 ngày, biểu đồ chính xác/thời gian.',
    keywords: [
      'tiến độ',
      'điểm yếu',
      'thống kê',
      'biểu đồ',
      'đường cong quên',
      'phân tích',
      'dự báo',
      'lịch nhiệt',
    ],
    addedOn: '2026-07-10',
  },
  {
    id: 'learner-profile',
    group: 'store',
    title: 'Hồ sơ học của bạn',
    summary:
      'Trang Phân tích có mục app đã rút ra được gì về bạn: cặp mẫu hay nhầm, nhịp tiếp thu, ghi nhận của Claude — kèm chính câu làm bằng chứng.',
    keywords: [
      'hồ sơ',
      'claude ghi nhận',
      'hay nhầm',
      'nhịp học',
      'bằng chứng',
      'nhận xét',
      'học viên',
    ],
    addedOn: '2026-07-27',
  },
  {
    id: 'streak',
    group: 'store',
    title: 'Chuỗi ngày học (streak)',
    summary:
      'Ngọn lửa trên trang Phân tích cháy rực theo mốc; lập mốc mới có hiệu ứng ăn mừng giữa màn hình.',
    keywords: ['chuỗi', 'streak', 'ngọn lửa', 'mốc', 'ăn mừng'],
    addedOn: '2026-07-17',
  },
  {
    id: 'data',
    group: 'store',
    title: 'Sao lưu & mang dữ liệu đi',
    summary:
      'Tự xuất toàn bộ dữ liệu ra JSON, nhập gộp lại khi cần, hoặc xuất từ vựng sang Anki — dữ liệu là của bạn.',
    keywords: ['sao lưu', 'backup', 'xuất', 'json', 'nhập gộp', 'anki', 'apkg', 'chuyển máy'],
    addedOn: '2026-07-21',
  },
  {
    id: 'sharing',
    group: 'community',
    title: 'Thư viện chung (chia sẻ & lấy về mẫu/từ)',
    summary:
      'Chia sẻ mẫu ngữ pháp / từ vựng của bạn cho người khác, và lấy về những mục người khác chia sẻ — chỉ nội dung, không đụng lịch ôn.',
    keywords: ['thư viện', 'chia sẻ', 'lấy về', 'fork', 'công khai', 'thích', 'tim'],
    addedOn: '2026-07-22',
  },
  {
    id: 'feed',
    group: 'community',
    title: 'Feed cộng đồng (chia sẻ lượt dịch & góp ý)',
    summary:
      'Chia sẻ một lượt dịch đã chấm cho thành viên khác xem và bình luận — ở tab «Cộng đồng» của trang Lịch sử.',
    keywords: ['cộng đồng', 'feed', 'bình luận', 'góp ý', 'chia sẻ lượt dịch', 'bình chọn'],
    addedOn: '2026-07-22',
  },
  {
    id: 'sensory',
    group: 'community',
    title: 'Nghe & nói (luyện đa giác quan)',
    summary:
      'Ra đề / trả lời bằng giọng qua voice mode của Claude Desktop; app có nút phát âm tham khảo ở mọi câu tiếng Nhật.',
    keywords: ['nghe', 'nói', 'phát âm', 'tts', 'voicevox', 'giọng', 'voice mode', 'tốc độ đọc'],
    addedOn: '2026-07-14',
  },
  {
    id: 'furigana',
    group: 'community',
    title: 'Furigana (cách đọc kana)',
    summary:
      '4 chế độ hiển thị (app / Claude / cả hai / tắt); trong app rê chuột để hiện, kèm hiệu ứng karaoke khi phát âm.',
    keywords: ['furigana', 'cách đọc', 'kana', 'ruby', 'karaoke'],
    addedOn: '2026-07-19',
  },
  {
    id: 'quality',
    group: 'community',
    title: 'Giao diện & tiện ích',
    summary:
      'Chế độ sáng/tối, các trang tự làm mới khi Claude ghi dữ liệu, và dải điều hướng ở rìa trái trên màn hình nhỏ.',
    keywords: [
      'sáng tối',
      'dark mode',
      'theme',
      'tự làm mới',
      'live refresh',
      'điều hướng',
      'màn hình nhỏ',
      'mobile',
    ],
    addedOn: '2026-07-13',
  },
] as const satisfies readonly GuideTopicMeta[];

export type GuideTopicId = (typeof GUIDE_TOPIC_META)[number]['id'];

const ALL_TOPIC_IDS: readonly GuideTopicId[] = GUIDE_TOPIC_META.map((t) => t.id);

export const GUIDE_TOPIC_BY_ID = Object.fromEntries(
  GUIDE_TOPIC_META.map((t) => [t.id, t] as const),
) as unknown as Record<GuideTopicId, GuideTopicMeta>;

export function isGuideTopicId(value: string): value is GuideTopicId {
  return Object.hasOwn(GUIDE_TOPIC_BY_ID, value);
}

/**
 * The N most recently added topics, newest first — the "Mới cập nhật" line at the top of the tour, which
 * answers "what changed since I last read this?" for a returning learner.
 *
 * Deliberately a fixed COUNT, not a time window with a "Mới" badge per topic: the app is young, so a
 * 14-day window would light up most of the 17 rows and the badge would mean nothing (and the user's
 * standing rule is to strip decoration that carries no information).
 */
export function recentGuideTopics(count = 3): GuideTopicMeta[] {
  return [...GUIDE_TOPIC_META]
    .sort((a, b) => (a.addedOn < b.addedOn ? 1 : a.addedOn > b.addedOn ? -1 : 0))
    .slice(0, count);
}

/** The four `/guide` tabs (Diátaxis modes) — the link target when a whole tab is the answer. */
export const GUIDE_TABS = ['start', 'features', 'howto', 'reference'] as const;
export type GuideTabId = (typeof GUIDE_TABS)[number];

export function isGuideTabId(value: string): value is GuideTabId {
  return (GUIDE_TABS as readonly string[]).includes(value);
}

/**
 * The "Theo việc" HOW-TO recipes, addressable so another screen can link straight at one
 * (`/guide?tab=howto&recipe=mcp`). Title lives in `app/guide/page.tsx` next to the steps — duplicating it
 * here would just drift; this list exists to make the ids a closed TYPE (so a link cannot point at a
 * recipe that does not exist) and `lib/guide-topics.test.ts` checks each id is really rendered.
 */
export const GUIDE_RECIPES = [
  'focus',
  'paste-material',
  'tidy-library',
  'groups',
  'share-items',
  'share-turn',
  'settings',
  'modes',
  'mcp',
  'anki',
  'troubleshoot',
] as const;
export type GuideRecipeId = (typeof GUIDE_RECIPES)[number];

export function isGuideRecipeId(value: string): value is GuideRecipeId {
  return (GUIDE_RECIPES as readonly string[]).includes(value);
}

/**
 * Fold a Vietnamese string to a diacritic-free lowercase form, so typing "cach doc" or "CÁCH ĐỌC" both
 * find "cách đọc". `đ` needs its own pass — it is a distinct letter, not a combining mark.
 */
export function foldVi(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // strip every combining mark (NFD split them off the base letter)
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

/**
 * Ids matching a free-text query over title + summary + keywords (all folded). An empty/blank query
 * matches EVERY topic, so callers can treat "no query" and "all visible" as the same code path.
 */
export function matchGuideTopics(query: string): Set<GuideTopicId> {
  const q = foldVi(query.trim());
  if (q === '') return new Set(ALL_TOPIC_IDS);
  // Every whitespace-separated term must appear somewhere ("nhap excel" ⇒ both words).
  const terms = q.split(/\s+/);
  const hits = GUIDE_TOPIC_META.filter((t) => {
    const haystack = foldVi(`${t.id} ${t.title} ${t.summary} ${t.keywords.join(' ')}`);
    return terms.every((term) => haystack.includes(term));
  }).map((t) => t.id);
  return new Set(hits);
}
