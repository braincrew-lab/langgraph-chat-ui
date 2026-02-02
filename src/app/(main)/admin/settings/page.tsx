import {
  getAllSettings,
  getServerDefaults,
} from "@/lib/services/settings.service";
import { SettingsForm } from "@/features/admin/components/SettingsForm";

export default async function SettingsPage() {
  const settings = await getAllSettings();
  const serverDefaults = getServerDefaults();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">설정</h1>
        <p className="text-muted-foreground">
          전역 애플리케이션 설정을 관리합니다
        </p>
      </div>

      <SettingsForm
        initialSettings={settings}
        serverDefaults={serverDefaults}
      />
    </div>
  );
}
