import type { Suggestion, TeachBackHarvest } from '@/lib/coach';
import { isEmptyDossier, TREND_WINDOW_DAYS, type Dossier } from '@/lib/dossier';
import type { ScaffoldPattern } from '@/lib/scaffolding';
import type { QuizOptions } from '@/lib/quiz-options';
import type { SessionRecap } from '@/lib/session-recap';
import { ERROR_TAG_LABELS } from '@/lib/error-tags';
import { humanizeUntil, ratingLabel } from '@/lib/format';
import {
  QUIZ_EXERCISE,
  TEACH_BACK_EXERCISE,
  type CalibrationShadow,
  type DueBatch,
  type Stats,
  type SubmitReviewResult,
  type WeakReport,
} from '@/lib/practice';
import { TIER_LABELS } from '@/lib/enrichment-quality';
import type { LibraryHealthResult } from '@/lib/library-health';
import type { LibraryCheck } from '@/lib/lookup';
import { SENTENCE_SIZE_SPEC, type WithheldItem, type WithheldReason } from '@/lib/select';
import {
  DIFFICULTY_ANCHORS,
  furiganaForClaude,
  hardestLevel,
  resolveVocabCeiling,
} from '@/lib/settings-schema';
import { LEECH_LAPSES, SUSPEND_SUGGEST_LAPSES } from '@/lib/srs';
import { turnLabels } from '@/lib/turn-labels';

function vocabTargetLevel(batch: DueBatch): string {
  const focusLevels = batch.focus?.levels;
  return focusLevels?.length ? hardestLevel(focusLevels) : resolveVocabCeiling(batch.settings);
}

function joinLines(lines: (string | null | undefined)[]): string {
  return lines.filter((l) => l != null).join('\n');
}

const WITHHELD_FIX: Record<WithheldReason, string> = {
  'daily-new-cap':
    'today’s NEW-pattern quota is spent (settings.dailyNewGrammar) — say so and offer to raise it ' +
    'with update_settings, or that it resumes tomorrow. Never imply the library is empty',
  'per-sentence-new-cap':
    'this sentence already carries its allowed number of NEVER-SEEN patterns ' +
    '(settings.maxNewPerSentence) — this is DELIBERATE (one new structure at a time). Say the held ' +
    'pattern comes in the NEXT sentence; do NOT cram it in and do NOT imply the library is thin',
  'review-cap':
    'today’s REVIEW quota is spent (settings.maxReviewsPerDay) — say so and offer to raise it with ' +
    'update_settings',
};

function withheldLines(withheld: WithheldItem[]): string[] {
  const reasons = [...new Set(withheld.map((w) => w.reason))];
  return reasons.map((reason) => {
    const group = withheld.filter((w) => w.reason === reason);
    const list = `「${group.map((w) => w.expression).join('」「')}」`;
    const asked = group.some((w) => w.focusHit) ? ' (THE USER EXPLICITLY ASKED FOR THIS)' : '';
    return `HELD BACK${asked}: ${list} — ${WITHHELD_FIX[reason]}.`;
  });
}

const REFERENCE_LABELS = ['Tham khảo', 'Đáp án', 'Câu mẫu'] as const;

export function verbatimEnvelope(markdown: string): string {
  const menu = markdown.includes('**Tiếp theo?**');
  const reference = REFERENCE_LABELS.find((label) => markdown.includes(`**${label}:**`));
  const mustKeep = [reference && `"${reference}"`, menu && 'menu "Tiếp theo?"'].filter(Boolean);
  return (
    '**QUY TẮC HIỂN THỊ** (bắt buộc): câu trả lời tiếp theo của bạn PHẢI BẮT ĐẦU bằng khối markdown ' +
    `bên dưới, chép NGUYÊN VĂN 100% — từ dòng "###" đến ${
      menu ? 'HẾT DÒNG MENU "Tiếp theo?"' : 'hết khối'
    } — KHÔNG tóm tắt, không viết lại, không bỏ bất kỳ dòng nào` +
    (mustKeep.length > 0 ? ` (kể cả ${mustKeep.join(' và ')})` : '') +
    '. Khối ```json``` phía sau là dữ liệu riêng cho bạn — TUYỆT ĐỐI KHÔNG hiển thị nó. ' +
    'Lời giảng của bạn chỉ được đặt SAU khối.\n\n' +
    markdown
  );
}

