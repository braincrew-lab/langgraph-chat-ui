"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  SETTING_DEFINITIONS,
  SettingCategory,
  type GlobalSettings,
  type SettingMeta,
} from "@/types/global-settings";
import { updateAdminSettings } from "@/app/actions/admin";

interface SettingsFormProps {
  initialSettings: GlobalSettings;
  serverDefaults: GlobalSettings;
}

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  auth: "인증 설정",
  ui: "UI 설정",
  features: "기능 설정",
};

export function SettingsForm({ initialSettings, serverDefaults }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<GlobalSettings>(initialSettings);
  const [saved, setSaved] = useState(false);

  const handleChange = <K extends keyof GlobalSettings>(
    key: K,
    value: GlobalSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await updateAdminSettings(settings);

        if (!result.success) {
          alert(result.error || "Failed to save settings");
          return;
        }

        setSaved(true);
        router.refresh();
      } catch (error) {
        console.error(error);
        alert("Failed to save settings");
      }
    });
  };

  const handleReset = () => {
    setSettings({ ...serverDefaults });
    setSaved(false);
  };

  const renderField = (definition: SettingMeta) => {
    const value = settings[definition.key];
    const defaultValue = serverDefaults[definition.key];

    switch (definition.type) {
      case "boolean":
        return (
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={definition.key}>{definition.label}</Label>
              <p className="text-sm text-muted-foreground">
                {definition.description}
              </p>
            </div>
            <Switch
              id={definition.key}
              checked={value as boolean}
              onCheckedChange={(checked) =>
                handleChange(definition.key, checked as GlobalSettings[typeof definition.key])
              }
            />
          </div>
        );

      case "select":
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{definition.label}</Label>
            <Select
              value={value as string}
              onValueChange={(val) =>
                handleChange(definition.key, val as GlobalSettings[typeof definition.key])
              }
            >
              <SelectTrigger id={definition.key}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {definition.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {definition.description}
            </p>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{definition.label}</Label>
            <Input
              id={definition.key}
              type="text"
              value={value as string}
              placeholder={defaultValue as string || undefined}
              onChange={(e) =>
                handleChange(definition.key, e.target.value as GlobalSettings[typeof definition.key])
              }
            />
            <p className="text-sm text-muted-foreground">
              {definition.description}
            </p>
          </div>
        );
    }
  };

  const categories = [...new Set(SETTING_DEFINITIONS.map((d) => d.category))];

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categorySettings = SETTING_DEFINITIONS.filter(
          (d) => d.category === category
        );

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
              <CardDescription>
                {CATEGORY_LABELS[category]} 설정을 구성합니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {categorySettings.map((definition) => (
                <div key={definition.key}>{renderField(definition)}</div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleReset} disabled={isPending}>
          <RotateCcw className="mr-2 h-4 w-4" />
          기본값으로 초기화
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "저장 중..." : saved ? "저장됨!" : "변경사항 저장"}
        </Button>
      </div>
    </div>
  );
}
