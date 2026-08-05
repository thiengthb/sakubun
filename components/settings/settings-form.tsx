'use client';

import { useMemo, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { PageShell } from '@/components/shell/page-shell';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import { Tabs } from '@/components/ui/tabs';
import { TabSelect } from '@/components/shared/tab-select';
import { ContentTab } from '@/components/settings/settings-content-tab';
import { PaceTab } from '@/components/settings/settings-pace-tab';
import { SensoryTab } from '@/components/settings/settings-sensory-tab';
import { DataTab } from '@/components/settings/settings-data-tab';
import { AccountTab } from '@/components/settings/settings-account-tab';
import type { McpKeyRow } from '@/components/settings/settings-account-tab';
import { useSessionState } from '@/components/shared/use-session-state';
import { saveSettingsAction } from '@/app/actions';
import { type Settings } from '@/lib/settings-schema';

interface SettingsFormProps {
  initial: Settings;
  /** Identity + MCP tokens — both live in the one "Tài khoản" tab (was the separate /account page). */
  account: {
    name: string;
    email: string;
    image: string | null;
    hasPassword: boolean;
    joinedAt: string | null;
    lastLoginAt: string | null;
    keys: McpKeyRow[];
  };
}

// Five tabs — "Token MCP" folded into "Tài khoản" on 2026-08-04 (see AccountTab): an MCP token is a
// credential OF the account, not a sixth category of setting. Even five is near the limit a tab bar
// handles at 360px, which is what TabSelect exists for.
const SETTINGS_TABS = [
  { value: 'content', label: 'Nội dung' },
  { value: 'pace', label: 'Nhịp học' },
  { value: 'sensory', label: 'Nghe & nói' },
  { value: 'data', label: 'Dữ liệu' },
  { value: 'account', label: 'Tài khoản' },
] as const;

/** Tabs whose contents are part of the Settings object and therefore share the one Save button. */
const SAVEABLE_TABS = new Set(['content', 'pace', 'sensory', 'data']);

export function SettingsForm({ initial, account }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>(initial);
  // Remember the active tab across navigation + reload (same session).
  const [tab, setTab] = useSessionState('settings.tab', 'content', 'tab');
  // The last-SAVED snapshot the dirty check compares against. Seeded from `initial`, then advanced to
  // the just-saved settings on each successful save (see onSave) — so "dirty" clears from client state
  // alone, never depending on a server refresh re-flowing a fresh `initial` prop.
  const [saved, setSaved] = useState<Settings>(initial);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  // Nothing to save until the form actually differs from the last saved snapshot — a stable JSON
  // compare (the settings object is a flat set of primitives in fixed schema key order) drives the
  // Save button's disabled state so the user never submits an unchanged form.
  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved],
  );

  // Save via a plain event handler + useTransition — deliberately NOT a `<form action>`/useActionState.
  // The form-action path re-rendered/reset the open form after submit (React 19 form lifecycle + the
  // server-action round-trip), which reverted the just-edited values and left Save enabled even though
  // the write succeeded. Calling the Server Action directly from onClick keeps `settings`/`saved` as
  // plain state only this component mutates, so nothing external can revert the form. On success the
  // SUBMITTED snapshot becomes the new baseline (byte-equal to `settings`, so `dirty` clears cleanly).
  const [isSaving, startTransition] = useTransition();
  const onSave = () => {
    const snapshot = settings;
    startTransition(async () => {
      const result = await saveSettingsAction(snapshot);
      toastResult(result, 'Đã lưu cài đặt');
      if (result.ok) setSaved(snapshot);
    });
  };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        section="settings"
        headerAside={
          <>
            <TabSelect
              items={SETTINGS_TABS}
              value={tab}
              onValueChange={setTab}
              label="Chọn mục cài đặt"
            />
            {/* Only the four settings tabs are driven by this Save. The account + token tabs each
                commit on their own (better-auth call / server action), so showing a settings Save
                beside them would suggest their changes need it. */}
            {SAVEABLE_TABS.has(tab) && (
              <ExpandingIconButton
                type="button"
                icon={Save}
                label={isSaving ? 'Đang lưu…' : dirty ? 'Lưu' : 'Đã lưu'}
                variant="default"
                disabled={isSaving || !dirty}
                onClick={onSave}
                className="ml-auto"
              />
            )}
          </>
        }
      >
        <ContentTab settings={settings} set={set} setSettings={setSettings} />
        <PaceTab settings={settings} set={set} />
        <SensoryTab settings={settings} set={set} />
        <DataTab />
        <AccountTab {...account} />
      </PageShell>
    </Tabs>
  );
}
