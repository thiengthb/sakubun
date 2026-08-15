import { init, call } from './sim-mcp.mjs';
await init();
const show = (l, t) => console.log(`\n########## ${l}\n${t}`);

// Claude composes the exercise from the sheet, then stages it BEFORE showing the learner.
const staged = await call('stage_sentence', {
  direction: 'JA_VI',
  sourceText: 'すみません、写真を撮ってください。',
  sourceRuby: 'すみません、写真[しゃしん]を撮[と]ってください。',
  suggested: 'Xin lỗi, hãy chụp ảnh giúp tôi.',
  context: 'nhờ chụp ảnh',
  exerciseType: 'TRANSLATION',
  items: [{ itemId: process.env.TARGET_ID, role: 'TARGET' }],
});
show('7. stage_sentence', staged);
const sentenceId = JSON.parse(staged.match(/\{[\s\S]*\}/)[0]).sentenceId;

// The learner answers imperfectly; Claude grades it.
show('8. submit_review (learner got the particle wrong)', await call('submit_review', {
  sentenceId,
  userAnswer: 'Xin lỗi, hãy chụp ảnh.',
  score: 78,
  feedback: 'Đúng mẫu 〜てください. Thiếu ý "giúp tôi" nên câu hơi cụt.',
  ratings: [{ itemId: process.env.TARGET_ID, rating: 3, errorTags: [] }],
}));
