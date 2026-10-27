'use client';

import { useMemo, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { FormFooter, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { PageTabs } from '@/components/common/page-tabs';
import { SETTINGS_TABS } from '@/components/layout/page-heads';
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
    mcpUsage: ToolUsageReport | null;
  };
  isAdmin: boolean;
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

export function SettingsForm({ initial, account, isAdmin }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [storedTab, setTab] = useSessionState(
    SETTINGS_TABS.storeKey,
    SETTINGS_TABS.initial,
    SETTINGS_TABS.urlKey,
  );
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
        template="form"
        title="Cài đặt"
        tabs={<PageTabs items={SETTINGS_TABS.items} label={SETTINGS_TABS.label} />}
      >
        <PracticeTab settings={settings} set={set} setSettings={setSettings} />
        <DataTab isAdmin={isAdmin} />
        <AccountTab {...account} isAdmin={isAdmin} />
        {SAVEABLE_TABS.has(tab) && (
          <FormFooter status={dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu'}>
            <Button type="button" disabled={isSaving || !dirty} onClick={onSave}>
              <Save aria-hidden />
              {isSaving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </FormFooter>
        )}
      </PageShell>
    </Tabs>
  );
}
