import { PageShell } from '@/components/layout/page-shell';
import { QuickReviewView } from '@/components/features/review/quick-review-view';
import { answerCardAction } from '@/app/review/actions';
import { getQuickReview } from '@/lib/app/quick-review';
import { getSessionUserId } from '@/lib/auth/current-user';
import { getSettings } from '@/lib/library/practice';
import { furiganaInApp } from '@/lib/settings/schema';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  await getSessionUserId();
  const [review, settings] = await Promise.all([getQuickReview(), getSettings()]);
  return (
    <PageShell section="review" width="form">
      <QuickReviewView
        initial={review}
        answer={answerCardAction}
        showFurigana={furiganaInApp(settings.furiganaMode)}
        tts={{ voiceSpeaker: settings.voiceSpeaker, speechRate: settings.speechRate }}
      />
    </PageShell>
  );
}
