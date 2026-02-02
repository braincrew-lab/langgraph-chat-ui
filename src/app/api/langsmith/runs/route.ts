import { Client, type Run } from "langsmith";
import { NextRequest, NextResponse } from "next/server";
import { LangSmithRun, buildRunHierarchy } from "@/types/langsmith";

// LangSmith Run 객체를 LangSmithRun 형식으로 변환
function convertRun(run: Run): LangSmithRun {
  // start_time, end_time은 string | number 타입일 수 있음
  const formatTime = (time: string | number | undefined | null): string => {
    if (!time) return "";
    if (typeof time === "string") return time;
    return new Date(time).toISOString();
  };

  // latency 계산 (end_time - start_time)
  const calculateLatency = (
    start: string | number | undefined | null,
    end: string | number | undefined | null,
  ): number | undefined => {
    if (!start || !end) return undefined;
    const startMs =
      typeof start === "string" ? new Date(start).getTime() : start;
    const endMs = typeof end === "string" ? new Date(end).getTime() : end;
    return endMs - startMs;
  };

  return {
    id: run.id,
    name: run.name,
    runType: run.run_type,
    status: run.status || "unknown",
    startTime: formatTime(run.start_time),
    endTime: formatTime(run.end_time) || undefined,
    latency: calculateLatency(run.start_time, run.end_time),
    inputs: run.inputs,
    outputs: run.outputs,
    error: run.error || undefined,
    parentRunId: run.parent_run_id || undefined,
    traceId: run.trace_id || undefined,
    dotted_order: run.dotted_order || undefined,
    metadata: run.extra?.metadata as Record<string, unknown> | undefined,
  };
}

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("threadId");
  const traceId = req.nextUrl.searchParams.get("traceId");

  if (!threadId && !traceId) {
    return NextResponse.json(
      { error: "threadId or traceId required" },
      { status: 400 },
    );
  }

  const apiKey = process.env.LANGSMITH_API_KEY;
  const projectName = process.env.LANGSMITH_PROJECT;

  if (!apiKey) {
    return NextResponse.json(
      { error: "LANGSMITH_API_KEY not configured" },
      { status: 500 },
    );
  }

  if (!projectName) {
    return NextResponse.json(
      { error: "LANGSMITH_PROJECT not configured" },
      { status: 500 },
    );
  }

  try {
    const client = new Client({
      apiKey,
    });

    const runs: LangSmithRun[] = [];

    // traceId로 직접 조회하는 경우
    if (traceId) {
      for await (const run of client.listRuns({
        traceId,
      })) {
        runs.push(convertRun(run));
      }
    }
    // threadId로 조회하는 경우 (metadata에서 session_id 또는 thread_id로 필터)
    else if (threadId) {
      // LangSmith filter query로 thread_id 또는 session_id가 일치하는 runs 조회
      const filterQuery = `and(in(metadata_key, ["session_id","thread_id"]), eq(metadata_value, "${threadId}"))`;

      for await (const run of client.listRuns({
        projectName,
        filter: filterQuery,
      })) {
        runs.push(convertRun(run));
      }
    }

    // dotted_order로 정렬 (실행 순서)
    runs.sort((a, b) => {
      if (a.dotted_order && b.dotted_order) {
        return a.dotted_order.localeCompare(b.dotted_order);
      }
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    // 계층 구조 정보 빌드
    const hierarchy = buildRunHierarchy(runs);

    return NextResponse.json({ runs, hierarchy });
  } catch (error) {
    console.error("Failed to fetch LangSmith runs:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
