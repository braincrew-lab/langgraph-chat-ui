import { auth } from "@/lib/auth";
import { getUserStats } from "@/lib/services/user.service";
import { getAuthModeConfig } from "@/lib/auth/mode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Users, UserCheck, UserX, Clock, Shield } from "lucide-react";

export default async function AdminDashboardPage() {
  const session = await auth();
  const stats = await getUserStats();
  const config = getAuthModeConfig();

  const statCards = [
    {
      title: "전체 사용자",
      value: stats.total,
      description: "등록된 사용자",
      icon: Users,
      bgColor: "bg-blue-100 dark:bg-blue-900/50",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "활성 사용자",
      value: stats.active,
      description: "서비스 이용 가능",
      icon: UserCheck,
      bgColor: "bg-green-100 dark:bg-green-900/50",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "승인 대기",
      value: stats.pending,
      description: "검토 대기 중",
      icon: Clock,
      bgColor: "bg-amber-100 dark:bg-amber-900/50",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "정지됨",
      value: stats.suspended,
      description: "이용 제한됨",
      icon: UserX,
      bgColor: "bg-red-100 dark:bg-red-900/50",
      iconColor: "text-red-600 dark:text-red-400",
    },
    {
      title: "관리자",
      value: stats.admins,
      description: "관리자 계정",
      icon: Shield,
      bgColor: "bg-purple-100 dark:bg-purple-900/50",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
  ];

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground">
          안녕하세요, {session?.user?.name || session?.user?.email}님
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => (
          <Card key={stat.title} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>시스템 설정</CardTitle>
          <CardDescription>
            현재 인증 및 회원가입 설정
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">
                인증 모드
              </dt>
              <dd className="text-sm font-semibold">
                {getModeLabel(config.mode)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">
                회원가입 정책
              </dt>
              <dd className="text-sm font-semibold">
                {getPolicyLabel(config.registrationPolicy)}
              </dd>
            </div>
            {config.initialAdminEmail && (
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-sm font-medium text-muted-foreground">
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
    </div>
  );
}
