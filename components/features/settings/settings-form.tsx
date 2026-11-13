'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { PageShell } from '@/components/layout/page-shell';
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
import { furiganaInApp, type Settings } from '@/lib/settings/schema';

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
  useAutosave(settings, setSettings, initial);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="form"
        title="Cài đặt"
        tabs={<PageTabs items={SETTINGS_TABS.items} label={SETTINGS_TABS.label} />}
      >
        <PracticeTab settings={settings} set={set} />
        <DataTab isAdmin={isAdmin} />
        <AccountTab {...account} isAdmin={isAdmin} furigana={furiganaInApp(initial.furiganaMode)} />
        <GuideTab mcpUrl={mcpUrl} openTab={setTab} />
      </PageShell>
    </Tabs>
  );
}

// thien, U1 gate (2026-11-09/10): no sticky Lưu at the foot. Each change saves itself a moment after
// the last press (a stepper fires once per press), and a bar floats up above the phone's tab bar
// (the shared toaster) with Hoàn tác, so it is in reach wherever the page is scrolled. It stays 8s,
// longer than a plain toast, so there is time to press it.
const SAVE_DELAY_MS = 600;
const UNDO_MS = 8000;
const TOAST_ID = 'settings-save';

function useAutosave(
  settings: Settings,
  setSettings: Dispatch<SetStateAction<Settings>>,
  initial: Settings,
) {
  const saved = useRef(initial);
  const undoing = useRef(false);
  // Bumped when a save ends or is retried, so a change made while one ran is saved next.
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
      const before = saved.current;
      const result = await saveSettingsAction(patch).catch(() => null);
      busy.current = false;
      if (result?.ok) {
        saved.current = { ...before, ...patch };
        if (undoing.current) {
          toast.success('Đã hoàn tác', { id: TOAST_ID, duration: 3000 });
        } else {
          toast.success('Đã lưu', {
            id: TOAST_ID,
            duration: UNDO_MS,
            action: {
              label: 'Hoàn tác',
              onClick: () => {
                undoing.current = true;
                setSettings((now) => ({ ...now, ...changed(now, before) }));
              },
            },
          });
        }
        undoing.current = false;
      } else {
        toast.error('Chưa lưu được.', {
          id: TOAST_ID,
          duration: UNDO_MS,
          action: { label: 'Thử lại', onClick: () => setRound((r) => r + 1) },
        });
      }
      setRound((r) => r + 1);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [settings, round, setSettings]);
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