export function renderGradeResult(result: SubmitReviewResult, now: Date = new Date()): string {
  const rows = result.items.map(
    (i) => `| ${i.expression} | ${ratingLabel(i.rating)} | ${humanizeUntil(i.nextDue, now)} |`,
  );
  const t = result.today;
  const isTeachBack = result.exerciseType === TEACH_BACK_EXERCISE;
  const isQuiz = result.exerciseType === QUIZ_EXERCISE;
  const dirLabel = result.direction === 'JA_VI' ? 'Nhật → Việt' : 'Việt → Nhật';
  const labels = turnLabels(result.exerciseType, {
    prompt: `Đề (${dirLabel})`,
    answer: 'Bạn dịch',
    reference: 'Tham khảo',
    retry: 'Gõ lại bản dịch đã sửa lỗi',
  });
  const hasFail = !isQuiz && result.items.some((i) => i.rating <= 2);
  const goalReached = t.sentences >= result.sessionGoal;
  const baseMenu = isTeachBack
    ? '1. Mẫu tiếp · 2. Giảng kỹ mẫu này · 3. Đổi cài đặt · 4. Xem tiến độ · 5. Kết thúc buổi'
    : '1. Câu tiếp · 2. Giảng kỹ câu này · 3. Đổi cài đặt · 4. Xem tiến độ · 5. Kết thúc buổi';
  return joinLines([
    '### Kết quả lượt này',
    '',
    `**${labels.prompt}:** ${result.sourceText}`,
    `**${labels.answer}:** ${result.userAnswer}`,
    result.suggested ? `**${labels.reference}:** ${result.suggested}` : null,
    typeof result.score === 'number' ? `**Điểm:** ${result.score}/100` : '**Điểm:** chưa có',
    '',
    '| Mục | Đánh giá | Ôn lại |',
    '|---|---|---|',
    ...rows,
    ...(result.ratingNotes.length
      ? ['', ...result.ratingNotes.map((n) => `> **Đánh giá đã hạ:** ${n}`)]
      : []),
    '',
    `**Hôm nay:** ${t.reviews} lượt ôn · ${t.newGrammar} mẫu mới · câu **${t.sentences}/${result.sessionGoal}**` +
      (result.dueNow > 0
        ? ` — còn **${result.dueNow}** mẫu đến hạn`
        : result.nextDueAt
          ? ` — hàng đợi trống lúc này, mẫu tiếp đến hạn ${humanizeUntil(result.nextDueAt, now)}`
          : ' — đã sạch hàng đợi'),
    goalReached
      ? `**Đạt mục tiêu hôm nay (${result.sessionGoal} câu)!** Kết thúc đẹp tại đây (chọn 5.) hoặc cứ tiếp tục.`
      : null,
    '',
    hasFail
      ? `**Tiếp theo?** ${labels.retry} (khuyến nghị — để khắc sâu, KHÔNG chấm lại) · ${baseMenu}`
      : `**Tiếp theo?** ${baseMenu}`,
  ]);
}

export function renderCalibrationShadow(shadow: CalibrationShadow | null): string | null {
  if (!shadow) return null;
  const pct = Math.round(shadow.measured * 100);
  return (
    'CALIBRATION (SHADOW — nothing has been changed, and you must NOT call update_settings for this): ' +
    `on the ${shadow.axis} axis the learner is succeeding ${pct}% over their recent turns ` +
    `(${shadow.observations} graded observations, ability ${Math.round(shadow.ability)}). The controller ` +
    `WOULD move ${shadow.target} ${shadow.direction} (${shadow.from} -> ${shadow.to}). ` +
    'Mention this AT MOST ONCE per session, at the END, as an observation in Vietnamese — say plainly ' +
    'that nothing was changed and ask whether it matches how the session felt. Their answer is the ' +
    'evidence for whether this mechanism is trustworthy at all, so do not talk them into agreeing. ' +
    `Suggested wording: "${shadow.reason} (app chỉ đang quan sát, chưa đổi gì)". ` +
    'NEVER put it in the same message as the numbered menu, and never repeat it turn after turn.'
  );
}

export function renderTeachBackHarvest(harvest: TeachBackHarvest | null): string | null {
  if (!harvest) return null;
  return (
    `TEACH-BACK HARVEST: the learner just explained 「${harvest.expression}」 well (rating ` +
    `${harvest.rating}) and that pattern has NO enrichment card at all. Their explanation is content ` +
    'you could not have written — it is the wording that made the pattern stick for THIS person. ' +
    'OFFER, in ONE short Vietnamese sentence, to save it as the card, and WAIT for a yes. On a yes: ' +
    'call enrich_items with a full card for this item whose `usage` is THEIR words — trim and fix ' +
    'typos only, never rewrite it into your own voice — and supply the rest (structure, a canonical ' +
    'example with jaRuby, pitfalls, contrasts) yourself, with provenance.confidence set honestly. ' +
    'On a no, or no answer, write NOTHING and do not raise it again this session.'
  );
}

function recapLine(recap: SessionRecap): string | null {
  if (recap.reviews === 0) return null;
  const when =
    recap.daysAgo === 0
      ? 'hôm nay'
      : recap.daysAgo === 1
        ? 'hôm qua'
        : `${recap.daysAgo} ngày trước`;
  const size = `${when} · ${recap.sentences} câu`;
  if (recap.shaky.length === 0) return `- **Buổi trước (${size}):** không sai mẫu nào.`;
  const shaky = recap.shaky.map((s) => `${s.expression} ×${s.misses}`).join(' · ');
  return `- **Buổi trước (${size}):** còn vấp ở ${shaky}`;
}

