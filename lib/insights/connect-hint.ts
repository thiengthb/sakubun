// Phân tích tells a learner how to start only while they cannot have started: no AI app connected and
// not one review yet (roadmap 7.3b). Either one means they found their way, so the hint goes away by
// itself and needs no dismiss button.
export function showConnectHint({
  connected,
  reviewed,
}: {
  connected: boolean;
  reviewed: boolean;
}): boolean {
  return !connected && !reviewed;
}
