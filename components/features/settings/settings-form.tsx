'use client';

import { useMemo, useState, useTransition } from 'react';
import { Save } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { PageShell } from '@/components/layout/page-shell';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { Tabs } from '@/components/ui/tabs';
import { TabSelect } from '@/components/common/tab-select';
import { ContentTab } from '@/components/features/settings/settings-content-tab';
import { PaceTab } from '@/components/features/settings/settings-pace-tab';
import { SensoryTab } from '@/components/features/settings/settings-sensory-tab';
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
  { value: 'content', label: 'Nội dung' },
  { value: 'pace', label: 'Nhịp học' },
  { value: 'sensory', label: 'Nghe & nói' },
  { value: 'data', label: 'Dữ liệu' },
  { value: 'account', label: 'Tài khoản' },
] as const;

const SAVEABLE_TABS = new Set(['content', 'pace', 'sensory', 'data']);

export function SettingsForm({ initial, account }: SettingsFormProps) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [tab, setTab] = useSessionState('settings.tab', 'content', 'tab');
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
        <ContentTab settings={settings} set={set} setSettings={setSettings} />
        <PaceTab settings={settings} set={set} />
        <SensoryTab settings={settings} set={set} />
        <DataTab />
        <AccountTab {...account} />
      </PageShell>
    </Tabs>
  );
}
