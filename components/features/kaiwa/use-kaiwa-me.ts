'use client';

import { useLocalState } from '@/components/common/use-session-state';
import { chooseMe } from '@/lib/kaiwa/layout';

// The part the learner plays in a script ("Tôi là"). Remembered per script on this device, so the
// learner comes back to the same part; a new script starts from the part they took last, when it
// has that name. The chat and the page's "Nhập vai với AI" read the same stored value.
export function useKaiwaMe(
  scriptId: string | null | undefined,
  speakers: readonly string[],
): [string | null, (part: string) => void] {
  const [stored, setStored] = useLocalState<string | null>(`kaiwa-me:${scriptId ?? 'new'}`, null);
  const [last, setLast] = useLocalState<string | null>('kaiwa-me:last', null);
  const choose = (part: string) => {
    setStored(part);
    setLast(part);
  };
  return [chooseMe(speakers, stored, last), choose];
}
