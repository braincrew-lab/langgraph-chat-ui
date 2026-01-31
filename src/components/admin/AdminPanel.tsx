"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  X,
  Shield,
  RefreshCw,
  Clock,
  UserX,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SETTING_DEFINITIONS,
  DEFAULT_SETTINGS,
  type GlobalSettings,
  type SettingMeta,
  type SettingCategory,
} from "@/types/global-settings";

type AdminTab = "dashboard" | "users" | "approvals" | "settings";

interface AdminPanelProps {
  onClose: () => void;
  pendingCount?: number;
}

interface UserStats {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  admins: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
}

const CATEGORY_LABELS: Record<SettingCategory, string> = {
  auth: "인증 설정",
  ui: "UI 설정",
  features: "기능 설정",
};

export function AdminPanel({ onClose, pendingCount = 0 }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const router = useRouter();

  const tabs = [
    { id: "dashboard" as const, label: "대시보드", icon: LayoutDashboard },
    { id: "users" as const, label: "사용자", icon: Users },
    { id: "approvals" as const, label: "승인 대기", icon: UserCheck, badge: pendingCount },
    { id: "settings" as const, label: "설정", icon: Settings },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">관리자</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {tab.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "approvals" && <ApprovalsTab onCountChange={() => router.refresh()} />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

// Dashboard Tab
function DashboardTab() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users?stats=true")
      .then((res) => res.json())
      .then((data) => setStats(data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;
  }

  const statCards = [
    { label: "전체", value: stats?.total ?? 0, icon: Users, color: "text-blue-600" },
    { label: "활성", value: stats?.active ?? 0, icon: UserCheck, color: "text-green-600" },
    { label: "대기", value: stats?.pending ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "정지", value: stats?.suspended ?? 0, icon: UserX, color: "text-red-600" },
    { label: "관리자", value: stats?.admins ?? 0, icon: Shield, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">사용자 통계</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold">{stat.value}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Users Tab
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">사용자 목록 ({users.length})</h3>
        <Button variant="ghost" size="sm" onClick={fetchUsers}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        {users.map((user) => (
          <UserCard key={user.id} user={user} onAction={fetchUsers} />
        ))}
        {users.length === 0 && (
          <p className="text-center text-muted-foreground py-4">사용자가 없습니다</p>
        )}
      </div>
    </div>
  );
}

// Approvals Tab
function ApprovalsTab({ onCountChange }: { onCountChange: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPending = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/users?status=pending")
      .then((res) => res.json())
      .then((data) => setUsers(data.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = () => {
    fetchPending();
    onCountChange();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">승인 대기 ({users.length})</h3>
      <div className="space-y-2">
        {users.map((user) => (
          <UserCard key={user.id} user={user} onAction={handleAction} showApprove />
        ))}
        {users.length === 0 && (
          <p className="text-center text-muted-foreground py-4">대기 중인 요청이 없습니다</p>
        )}
      </div>
    </div>
  );
}

// User Card Component
function UserCard({ user, onAction, showApprove }: { user: User; onAction: () => void; showApprove?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${user.id}/approve`, { method: "POST" });
      onAction();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${user.id}/suspend`, { method: "POST" });
      onAction();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${user.id}/reactivate`, { method: "POST" });
      onAction();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    user: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{user.name || user.email}</span>
            <Badge className={cn("text-xs", statusColors[user.status] || "")}>
              {user.status}
            </Badge>
            <Badge className={cn("text-xs", roleColors[user.role] || "")}>
              {user.role}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <div className="flex gap-1">
          {showApprove && user.status === "pending" && (
            <Button size="sm" onClick={handleApprove} disabled={loading}>
              승인
            </Button>
          )}
          {user.status === "active" && user.role === "user" && (
            <Button size="sm" variant="outline" onClick={handleSuspend} disabled={loading}>
              정지
            </Button>
          )}
          {user.status === "suspended" && (
            <Button size="sm" variant="outline" onClick={handleReactivate} disabled={loading}>
              해제
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// Settings Tab
function SettingsTab() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.settings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = <K extends keyof GlobalSettings>(
    key: K,
    value: GlobalSettings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    setSaved(false);
  };

  if (loading || !settings) {
    return <div className="flex items-center justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin" /></div>;
  }

  const renderField = (definition: SettingMeta) => {
    const value = settings[definition.key];

    switch (definition.type) {
      case "boolean":
        return (
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor={definition.key} className="text-sm">{definition.label}</Label>
              <p className="text-xs text-muted-foreground">{definition.description}</p>
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
          <div className="space-y-2 py-2">
            <Label htmlFor={definition.key} className="text-sm">{definition.label}</Label>
            <Select
              value={value as string}
              onValueChange={(val) =>
                handleChange(definition.key, val as GlobalSettings[typeof definition.key])
              }
            >
              <SelectTrigger id={definition.key} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {definition.options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "open" ? "자유 가입" : option === "approval" ? "승인 필요" : option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          </div>
        );

      default:
        return (
          <div className="space-y-2 py-2">
            <Label htmlFor={definition.key} className="text-sm">{definition.label}</Label>
            <Input
              id={definition.key}
              type="text"
              value={value as string}
              onChange={(e) =>
                handleChange(definition.key, e.target.value as GlobalSettings[typeof definition.key])
              }
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">{definition.description}</p>
          </div>
        );
    }
  };

  const categories = [...new Set(SETTING_DEFINITIONS.map((d) => d.category))];

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const categorySettings = SETTING_DEFINITIONS.filter((d) => d.category === category);
        return (
          <Card key={category}>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{CATEGORY_LABELS[category]}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              {categorySettings.map((definition) => (
                <div key={definition.key} className="border-b last:border-0">
                  {renderField(definition)}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-2 h-3 w-3" />
          초기화
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-3 w-3" />
          {saving ? "저장 중..." : saved ? "저장됨" : "저장"}
        </Button>
      </div>
    </div>
  );
}
