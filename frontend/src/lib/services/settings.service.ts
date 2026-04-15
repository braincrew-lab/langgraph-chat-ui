import { prisma } from "@/lib/auth/prisma";
import {
  DEFAULT_SETTINGS,
  GlobalSettings,
  SettingKey,
  SettingCategory,
  GlobalSettingRecord,
} from "@/types/global-settings";
import { usesNextAuth } from "@/types/auth-mode";
import { getTranslations } from "next-intl/server";

/**
 * Check if database is available (only in modes that use NextAuth + Prisma)
 */
function isDatabaseAvailable(): boolean {
  return usesNextAuth();
}

/**
 * Get a single setting value
 * Returns the DB value if exists, otherwise the default value
 */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<GlobalSettings[K]> {
  // In standalone/oauth-direct mode, always return defaults
  if (!isDatabaseAvailable()) {
    return DEFAULT_SETTINGS[key];
  }

  const setting = await prisma.globalSetting.findUnique({
    where: { key },
  });

  if (setting) {
    try {
      return JSON.parse(setting.value) as GlobalSettings[K];
    } catch {
      return DEFAULT_SETTINGS[key];
    }
  }

  return DEFAULT_SETTINGS[key];
}

/**
 * Get multiple settings at once
 * Returns an object with all requested settings
 */
export async function getSettings<K extends SettingKey>(
  keys: K[],
): Promise<Pick<GlobalSettings, K>> {
  // In standalone/oauth-direct mode, always return defaults
  if (!isDatabaseAvailable()) {
    const result: Partial<GlobalSettings> = {};
    for (const key of keys) {
      result[key] = DEFAULT_SETTINGS[key];
    }
    return result as Pick<GlobalSettings, K>;
  }

  const settings = await prisma.globalSetting.findMany({
    where: { key: { in: keys } },
  });

  const result: Partial<GlobalSettings> = {};

  for (const key of keys) {
    const setting = settings.find((s) => s.key === key);
    if (setting) {
      try {
        result[key] = JSON.parse(setting.value);
      } catch {
        result[key] = DEFAULT_SETTINGS[key];
      }
    } else {
      result[key] = DEFAULT_SETTINGS[key];
    }
  }

  return result as Pick<GlobalSettings, K>;
}

/**
 * Get all settings, merged with defaults
 */
export async function getAllSettings(): Promise<GlobalSettings> {
  // In standalone/oauth-direct mode, always return defaults
  if (!isDatabaseAvailable()) {
    return { ...DEFAULT_SETTINGS };
  }

  const dbSettings = await prisma.globalSetting.findMany();

  const result: GlobalSettings = { ...DEFAULT_SETTINGS };

  for (const setting of dbSettings) {
    const key = setting.key as SettingKey;
    if (key in DEFAULT_SETTINGS) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[key] = JSON.parse(setting.value);
      } catch {
        // Keep default value
      }
    }
  }

  return result;
}

/**
 * Get only settings explicitly stored in the database (no DEFAULT_SETTINGS merge).
 * Used for 3-layer config merge so we can distinguish admin-set values from defaults.
 */
export async function getDbOnlySettings(): Promise<Partial<GlobalSettings>> {
  if (!isDatabaseAvailable()) {
    return {};
  }

  const dbSettings = await prisma.globalSetting.findMany();
  const result: Partial<GlobalSettings> = {};

  for (const setting of dbSettings) {
    const key = setting.key as SettingKey;
    if (key in DEFAULT_SETTINGS) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[key] = JSON.parse(setting.value);
      } catch {
        // Skip unparseable values
      }
    }
  }

  return result;
}

/**
 * Get all settings by category
 */
export async function getSettingsByCategory(
  category: SettingCategory,
): Promise<GlobalSettingRecord[]> {
  // In standalone/oauth-direct mode, return empty array
  if (!isDatabaseAvailable()) {
    return [];
  }

  return prisma.globalSetting.findMany({
    where: { category },
    orderBy: { key: "asc" },
  });
}

/**
 * Update a single setting
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  value: GlobalSettings[K],
  updatedById?: string,
): Promise<void> {
  // In standalone/oauth-direct mode, settings cannot be updated
  if (!isDatabaseAvailable()) {
    console.warn("Settings cannot be updated in standalone/oauth-direct mode");
    return;
  }

  const category = key.split(".")[0] as SettingCategory;

  await prisma.globalSetting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(value),
      category,
      updatedById,
    },
    update: {
      value: JSON.stringify(value),
      updatedById,
    },
  });

  // Log the action
  if (updatedById) {
    await prisma.auditLog.create({
      data: {
        userId: updatedById,
        action: "setting.update",
        target: key,
        details: JSON.stringify({ value }),
      },
    });
  }
}

/**
 * Update multiple settings at once
 */
