#!/usr/bin/env node
// Checks that a pull request that is no longer a draft says how it was reviewed: a "## Review" section in its
// description with at least one line of content (profile/REVIEW.md of thienai-workflow). Drafts pass.
// Copied from thienai-workflow templates/check-review.mjs; run by .github/workflows/review-check.yml.
//
//   node scripts/check-review.mjs                 # in GitHub Actions: reads the pull_request event ($GITHUB_EVENT_PATH)
//   node scripts/check-review.mjs --body <file>   # check a description file by hand (treated as ready)
//
// Why: review in a session is a habit, and a habit written only in text gets skipped (STATUS grew back to
// 100 lines within an hour on sakubun, 2026-11-07). CI makes the step visible.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Returns the problem in Vietnamese, or '' when the description is fine. */
export function checkReview(body, { draft = false } = {}) {
  if (draft) return '';
  const text = (body || '').replace(/\r\n/g, '\n');
  const m = /^##[ \t]+Review[ \t]*$/m.exec(text);
  if (!m)
    return 'Mô tả PR chưa có mục "## Review". Review theo profile/REVIEW.md của thienai-workflow rồi ghi kết quả vào mô tả, hoặc chuyển PR về nháp.';
  const rest = text.slice(m.index + m[0].length);
  const next = rest.search(/^#{1,2}[ \t]/m);
  const section = (next < 0 ? rest : rest.slice(0, next)).replace(/<!--[\s\S]*?-->/g, '');
  if (!/\S/.test(section))
    return 'Mục "## Review" trong mô tả PR đang trống. Ghi ai review, đã sửa gì, không sửa gì (mẫu ở profile/REVIEW.md).';
  return '';
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const args = process.argv.slice(2);
  const bi = args.indexOf('--body');
  let body,
    draft = false,
    number = '';
  if (bi >= 0) body = readFileSync(args[bi + 1], 'utf8');
  else {
    const path = process.env.GITHUB_EVENT_PATH;
    if (!path) {
      console.error('Không có GITHUB_EVENT_PATH; chạy tay thì dùng --body <file>.');
      process.exit(2);
    }
    const pr = JSON.parse(readFileSync(path, 'utf8')).pull_request;
    if (!pr) {
      console.log('Không phải sự kiện pull request, bỏ qua.');
      process.exit(0);
    }
    body = pr.body;
    draft = !!pr.draft;
    number = ' #' + pr.number;
  }
  const problem = checkReview(body, { draft });
  if (problem) {
    console.error(`PR${number}: ${problem}`);
    process.exit(1);
  }
  console.log(
    draft ? `PR${number} còn nháp: chưa cần mục Review.` : `PR${number} có mục Review: ổn.`,
  );
}
