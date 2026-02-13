import {
  getAllSettings,
  getServerDefaults,
} from "@/lib/services/settings.service";
import { SettingsForm } from "@/features/admin/components/SettingsForm";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const [settings, serverDefaults, t] = await Promise.all([
    getAllSettings(),
    getServerDefaults(),
    getTranslations('admin'),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        description={t('settings.description')}
      />

      <SettingsForm
        initialSettings={settings}
        serverDefaults={serverDefaults}
      />
    </div>
  );
}
