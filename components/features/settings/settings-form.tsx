'use client';

import { useEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { SETTINGS_TABS } from '@/components/layout/page-heads';
import { PracticeTab } from '@/components/features/settings/settings-practice-tab';
import { DataTab } from '@/components/features/settings/settings-data-tab';
import { AccountTab } from '@/components/features/settings/settings-account-tab';
import { GuideTab } from '@/components/features/settings/settings-guide-tab';
import type { McpKeyRow } from '@/components/features/settings/settings-account-tab';
import type { ConnectedAppRow } from '@/components/features/settings/connected-apps-section';
import type { ToolUsageReport } from '@/lib/mcp/usage';
import { useSessionState } from '@/components/common/use-session-state';
import { saveSettingsAction } from '@/app/actions';
import { type Settings } from '@/lib/settings/schema';

interface SettingsFormProps {
  initial: Settings;
  account: {
    name: string;
    email: string;
    image: string | null;
    hasPassword: boolean;
    joinedAt: string | null;
    lastLoginAt: string | null;
    keys: McpKeyRow[];
    apps: ConnectedAppRow[];
    mcpUsage: ToolUsageReport | null;
  };
  isAdmin: boolean;
  mcpUrl: string;
}

const SAVEABLE_TABS = new Set(['practice']);

// Nội dung / Nhịp học / Nghe & nói merged into one tab. sessionStorage still holds the old value
// for anyone who had Settings open, and Radix renders NOTHING for a value with no TabsContent —
// a blank page. Fold the retired values onto the tab that absorbed them.
const RETIRED_TABS: Record<string, string> = {
  content: 'practice',
  pace: 'practice',
  sensory: 'practice',
};

export function SettingsForm({ initial, account, isAdmin, mcpUrl }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [storedTab, setTab] = useSessionState(
    SETTINGS_TABS.storeKey,
    SETTINGS_TABS.initial,
    SETTINGS_TABS.urlKey,
  );
  const tab = RETIRED_TABS[storedTab] ?? storedTab;
  const save = useAutosave(settings, setSettings, initial);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="form"
        title="Cài đặt"
        meta={SAVEABLE_TABS.has(tab) ? <SaveStatus {...save} /> : undefined}
        tabs={<PageTabs items={SETTINGS_TABS.items} label={SETTINGS_TABS.label} />}
      >
        <PracticeTab settings={settings} set={set} />
        <DataTab isAdmin={isAdmin} />
        <AccountTab {...account} isAdmin={isAdmin} />
        <GuideTab mcpUrl={mcpUrl} openTab={setTab} />
      </PageShell>
    </Tabs>
  );
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; undo: Settings | null }
  | { kind: 'failed' };

// thien, U1 gate (2026-11-09): no sticky Lưu at the foot. Each change saves itself a moment after
// the last press (a stepper fires once per press), and the line under the title says so, with
// Hoàn tác to put the values back as they were before that change.
const SAVE_DELAY_MS = 600;

function useAutosave(
  settings: Settings,
  setSettings: (next: Settings) => void,
  initial: Settings,
) {
  const saved = useRef(initial);
  const undoing = useRef(false);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  // Bumped when a save ends, so a change made while it ran is saved next.
  const [round, setRound] = useState(0);
  const busy = useRef(false);
  const latest = useRef(settings);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);
  // Leaving the page inside the delay still keeps the last change.
  useEffect(
    () => () => {
      const pending = changed(saved.current, latest.current);
      if (pending) void saveSettingsAction(pending);
    },
    [],
  );

  useEffect(() => {
    const patch = changed(saved.current, settings);
    if (!patch || busy.current) return;
    const timer = setTimeout(async () => {
      busy.current = true;
      setState({ kind: 'saving' });
      const before = saved.current;
      const result = await saveSettingsAction(patch).catch(() => null);
      busy.current = false;
      if (result?.ok) {
        saved.current = { ...before, ...patch };
        setState({ kind: 'saved', undo: undoing.current ? null : before });
        undoing.current = false;
      } else {
        setState({ kind: 'failed' });
      }
      setRound((r) => r + 1);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, round]);

  return {
    state,
    undo: () => {
      if (state.kind !== 'saved' || !state.undo) return;
      undoing.current = true;
      setSettings({ ...settings, ...changed(settings, state.undo) });
    },
    retry: () => setRound((r) => r + 1),
  };
}

/** The keys whose values differ, or null when nothing does. */
function changed(from: Settings, to: Settings): Partial<Settings> | null {
  const patch: Partial<Settings> = {};
  for (const key of Object.keys(to) as (keyof Settings)[]) {
    if (JSON.stringify(from[key]) !== JSON.stringify(to[key])) {
      Object.assign(patch, { [key]: to[key] });
    }
  }
  return Object.keys(patch).length ? patch : null;
}

// A word-sized action on the status line, so the header keeps its height when it appears; the hit
// area still grows to the touch size.
const INLINE_ACTION = 'target-44 h-4 gap-1 px-0 text-xs font-semibold md:h-4 md:px-0';

function SaveStatus({ state, undo, retry }: ReturnType<typeof useAutosave>) {
  const text =
    state.kind === 'saving'
      ? 'Đang lưu…'
      : state.kind === 'saved'
        ? state.undo
          ? 'Đã lưu'
          : 'Đã hoàn tác'
        : state.kind === 'failed'
          ? 'Chưa lưu được.'
          : 'Thay đổi tự lưu';
  return (
    <span className="flex h-4 items-center gap-3">
      <span role="status" aria-live="polite">
        {text}
      </span>
      {state.kind === 'saved' && state.undo && (
        <Button type="button" variant="link" className={INLINE_ACTION} onClick={undo}>
          <Undo2 aria-hidden />
          Hoàn tác
        </Button>
      )}
      {state.kind === 'failed' && (
        <Button type="button" variant="link" className={INLINE_ACTION} onClick={retry}>
          Thử lại
        </Button>
      )}
    </span>
  );
}