export function renderStats(
  stats: Stats,
  health?: LibraryHealthResult,
  recap?: SessionRecap | null,
): string {
  const total = stats.totalItems;
  const forecastEntries = Object.entries(stats.dueForecast7Days).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const forecast =
    forecastEntries.length > 0
      ? forecastEntries.map(([d, n]) => `${d.slice(5)}: ${n}`).join(' · ')
      : 'trống';
  const weak =
    stats.weakItems.length > 0
      ? stats.weakItems.map((w) => `${w.expression} (quên ${w.lapses} lần)`).join(' · ')
      : null;
  return joinLines([
    '### Tiến độ',
    '',
    `- **Đến hạn bây giờ:** ${stats.dueNow} · **chưa học lần nào:** ${stats.newItems}`,
    `- **Hôm nay:** ${stats.today.reviews} lượt · câu **${stats.today.sentences}/${stats.settings.sessionGoal}** · mẫu mới ${stats.today.newGrammar}/${stats.settings.dailyNewGrammar} (hạn mức ngày)`,
    `- **Chuỗi ngày học:** ${stats.streak.current} ngày (kỷ lục ${stats.streak.longest})`,
    `- **Kho:** ${total} mẫu ngữ pháp · 7 ngày qua: ${stats.reviewsLast7Days} lượt`,
    `- **Dự báo 7 ngày tới:** ${forecast}`,
    weak ? `- **Hay sai:** ${weak}` : null,
    recap ? recapLine(recap) : null,
    health && health.health.retention.measured !== null
      ? `- **Ghi nhớ thực tế:** ${Math.round(health.health.retention.measured * 100)}% ` +
        `(mục tiêu ${Math.round(health.health.retention.desired * 100)}%) — ${health.health.retention.verdict}`
      : null,
    health?.suggestions[0] ? '' : null,
    health?.suggestions[0] ? `**Gợi ý dọn kho:** ${health.suggestions[0].line}` : null,
  ]);
}

export function renderLibraryCheck(check: LibraryCheck): string {
  const q = check.query;
  const lines: (string | null)[] = [`### Tra cứu: ${q}`, ''];

  if (check.mine.length === 0) {
    lines.push(`**Trong kho của bạn:** chưa có mục nào khớp「${q}」.`);
  } else {
    lines.push('**Trong kho của bạn:**');
    for (const m of check.mine) {
      const state = m.suspended
        ? 'đang tạm ngưng'
        : !m.srs || m.srs.state === 0
          ? 'chưa học lần nào'
          : m.srs.due.getTime() <= Date.now()
            ? 'đang đến hạn ôn'
            : `đã học (${m.srs.reps} lượt), chưa tới hạn`;
      const leech = m.srs && m.srs.lapses >= LEECH_LAPSES ? ` · quên ${m.srs.lapses} lần` : '';
      const gaps = m.missing.length > 0 ? ` (thiếu: ${m.missing.join(', ')})` : '';
      const range =
        !m.levelInStudyRange && (!m.srs || m.srs.state === 0)
          ? ` · NGOÀI phạm vi đang học (${check.grammarLevels.join(', ')})`
          : '';
      lines.push(
        `- **${m.expression}**${m.reading ? `（${m.reading}）` : ''} — ${m.meaningVi} · ${m.level} · ` +
          `${state}${leech} · ${TIER_LABELS[m.tier]}${gaps}${range}`,
      );
    }
  }

  if (check.suggestions.length > 0) {
    lines.push('', '**Bạn có muốn tôi làm giúp?**');
    check.suggestions.forEach((s, index) =>
      lines.push(`${index + 1}. ${s.line}${s.auto ? ' _(bạn đã cho phép tự làm việc này)_' : ''}`),
    );
    if (check.remaining > 0) {
      lines.push(`_(còn ${check.remaining} đề xuất khác — nói "còn gì nữa" nếu bạn muốn xem.)_`);
    }
  }

  return joinLines(lines);
}

export function renderConsentGuard(suggestions: readonly Suggestion[]): string | null {
  if (suggestions.length === 0) return null;
  const toolsOf = (s: Suggestion) => [s.tool, s.alsoTool].filter((t): t is string => Boolean(t));
  const waiting = [...new Set(suggestions.filter((s) => !s.auto).flatMap(toolsOf))];
  const allowed = [...new Set(suggestions.filter((s) => s.auto).flatMap(toolsOf))];
  const parts: string[] = [];
  if (waiting.length > 0) {
    parts.push(
      `CONSENT: the offer(s) above are NOT pre-authorised. In THIS message you may not call ` +
        `${waiting.join(' / ')} — relay the offer in Vietnamese and STOP. The learner's yes arrives in ` +
        `a later turn; treat anything else as a no. Do not describe the change as if it happened.`,
    );
  }
  if (allowed.length > 0) {
    parts.push(
      `PRE-AUTHORISED: ${allowed.join(' / ')} may be called NOW for the offer(s) marked ` +
        `"bạn đã cho phép tự làm việc này" — the learner turned that class on in settings. Call it, then ` +
        `say in ONE Vietnamese line what you changed. This covers ONLY those offers.`,
    );
  }
  return parts.join('\n');
}

