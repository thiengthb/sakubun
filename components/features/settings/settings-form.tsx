'use client';

import { useMemo, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { PageShell } from '@/components/layout/page-shell';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { Tabs } from '@/components/ui/tabs';
import { TabSelect } from '@/components/common/tab-select';
import { PracticeTab } from '@/components/features/settings/settings-practice-tab';
import { DataTab } from '@/components/features/settings/settings-data-tab';
import { AccountTab } from '@/components/features/settings/settings-account-tab';
import type { McpKeyRow } from '@/components/features/settings/settings-account-tab';
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
    mcpUsage: ToolUsageReport;
  };
}

const SETTINGS_TABS = [
  { value: 'practice', label: 'Luyện tập' },
  { value: 'data', label: 'Dữ liệu' },
  { value: 'account', label: 'Tài khoản' },
] as const;

const SAVEABLE_TABS = new Set(['practice', 'data']);

// Nội dung / Nhịp học / Nghe & nói merged into one tab. sessionStorage still holds the old value
// for anyone who had Settings open, and Radix renders NOTHING for a value with no TabsContent —
// a blank page. Fold the retired values onto the tab that absorbed them.
const RETIRED_TABS: Record<string, string> = {
  content: 'practice',
  pace: 'practice',
  sensory: 'practice',
};

export function SettingsForm({ initial, account }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [storedTab, setTab] = useSessionState('settings.tab', 'practice', 'tab');
  const tab = RETIRED_TABS[storedTab] ?? storedTab;
  const [saved, setSaved] = useState<Settings>(initial);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(saved),
    [settings, saved],
  );

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
        <PracticeTab settings={settings} set={set} setSettings={setSettings} />
        <DataTab />
        <AccountTab {...account} />
      </PageShell>
    </Tabs>
  );
}
