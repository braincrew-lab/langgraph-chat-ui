import {
  getAllSettings,
  getServerDefaults,
} from "@/lib/services/settings.service";
import { SettingsForm } from "@/features/admin/components/SettingsForm";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";

export default async function SettingsPage() {
  const settings = await getAllSettings();
  const serverDefaults = getServerDefaults();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="시스템 설정"
        title="전역 환경 설정"
        description="브랜딩, 기능 플래그, 연결 기본값 등 운영 전반 설정을 관리합니다."
      />

      <SettingsForm
        initialSettings={settings}
        serverDefaults={serverDefaults}
      />
    </div>
  );
}