export function renderLibraryHealth(result: LibraryHealthResult): string {
  const h = result.health;
  const lines: (string | null)[] = ['### Sức khoẻ kho học', ''];

  lines.push(
    `**Kho:** ${h.totals.grammar} mẫu ngữ pháp · ${h.totals.vocab} từ vựng` +
      (h.totals.suspended > 0 ? ` · ${h.totals.suspended} đang tạm ngưng` : ''),
  );

  const needsWork = h.quality.missing + h.quality.broken + h.quality.thin;
  lines.push(
    `**Thẻ ngữ pháp:** ${h.quality.ok + h.quality.rich} thẻ đạt · ${needsWork} thẻ chưa đạt` +
      (h.cardVersion.outdated > 0 ? ` · ${h.cardVersion.outdated} thẻ theo format cũ` : ''),
  );

  if (h.vocabCards.total > 0) {
    lines.push(
      `**Thẻ từ vựng:** ${h.vocabCards.total - h.vocabCards.needsWork}/${h.vocabCards.total} thẻ đạt` +
        (h.vocabCards.needsWork > 0
          ? ` · ${h.vocabCards.needsWork} chưa đạt (thiếu cụm đi kèm, từ đồng nghĩa/trái nghĩa, hoặc ví dụ có dịch)`
          : ''),
    );
  }

  const gaps = h.byStudiedLevel.filter((l) => l.needsWork > 0);
  if (gaps.length > 0) {
    lines.push(
      `**Ở cấp bạn đang học:** ${gaps.map((l) => `${l.level} thiếu ${l.needsWork}/${l.total}`).join(' · ')}`,
    );
  }

  lines.push(
    h.retention.measured === null
      ? `**Ghi nhớ thực tế:** ${h.retention.verdict}`
      : `**Ghi nhớ thực tế:** ${Math.round(h.retention.measured * 100)}% so với mục tiêu ` +
          `${Math.round(h.retention.desired * 100)}% (${h.retention.reviews} lượt ôn) — ${h.retention.verdict}`,
  );

  if (h.vocabMissingHanviet > 0) {
    lines.push(`**Từ vựng:** ${h.vocabMissingHanviet} từ có kanji chưa có âm Hán Việt.`);
  }

  if (result.suggestions.length > 0) {
    lines.push('', '**Bạn có muốn tôi làm giúp?**');
    result.suggestions.forEach((s, index) => lines.push(`${index + 1}. ${s.line}`));
    if (result.remaining > 0) {
      lines.push(`_(còn ${result.remaining} đề xuất khác — nói "còn gì nữa" nếu bạn muốn xem.)_`);
    }
  } else {
    lines.push('', 'Không có gì cần dọn — kho đang ổn.');
  }

  return joinLines(lines);
}

export function renderWeakReport(report: WeakReport): string {
  const tags =
    report.tagCounts.length > 0
      ? report.tagCounts
          .map((t) => `| ${ERROR_TAG_LABELS[t.tag] ?? t.tag} | ${t.count} |`)
          .join('\n')
      : null;
  const worst =
    report.worstItems.length > 0
      ? report.worstItems.map(
          (w) =>
            `- **${w.expression}** — sai ${w.misses} lần` +
            (w.tags.length > 0
              ? ` (${w.tags.map((t) => ERROR_TAG_LABELS[t] ?? t).join(', ')})`
              : ''),
        )
      : ['_Chưa đủ dữ liệu lỗi trong giai đoạn này._'];
  const leeches =
    report.leeches.length > 0
      ? report.leeches.map(
          (l) =>
            `- **${l.expression}** (${l.meaningVi}) — quên ${l.lapses} lần` +
            (l.suspendSuggested ? ' → **cân nhắc tạm ngưng** rồi học lại sau' : ''),
        )
      : ['_Không có leech nào_'];
  return joinLines([
    `### Điểm yếu (${report.windowDays} ngày qua)`,
    '',
    ...(tags ? ['**Lỗi theo loại:**', '', '| Loại lỗi | Số lần |', '|---|---|', tags, ''] : []),
    '**Mục sai nhiều nhất:**',
    ...worst,
    '',
    '**Leech (quên đi quên lại):**',
    ...leeches,
  ]);
}

