import { auth } from "@/lib/auth";
import { getUserStats } from "@/lib/services/user.service";
import { getAuthModeConfig } from "@/lib/auth/mode";
import { getAllSettings } from "@/lib/services/settings.service";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  ArrowRight,
  Clock,
  Settings2,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";

export default async function AdminDashboardPage() {
  const [session, stats, settings] = await Promise.all([
    auth(),
    getUserStats(),
    getAllSettings(),
  ]);
  const config = getAuthModeConfig();

  const statCards = [
    {
      title: "전체 사용자",
      value: stats.total,
      description: "등록 계정",
      icon: Users,
      iconTone: "bg-muted text-foreground",
    },
    {
      title: "활성 사용자",
      value: stats.active,
      description: "정상 이용",
      icon: UserCheck,
      iconTone: "bg-primary/15 text-primary",
    },
    {
      title: "승인 대기",
      value: stats.pending,
      description: "검토 필요",
      icon: Clock,
      iconTone: "bg-muted text-foreground",
    },
    {
      title: "정지됨",
      value: stats.suspended,
      description: "조치 필요",
      icon: UserX,
      iconTone: "bg-destructive/15 text-destructive",
    },
    {
      title: "관리자",
      value: stats.admins,
      description: "관리자 계정",
      icon: Shield,
      iconTone: "bg-muted text-foreground",
    },
  ];

  const activeRatio = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const getToggleLabel = (enabled: boolean) => (enabled ? "활성" : "비활성");

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "public":
        return "공개 모드";
      case "authenticated":
        return "인증 모드";
      default:
        return mode;
    }
  };

  const getPolicyLabel = (policy: string) => {
    switch (policy) {
      case "open":
        return "자유 가입";
      case "approval":
        return "승인 필요";
      default:
        return policy;
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="운영 현황"
        title="관리자 대시보드"
        description="사용자 상태와 인증 정책을 한눈에 확인하고 조치할 수 있습니다."
        trailing={`담당자: ${session?.user?.name || session?.user?.email}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">활성 비율 {activeRatio}%</Badge>
          <Badge variant="secondary">승인 대기 {stats.pending}건</Badge>
          <Badge variant="secondary">정지 계정 {stats.suspended}건</Badge>
        </div>
      </AdminPageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="border-border/70 bg-card/75 dark:bg-[#303030] overflow-hidden"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.iconTone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-muted-foreground text-xs">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/75 dark:bg-[#303030] h-fit self-start">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>시스템 설정</CardTitle>
                <CardDescription>현재 주요 운영 설정 요약</CardDescription>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 border-0 px-2 shadow-none"
              >
                <Link href="/admin/settings">
                  바로가기
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  인증 모드
                </dt>
                <dd className="text-sm font-semibold">
                  {getModeLabel(config.mode)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  회원가입 허용
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["auth.allowRegistration"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  회원가입 정책
                </dt>
                <dd className="text-sm font-semibold">
                  {getPolicyLabel(settings["auth.registrationPolicy"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  파일 업로드
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableFileUpload"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  채팅 히스토리
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.showHistory"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  스레드 삭제
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableDeletion"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  고급 입력
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableAdvancedInput"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  기본 그래프 ID
                </dt>
                <dd className="text-sm font-semibold">
                  {settings["features.defaultGraphId"] || "미설정"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  기본 커넥션 API
                </dt>
                <dd className="max-w-full break-all text-sm font-semibold">
                  {settings["features.defaultConnectionApiUrl"] || "미설정"}
                </dd>
              </div>
              {config.initialAdminEmail && (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-muted-foreground text-sm font-medium">
                    초기 관리자 이메일
                  </dt>
                  <dd className="text-sm font-semibold">
                    {config.initialAdminEmail}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/75 dark:bg-[#303030]">
          <CardHeader>
            <CardTitle>운영 알림</CardTitle>
            <CardDescription>즉시 확인이 필요한 항목</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/55 dark:bg-[#363636] flex items-start gap-3 rounded-lg border p-3">
              <UserPlus className="text-primary mt-0.5 h-4 w-4" />
              <div className="text-sm">
                <p className="font-medium">승인 대기 요청</p>
                <p className="text-muted-foreground">
                  현재 {stats.pending}건의 가입 요청이 검토를 기다리고 있습니다.
                </p>
              </div>
            </div>
            <div className="bg-muted/55 dark:bg-[#363636] flex items-start gap-3 rounded-lg border p-3">
              <Settings2 className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="text-sm">
                <p className="font-medium">운영 점검</p>
                <p className="text-muted-foreground">
                  정지 계정 {stats.suspended}건, 관리자 계정 {stats.admins}건을
                  주기적으로 확인하세요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
