"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
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

import { StringArrayInput } from "./StringArrayInput";
import { ImagePreview } from "./ImagePreview";

export function SettingsForm({
  initialSettings,
  serverDefaults,
}: SettingsFormProps) {
  const router = useRouter();
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();

  const CATEGORY_LABELS: Record<SettingCategory, string> = {
    auth: t('settings.categoryAuth'),
    ui: t('settings.categoryUi'),
    features: t('settings.categoryFeatures'),
    branding: t('settings.categoryBranding'),
  };
  const [settings, setSettings] = useState<GlobalSettings>(initialSettings);
  const [saved, setSaved] = useState(false);

  const handleChange = <K extends keyof GlobalSettings>(
    key: K,
    value: GlobalSettings[K],
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
              <Label htmlFor={definition.key}>{t(`settings.labels.${definition.key}`)}</Label>
              <p className="text-muted-foreground text-sm">
                {t(`settings.descriptions.${definition.key}`)}
              </p>
            </div>
            <Switch
              id={definition.key}
              checked={value as boolean}
              onCheckedChange={(checked) =>
                handleChange(
                  definition.key,
                  checked as GlobalSettings[typeof definition.key],
                )
              }
            />
          </div>
        );

      case "select":
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{t(`settings.labels.${definition.key}`)}</Label>
            <Select
              value={value as string}
              onValueChange={(val) =>
                handleChange(
                  definition.key,
                  val as GlobalSettings[typeof definition.key],
                )
              }
            >
              <SelectTrigger id={definition.key}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {definition.options?.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-sm">
              {t(`settings.descriptions.${definition.key}`)}
            </p>
          </div>
        );

      case "url":
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{t(`settings.labels.${definition.key}`)}</Label>
            <ImagePreview
              value={value as string}
              onChange={(val) =>
                handleChange(
                  definition.key,
                  val as GlobalSettings[typeof definition.key],
                )
              }
              placeholder={(defaultValue as string) || undefined}
              defaultValue={defaultValue as string}
            />
            <p className="text-muted-foreground text-sm">
              {t(`settings.descriptions.${definition.key}`)}
            </p>
          </div>
        );

      case "array":
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{t(`settings.labels.${definition.key}`)}</Label>
            <StringArrayInput
              value={value as string[]}
              onChange={(val) =>
                handleChange(
                  definition.key,
                  val as GlobalSettings[typeof definition.key],
                )
              }
              maxItems={definition.maxItems}
            />
            <p className="text-muted-foreground text-sm">
              {t(`settings.descriptions.${definition.key}`)}
            </p>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={definition.key}>{t(`settings.labels.${definition.key}`)}</Label>
            <Input
              id={definition.key}
              type="text"
              value={value as string}
              placeholder={(defaultValue as string) || undefined}
              onChange={(e) =>
                handleChange(
                  definition.key,
                  e.target.value as GlobalSettings[typeof definition.key],
                )
              }
            />
            <p className="text-muted-foreground text-sm">
              {t(`settings.descriptions.${definition.key}`)}
            </p>
          </div>
        );
    }
  };

  const categories = [...new Set(SETTING_DEFINITIONS.map((d) => d.category))];
  const categoryEntries = categories.map((category) => ({
    category,
    settings: SETTING_DEFINITIONS.filter((d) => d.category === category),
  }));

  const leftColumn = categoryEntries.filter((_, index) => index % 2 === 0);
  const rightColumn = categoryEntries.filter((_, index) => index % 2 === 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {leftColumn.map(({ category, settings }) => (
            <Card
              key={category}
              className="border-border/70 bg-card"
            >
              <CardHeader>
                <CardTitle className="text-bold text-xl">
                  {CATEGORY_LABELS[category]}
                </CardTitle>
                <CardDescription>
                  {t('settings.categoryDescription', { category: CATEGORY_LABELS[category] })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings.map((definition) => (
                  <div key={definition.key}>{renderField(definition)}</div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          {rightColumn.map(({ category, settings }) => (
            <Card
              key={category}
              className="border-border/70 bg-card"
            >
              <CardHeader>
                <CardTitle className="text-bold text-xl">
                  {CATEGORY_LABELS[category]}
                </CardTitle>
                <CardDescription>
                  {t('settings.categoryDescription', { category: CATEGORY_LABELS[category] })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settings.map((definition) => (
                  <div key={definition.key}>{renderField(definition)}</div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isPending}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          {t('settings.resetToDefaults')}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isPending}
        >
          <Save className="mr-2 h-4 w-4" />
          {isPending ? t('settings.saving') : saved ? t('settings.saved') : t('settings.saveChanges')}
        </Button>
      </div>
    </div>
  );
}