function condenseReading(reading: string): string {
  const parts = reading.trim().split(/\s+/);
  return parts.length <= 3 ? reading : `${parts.slice(0, 3).join(' ')}…`;
}

export const MAX_DOSSIER_LINES = 8;

export function renderDossier(dossier: Dossier | null | undefined): string | null {
  if (!dossier || isEmptyDossier(dossier)) return null;
  const lines: string[] = [];
  for (const c of dossier.confusions) {
    lines.push(
      `- Reaches for 「${c.used}」 where 「${c.required}」 was required (${c.count}× in ${dossier.windowDays}d) — worth aiming a session at.`,
    );
  }
  if (dossier.strong.length > 0) {
    lines.push(
      `- Already solid (never missed, mostly rated Easy): ${dossier.strong
        .map((s) => `「${s.expression}」`)
        .join(' · ')} — if one turns up in a batch, do not spend the explanation re-teaching it. ` +
        'Do NOT add them to a sentence they are not listed in.',
    );
  }
  if (dossier.exposures) {
    lines.push(
      `- Needs ~${dossier.exposures.median} exposures before a pattern reaches review state ` +
        `(measured over ${dossier.exposures.sample} of their own patterns) — pace expectations to that, not to a default.`,
    );
  }
  if (dossier.register) {
    lines.push(
      `- Register slips on ${Math.round(dossier.register.rate * 100)}% of conversation turns ` +
        `(${dossier.register.turns} turns) — pick situations that make politeness level matter.`,
    );
  }
  if (dossier.topics.length > 0) {
    lines.push(
      `- Writes their best sentences about: ${dossier.topics
        .map((t) => `${t.context} (avg ${t.avgScore})`)
        .join(' · ')} — a HARDER pattern lands better inside a topic they own.`,
    );
  }
  if (dossier.tagTrend.length > 0) {
    lines.push(
      `- Error trend, last ${TREND_WINDOW_DAYS}d vs the ${TREND_WINDOW_DAYS}d before: ${dossier.tagTrend
        .map((t) => `${t.tag} ${t.direction} (${t.prior} → ${t.recent})`)
        .join(' · ')}.`,
    );
  }
  if (lines.length === 0) return null;
  return joinLines([
    '**LEARNER MODEL (derived from their OWN graded history — use it to AIM THIS SESSION, e.g. what ' +
      'to point the focus menu at; never recite it back to the user, and never treat it as a rule ' +
      'about who they are):**',
    ...lines.slice(0, MAX_DOSSIER_LINES - 1),
  ]);
}

export function renderQuizOptions(quiz: QuizOptions | undefined): string | null {
  if (!quiz) return null;
  return [
    'QUIZ OPTIONS — the server placed the correct answer. Show this line EXACTLY as written, ' +
      'directly under the question, and change nothing about the order.',
    '',
    quiz.line,
    '',
    `(For your grading only: the correct letter is ${quiz.correctLetter}. Never reveal it before the ` +
      'learner has chosen.)',
  ].join('\n');
}

export function renderScaffold(patterns: readonly ScaffoldPattern[]): string | null {
  const fresh = patterns.filter((p) => p.status !== 'known');
  const tooHard = patterns.filter((p) => p.aboveDrilledLevel);
  if (fresh.length === 0 && tooHard.length === 0) return null;

  const lines: string[] = ['DECLARED SCAFFOLDING — what you used beyond the scheduled batch:'];
  for (const p of fresh) {
    lines.push(
      `- 「${p.expression}」 is NOWHERE in their library. They are meeting it for the first time ` +
        'inside an exercise about something else, so explain it in one line as you go and offer ' +
        'add_grammar for it — one line, then WAIT. Do not let it pass unmentioned.',
    );
  }
  for (const p of tooHard) {
    lines.push(
      `- 「${p.expression}」 is ${p.level}, HARDER than the level this sentence drills. The protocol ` +
        'forbids scaffolding above the drilled level: rewrite the sentence without it, or say plainly ' +
        'that you reached past their level and why.',
    );
  }
  lines.push(
    'These are NOT graded and NOT scheduled — offering is how they become either. Stay inside the ' +
      'usual offer budget: the exercise is what the learner is waiting for.',
  );
  return joinLines(lines);
}

