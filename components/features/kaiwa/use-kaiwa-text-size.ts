'use client';

import { useLocalState } from '@/components/common/use-session-state';
import { stepTextSize, textScale, textSizeLabel, TEXT_SIZES } from '@/lib/kaiwa/text-size';

// The chat's text size, kept by this browser (lib/kaiwa/text-size.ts). The chat and the page's menu
// share it.
export function useKaiwaTextSize() {
  const [index, setIndex] = useLocalState<number>('kaiwa-text-size', 0);
  return {
    scale: textScale(index),
    label: textSizeLabel(index),
    canGrow: textScale(index) < TEXT_SIZES[TEXT_SIZES.length - 1],
    canShrink: textScale(index) > TEXT_SIZES[0],
    grow: () => setIndex((i) => stepTextSize(i, 1)),
    shrink: () => setIndex((i) => stepTextSize(i, -1)),
  };
}
