export const COMPANY_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#2563eb", // primary
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#64748b", // slate
];

export const STEP_TYPE_LABELS: Record<string, string> = {
  briefing: "説明会",
  es: "エントリーシート",
  aptitude: "適性テスト",
  gd: "グループディスカッション",
  interview_1: "一次面接",
  interview_2: "二次面接",
  interview_3: "三次面接",
  interview_final: "最終面接",
  other: "その他",
};

export const STEP_RESULT_LABELS: Record<string, string> = {
  pending: "未実施",
  waiting: "合否待ち",
  passed: "通過",
  failed: "不通過",
  skipped: "スキップ",
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  resume: "履歴書",
  transcript: "成績証明書",
  health_check: "健康診断書",
  portfolio: "ポートフォリオ",
  cover_letter: "カバーレター",
  other: "その他",
};

export const INTERN_STATUS_LABELS: Record<string, string> = {
  not_applied: "未エントリー",
  applied: "エントリー済",
  waiting: "合否待ち",
  accepted: "参加確定",
  rejected: "落選",
  completed: "参加済み",
};

export const INTERN_MODE_LABELS: Record<string, string> = {
  online: "オンライン",
  offline: "オフライン",
  hybrid: "ハイブリッド",
};

export const SELECTION_STATUS_LABELS: Record<string, string> = {
  in_progress: "選考中",
  waiting: "合否待ち",
  offer: "内定",
  accepted: "内定承諾",
  declined: "内定辞退",
  rejected: "落選",
  withdrawn: "選考辞退",
};

export const SELECTION_STATUS_BADGE: Record<string, string> = {
  in_progress: "bg-blue-100 text-blue-800",
  waiting: "bg-sky-100 text-sky-800",
  offer: "bg-emerald-100 text-emerald-800",
  accepted: "bg-emerald-600 text-white",
  declined: "bg-slate-200 text-slate-700",
  rejected: "bg-rose-100 text-rose-800",
  withdrawn: "bg-slate-100 text-slate-600",
};