export function renderDueBatch(batch: DueBatch): string {
  if (batch.items.length === 0) {
    const wait = batch.nextDueAt
      ? `Next item is due ${humanizeUntil(batch.nextDueAt)}.`
      : 'Nothing else is queued today.';
    const focusNote = batch.focus
      ? batch.focus.weak
        ? batch.focus.matched === 0
          ? ' WEAK-SPOT DRILL, but there is NO weakness data yet (the user has not missed a pattern ' +
            'in the last 30 days) — tell them, and offer a random session instead (call again WITHOUT focusWeak).'
          : ' WEAK-SPOT DRILL: the weak patterns ARE in the library but are not due today / are ' +
            'blocked by the daily limit (see limits) — tell the user, suggest a random session or coming back later.'
        : // SUSPENDED comes FIRST: with the pattern paused the batch is empty AND `matched` is 0, so
          batch.focus.suspendedPatterns.length > 0
          ? ` SUSPENDED, not missing: ${batch.focus.suspendedPatterns
              .map((s) => `「${s.expression}」 (itemId ${s.itemId})`)
              .join(
                ' · ',
              )} — the user HAS this pattern, they paused it. Do NOT call add_grammar (duplicate); offer set_item_suspended { suspended: false } and then re-request the focus.`
          : batch.focus.matched === 0
            ? ' The FOCUS the user asked for matches NO pattern in the library — tell them and ask: ' +
              'add it with add_grammar, or practise randomly (call again without focus)?'
            : ' The focus patterns ARE in the library but today’s limit blocks them (see limits) — tell the user.'
      : '';
    const beyond =
      batch.newBeyondLevels > 0 && batch.newAvailable.grammar === 0
        ? ` NOTE: ${batch.newBeyondLevels} unlearned NEW patterns remain, but at levels OUTSIDE ` +
          `settings.grammarLevels (currently studying: ${batch.settings.grammarLevels.join(', ')}). Do NOT ` +
          `conclude ` +
          `"nothing left" — tell the user and ask whether to widen levels (update_settings) or import ` +
          `grammar at the levels they are studying.`
        : '';
    const held = batch.withheld.length > 0 ? ` ${withheldLines(batch.withheld).join(' ')}` : '';
    return `_(No items for the next sentence. ${wait})_${focusNote}${beyond}${held}`;
  }
  const rows = batch.items.map((i) => {
    const enrichment = i.enrichment ?? null;
    const extra = enrichment
      ? ` · usage: ${enrichment.usage}` +
        (enrichment.collocations.length > 0
          ? ` · collocations: ${enrichment.collocations.slice(0, 3).join('、')}`
          : '') +
        (enrichment.pitfalls.length > 0 ? ` · pitfall: ${enrichment.pitfalls[0]}` : '')
      : '';
    const isLeech = (i.lapses ?? 0) >= LEECH_LAPSES;
    const contexts = batch.recentContexts[i.id];
    const missedTags = batch.weakSpots.byItem[i.id];
    const missedNote = missedTags?.length
      ? ` · missed last time: ${missedTags.map((tag) => ERROR_TAG_LABELS[tag] ?? tag).join(', ')}`
      : '';
    const focusMark = batch.focus ? (i.focusHit ? ' · FOCUS' : ' · filler') : '';
    return (
      `- **${i.expression}**${i.reading ? `（${condenseReading(i.reading)}）` : ''} [${i.role}${focusMark}` +
      `${i.isNew ? ' · NEW' : ''}${isLeech ? ` · LEECH (forgotten ${i.lapses}×${(i.lapses ?? 0) >= SUSPEND_SUGGEST_LAPSES ? ' — consider suspending' : ''})` : ''}` +
      ` · ${i.level}] — ${i.meaningVi}` +
      (i.notes ? ` · note: ${i.notes}` : '') +
      extra +
      missedNote +
      (contexts?.length
        ? `\n  ↳ contexts already used (AVOID repeating): ${contexts.join(' · ')}`
        : '')
    );
  });
  const focusAsked = batch.focus
    ? [
        batch.focus.levels?.length ? `level ${batch.focus.levels.join(', ')}` : null,
        batch.focus.patterns?.length ? `pattern 「${batch.focus.patterns.join('」「')}」` : null,
      ]
        .filter(Boolean)
        .join(' + ')
    : null;
  const forTeachBack = batch.forExerciseType === TEACH_BACK_EXERCISE;
  const forConversation = batch.forExerciseType === 'CONVERSATION';
  const stagedDirection = forTeachBack ? 'JA_VI' : forConversation ? 'VI_JA' : batch.direction;
  const srcIsJa = batch.direction === 'JA_VI';
  const size = SENTENCE_SIZE_SPEC[batch.settings.sentenceSize];
  const srcChars = srcIsJa ? size.ja : size.vi;
  const srcLang = srcIsJa ? 'Japanese' : 'Vietnamese';
  const vocabLevel = vocabTargetLevel(batch);
  const gradedPatterns = batch.items.filter((i) => i.role !== 'VOCAB').length;
  const patternNote =
    gradedPatterns === size.patterns
      ? `weave in **${gradedPatterns}** grammar pattern(s)`
      : `weave in **${gradedPatterns}** grammar pattern(s) — sentenceSize "${batch.settings.sentenceSize}" ` +
        `asks for ${size.patterns}, but only ${gradedPatterns} ${gradedPatterns === 1 ? 'is' : 'are'} ` +
        `scheduled right now` +
        (batch.withheld.length > 0 ? ' (a HELD BACK line below names the cap that did it)' : '') +
        `. Reach the character target with LOWER-level SCAFFOLDING, never with a pattern that is not ` +
        `listed below — an unlisted pattern gets no rating and no review, so that part of the sentence ` +
        `is wasted work`;
  const levelFocusOnly = !!batch.focus?.levels?.length && !batch.focus?.patterns?.length;
  const focusServedNone =
    !!batch.focus &&
    !(batch.focus.weak && batch.focus.matched === 0) &&
    !batch.items.some((i) => i.focusHit);
  const promptNote =
    batch.settings.promptModality === 'speech-only'
      ? '**PROMPTING (speech-only — LISTENING DRILL):** SPEAK the exercise sentence aloud (needs ' +
        'voice mode ON) and NEVER type or show its text — the user must HEAR it, then translate. Show ' +
        'the text only AFTER they answer. (The user turns voice mode on themselves in Claude Desktop; ' +
        'the app cannot do it for them.)'
      : batch.settings.promptModality === 'text+speech'
        ? '**PROMPTING (text+speech):** show the exercise sentence in text AND read it aloud (needs voice mode ON).'
        : null;
  const answerNote =
    batch.settings.answerModality === 'speak-only'
      ? '**ANSWERING (speak-only):** ask the user to SAY their answer out loud; grading their ' +
        'pronunciation depends on whether voice mode can actually hear them.'
      : null;
  const furiganaNote =
    stagedDirection === 'JA_VI'
      ? furiganaForClaude(batch.settings.furiganaMode)
        ? '**FURIGANA (Claude renders it):** in the EXERCISE SENTENCE you show the user, add the ' +
          'hiragana reading in ROUND brackets 「（かな）」 RIGHT AFTER each hard kanji cluster — EXCEPT ' +
          'over the part that realises the grammar pattern being drilled (the user must spot it ' +
          'themselves). Send sourceRuby as well (see below).'
        : '**FURIGANA (Claude does NOT insert it — the app renders it, or it is off):** do NOT put ' +
          'readings inside the exercise sentence you display. Still send sourceRuby (see below) so the ' +
          'app can render furigana.'
      : null;
  const rubyNote =
    stagedDirection === 'JA_VI'
      ? '↳ **REQUIRED**: pass `sourceRuby` to stage_sentence — the exercise sentence itself rewritten ' +
        'as 漢字[かな] (SQUARE brackets, each kanji cluster followed by its reading, e.g. ' +
        '彼[かれ]は忙[いそが]しい) so the history card can show furigana on hover. Never leave it empty ' +
        'when the exercise sentence is Japanese.'
      : '↳ **REQUIRED**: pass `suggestedRuby` to stage_sentence — the Japanese reference translation ' +
        '(suggested) rewritten as 漢字[かな] (SQUARE brackets) so the ANSWER in history shows furigana ' +
        'on hover. Never leave it empty when the answer is Japanese.';
  return joinLines([
    '**COMPOSITION SHEET — FOR YOU (Claude) ONLY. NEVER show this to the user.**',
    batch.mode === 'MASTERY'
      ? '\n**MASTERY MODE** — today’s queue is clear (nothing due, no new patterns left). BEFORE ' +
        'the FIRST mastery sentence of the session: TELL the user (in chat, not from this sheet) that ' +
        'today’s due work is finished and the goal is met, and ASK whether they want to switch to ' +
        'MASTERY practice (mixed review that recombines patterns they already KNOW) — WAIT for their ' +
        'yes before composing. For the rest of the session just keep going, do NOT ask again. ' +
        'How to compose: the patterns below are ones the user has already MASTERED (a VARIED sample, ' +
        'not the soonest-due ones) — RECOMBINE them into ONE sentence that is HARDER / LONGER than ' +
        'usual, push the structural complexity up, and MOVE TO A NEW CONTEXT (transfer practice — do ' +
        'NOT rehash the old one). NEVER introduce a new grammar pattern. Grade and rate as strictly as ' +
        'ever: any pattern the user gets WRONG returns to the review queue by itself (submit_review) — ' +
        'that is exactly how weak spots surface, not a dead end.'
      : null,
    promptNote,
    answerNote,
    forTeachBack ? null : furiganaNote,
    forTeachBack ? null : rubyNote,
    '',
    forTeachBack
      ? 'TEACH-BACK TURN: **nothing is composed here**, so this sheet carries no sentence spec — no ' +
        'direction to pick, no character target, no pattern count, no register. Stage `direction: ' +
        '"JA_VI"` with `exerciseType: "TEACH_BACK"`, `sourceText` = the pattern exactly as spelled ' +
        'below, and `sourceRuby` when it holds kanji. What you want from this sheet is the item, its ' +
        'enrichment (your marking scheme) and the WEAK SPOTS line.'
      : `Direction: **${stagedDirection}** · source length: ~${srcChars} characters (${srcLang}, ±30%) · ${patternNote} · register: ${batch.settings.register} · grading: ${batch.settings.translationStyle}`,
    forTeachBack
      ? null
      : `STRUCTURE (difficulty ${batch.settings.difficulty}/5): ${DIFFICULTY_ANCHORS[batch.settings.difficulty]?.en ?? ''} — this is about SHAPE only; vocabulary hardness is the VOCABULARY line, novelty is capped separately, length is the character target above`,
    forTeachBack
      ? null
      : `VOCABULARY: **target ${vocabLevel} exactly** — drop to an easier level only for FUNCTION WORDS (particles, conjunctions…) or when the grammar pattern forces it; go HARDER only when difficulty ≥ 4. Don't let the whole sentence drift down to easy vocabulary just because the grammar pattern sits at a low level`,
    focusServedNone
      ? `FOCUS NOT SERVED — do NOT compose around it: the user asked for ${
          focusAsked || (batch.focus?.weak ? 'a weak-spot drill' : 'a specific focus')
        }, but NONE of those patterns is in the list below (the entries there are the server's ` +
        'fallback). Composing about a pattern that is not listed means it gets NO rating and NO ' +
        'review scheduled, so the turn is wasted. Instead: tell the user plainly that the pattern ' +
        'could not be served and WHY — the reason is on ONE of the lines just below (HELD BACK, NOT in ' +
        'the library, or SUSPENDED) and they need DIFFERENT fixes, so read which one is actually there ' +
        'before offering anything — then ask whether to practise the listed patterns meanwhile.'
      : batch.focus?.weak
        ? batch.focus.matched > 0
          ? `WEAK-SPOT DRILL: the server prioritised ${batch.focus.matched} pattern(s) the user OFTEN gets wrong (rating ≤ 2 in the last 30 days) or that are LEECHes — the FOCUS entries below ARE those patterns and the sentence MUST revolve around them; the "filler" entries were added by the server to keep the sentence natural. Deliberately recreate the same KIND of mistake (see WEAK SPOTS / "missed last time") in a fair way so the user can train past it; when explaining, point straight at the recurring error.`
          : `WEAK-SPOT DRILL: not enough data yet (the user hasn't missed a pattern recently) — just compose as usual per FSRS; the system starts catching errors once they make some.`
        : focusAsked
          ? levelFocusOnly
            ? `FOCUS: drilling level ${batch.focus?.levels?.join(', ')} — the patterns below (all at this level) are the GRADED ones and the sentence revolves around them. If that isn't enough for length/naturalness, weave in LOWER-level grammar yourself as scaffolding (NOT graded, NOT listed) — never reach for anything harder than ${vocabLevel}.`
            : `FOCUS requested by the user: ${focusAsked} — the sentence MUST revolve around the FOCUS entries; the "filler" entries are server-added to reach the sentence length, still weave them in naturally.`
          : null,
    batch.focus && batch.focus.unmatchedPatterns.length > 0
      ? `NOT in the library: 「${batch.focus.unmatchedPatterns.join('」「')}」 — tell the user (add via add_grammar, or pick another pattern).`
      : null,
    batch.focus && batch.focus.suspendedPatterns.length > 0
      ? `SUSPENDED, not missing: ${batch.focus.suspendedPatterns
          .map((s) => `「${s.expression}」 (itemId ${s.itemId})`)
          .join(
            ' · ',
          )} — the user DOES have this, they paused it, so it can never be scheduled. Do NOT call add_grammar (that would duplicate it): tell them it is paused and offer set_item_suspended { suspended: false }, then re-request the focus.`
      : null,
    ...withheldLines(batch.withheld),
    batch.weakSpots.topTags.length > 0
      ? `WEAK SPOTS (14 days): ${batch.weakSpots.topTags
          .map((w) => `${ERROR_TAG_LABELS[w.tag] ?? w.tag} (${w.count}×)`)
          .join(
            ' · ',
          )}${
          forTeachBack
            ? ' — aim your MARKING at these: if one of them is the very thing this pattern is usually got wrong on, ask about it and say so outright.'
            : ' — design the sentence to TOUCH these naturally (a fair trap, not a gotcha); when explaining, name them outright.'
        }`
      : null,
    !forTeachBack && batch.settings.topics.length > 0
      ? `Preferred topics: ${batch.settings.topics.join(', ')}`
      : null,
    !forTeachBack && batch.items.some((i) => i.role === 'VOCAB')
      ? 'VOCABULARY (the [VOCAB] entries): words the user looked up — USE them NATURALLY in the ' +
        'sentence (they sit OUTSIDE the grammar-pattern count, do NOT count toward it) and GRADE them ' +
        'like any other entry (their own ratings, role="VOCAB"): used/understood correctly → high ' +
        "rating; forgotten or misused → low rating so it comes back. Don't cram so many words in that " +
        'the sentence turns stilted.'
      : null,
    '',
    ...rows,
  ]);
}