export async function updateSettings(
  settings: Partial<GlobalSettings>,
  updatedById?: string,
): Promise<void> {
  // In standalone/oauth-direct mode, settings cannot be updated
  if (!isDatabaseAvailable()) {
    console.warn("Settings cannot be updated in standalone/oauth-direct mode");
    return;
  }

  const operations = Object.entries(settings).map(([key, value]) => {
    const category = key.split(".")[0] as SettingCategory;
    return prisma.globalSetting.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify(value),
        category,
        updatedById,
      },
      update: {
        value: JSON.stringify(value),
        updatedById,
      },
    });
  });

  // Include audit log in the same transaction
  if (updatedById) {
    operations.push(
      prisma.auditLog.create({
        data: {
          userId: updatedById,
          action: "setting.bulkUpdate",
          details: JSON.stringify({ keys: Object.keys(settings) }),
        },
      }) as unknown as ReturnType<typeof prisma.globalSetting.upsert>,
    );
  }

  await prisma.$transaction(operations);
}

/**
 * Reset a setting to its default value
 */
export async function resetSetting<K extends SettingKey>(
  key: K,
  resetById?: string,
): Promise<void> {
  // In standalone/oauth-direct mode, nothing to reset
  if (!isDatabaseAvailable()) {
    return;
  }

  await prisma.globalSetting
    .delete({
      where: { key },
    })
    .catch(() => {
      // Setting may not exist in DB
    });

  if (resetById) {
    await prisma.auditLog.create({
      data: {
        userId: resetById,
        action: "setting.reset",
        target: key,
      },
    });
  }
}

/**
 * Reset all settings to defaults
 */
export async function resetAllSettings(resetById?: string): Promise<void> {
  // In standalone/oauth-direct mode, nothing to reset
  if (!isDatabaseAvailable()) {
    return;
  }

  await prisma.globalSetting.deleteMany();

  if (resetById) {
    await prisma.auditLog.create({
      data: {
        userId: resetById,
        action: "setting.resetAll",
      },
    });
  }
}

/**
 * Get locale-aware text defaults from i18n messages.
 * Returns text fields overridden with the current locale's translations.
 */
export async function getLocalizedTextDefaults(): Promise<
  Partial<GlobalSettings>
> {
  const t = await getTranslations("defaults");
  return {
    "ui.welcomeMessage": t("welcomeMessage"),
    "ui.chatInputPlaceholder": t("chatInputPlaceholder"),
  };
}

/**
 * Get server defaults (includes environment variables + locale-aware text)
 * Used for placeholder display and reset functionality in admin UI
 */
export async function getServerDefaults(): Promise<GlobalSettings> {
  const localizedText = await getLocalizedTextDefaults();

  return {
    ...DEFAULT_SETTINGS,
    ...localizedText,
    // Override with environment variables where applicable
    "features.defaultConnectionApiUrl":
      process.env.NEXT_PUBLIC_API_URL ||
      DEFAULT_SETTINGS["features.defaultConnectionApiUrl"],
    "features.defaultGraphId":
      process.env.NEXT_PUBLIC_ASSISTANT_ID ||
      DEFAULT_SETTINGS["features.defaultGraphId"],
  };
}

/**
 * Get settings with metadata (for admin UI)
 */
export async function getSettingsWithMeta(): Promise<
  Array<{
    key: string;
    value: unknown;
    category: string;
    isDefault: boolean;
    updatedAt?: Date;
  }>
> {
  // In standalone/oauth-direct mode, return all defaults
  if (!isDatabaseAvailable()) {
    return (Object.keys(DEFAULT_SETTINGS) as SettingKey[]).map((key) => ({
      key,
      value: DEFAULT_SETTINGS[key],
      category: key.split(".")[0],
      isDefault: true,
      updatedAt: undefined,
    }));
  }

  const dbSettings = await prisma.globalSetting.findMany();
  const dbSettingsMap = new Map(dbSettings.map((s) => [s.key, s]));

  return (Object.keys(DEFAULT_SETTINGS) as SettingKey[]).map((key) => {
    const dbSetting = dbSettingsMap.get(key);
    return {
      key,
      value: dbSetting ? JSON.parse(dbSetting.value) : DEFAULT_SETTINGS[key],
      category: key.split(".")[0],
      isDefault: !dbSetting,
      updatedAt: dbSetting?.updatedAt,
    };
  });
}
