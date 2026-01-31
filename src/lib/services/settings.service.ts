import { prisma } from "@/lib/auth/prisma";
import {
  DEFAULT_SETTINGS,
  GlobalSettings,
  SettingKey,
  SettingCategory,
  GlobalSettingRecord,
} from "@/types/global-settings";

/**
 * Get a single setting value
 * Returns the DB value if exists, otherwise the default value
 */
export async function getSetting<K extends SettingKey>(
  key: K
): Promise<GlobalSettings[K]> {
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
  keys: K[]
): Promise<Pick<GlobalSettings, K>> {
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
 * Get all settings by category
 */
export async function getSettingsByCategory(
  category: SettingCategory
): Promise<GlobalSettingRecord[]> {
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
  updatedById?: string
): Promise<void> {
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
  updatedById?: string
): Promise<void> {
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

  await prisma.$transaction(operations);

  // Log the action
  if (updatedById) {
    await prisma.auditLog.create({
      data: {
        userId: updatedById,
        action: "setting.bulkUpdate",
        details: JSON.stringify({ keys: Object.keys(settings) }),
      },
    });
  }
}

/**
 * Reset a setting to its default value
 */
export async function resetSetting<K extends SettingKey>(
  key: K,
  resetById?: string
): Promise<void> {
  await prisma.globalSetting.delete({
    where: { key },
  }).catch(() => {
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
