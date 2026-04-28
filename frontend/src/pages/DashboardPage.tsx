import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronRight,
  Clock,
  Globe,
  GraduationCap,
  KeyRound,
  MapPin,
  Pencil,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { useState } from "react";
import { dashboardSummary, listCompanies } from "../api/endpoints";
import { formatDate, formatDateShort } from "../lib/utils";
import { useAuth } from "../store/auth";
import type { CalendarEvent, Company } from "../api/types";
import AIImportModal from "../components/AIImportModal";
import Modal from "../components/Modal";

type AITargetKind =
  | "internship_step"
  | "selection_step"
  | "internship"
  | "company_only";

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardSummary,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState<AITargetKind | undefined>(undefined);
  const [aiPickerOpen, setAiPickerOpen] = useState(false);

  const openAi = (kind: AITargetKind | undefined) => {
    setAiTarget(kind);
    setAiPickerOpen(false);
    setAiOpen(true);
  };

  const StatLink = ({
    to,
    icon: Icon,
    label,
    value,
    color,
  }: {
    to: string;
    icon: typeof Briefcase;
    label: string;
    value: number | string;
    color: string;
  }) => (
    <Link
      to={to}
      className="card p-4 flex items-center gap-3 hover:shadow-md transition active:scale-[0.98] group"
    >
      <div className={`p-2.5 rounded-xl ${color} text-white`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-900 leading-tight">
          {isLoading ? "…" : value}
        </div>
      </div>
      <ChevronRight
        size={16}
        className="text-slate-300 group-hover:text-slate-500 transition"
      />
    </Link>
  );

  const eventHref = (e: CalendarEvent): string => {
    const extra = (e.extra || {}) as Record<string, unknown>;
    const internshipId = extra.internship_id as number | undefined;
    const selectionId = extra.selection_id as number | undefined;

    if (internshipId) {
      return `/internships?edit=${internshipId}`;
    }
    if (selectionId) {
      // step events within a selection: scroll to the step after expanding
      if (e.kind === "step" && e.ref_id) {
        return `/selections?step=${e.ref_id}`;
      }
      return `/selections?edit=${selectionId}`;
    }
    // fallback based on kind
    if (
      e.kind === "intern_deadline" ||
      e.kind === "intern_period" ||
      e.kind === "intern_briefing"
    ) {
      return `/internships?edit=${e.ref_id}`;
    }
    if (
      e.kind === "selection_deadline" ||
      e.kind === "offer_deadline" ||
      e.kind === "result"
    ) {
      return `/selections?edit=${e.ref_id}`;
    }
    return `/companies#company-${e.company_id}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">
            {user?.display_name || user?.first_name}さん、こんにちは 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            今日のスケジュールとサマリーを確認しましょう
          </p>
        </div>
        <button
          onClick={() => setAiPickerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-medium shadow-md hover:shadow-lg active:scale-[0.98] transition"
        >
          <Sparkles size={16} />
          AI取り込み
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatLink
          to="/selections"
          icon={Briefcase}
          label="本選考中"
          value={data?.active_selections ?? 0}
          color="bg-primary-600"
        />
        <StatLink
          to="/selections"
          icon={Trophy}
          label="内定"
          value={data?.offers ?? 0}
          color="bg-emerald-600"
        />
        <StatLink
          to="/internships"
          icon={GraduationCap}
          label="インターン"
          value={data?.total_internships ?? 0}
          color="bg-amber-500"
        />
        <StatLink
          to="/companies"
          icon={Building2}
          label="登録企業"
          value={data?.total_companies ?? 0}
          color="bg-violet-600"
        />
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary-600" />
            <h2 className="font-semibold">直近7日の予定</h2>
          </div>
          <Link
            to="/calendar"
            className="text-xs text-primary-600 hover:underline"
          >
            カレンダーを開く →
          </Link>
        </div>
        {isLoading ? (
          <div className="text-sm text-slate-400 py-6 text-center">
            読み込み中...
          </div>
        ) : data && data.upcoming_events.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {data.upcoming_events.slice(0, 10).map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => setSelectedEvent(e)}
                  className="w-full py-2.5 flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition text-left"
                >
                  <div
                    className="w-2.5 h-10 rounded-full shrink-0"
                    style={{ background: e.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {e.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateShort(e.start)}
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-slate-400 py-6 text-center">
            直近の予定はありません
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Link
          to="/internships"
          className="card p-5 hover:shadow-md transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="text-amber-500" size={18} />
            <span className="font-semibold">インターン情報を管理</span>
          </div>
          <p className="text-xs text-slate-500">
            エントリー締切・期間・オンライン情報をまとめて管理
          </p>
        </Link>
        <Link
          to="/selections"
          className="card p-5 hover:shadow-md transition group"
        >
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="text-primary-600" size={18} />
            <span className="font-semibold">本選考を進める</span>
          </div>
          <p className="text-xs text-slate-500">
            選考ステップ、面接、提出物、内定情報を一元管理
          </p>
        </Link>
      </div>

      <EventDetailModal
        event={selectedEvent}
        company={
          selectedEvent ? companyById.get(selectedEvent.company_id) : undefined
        }
        onClose={() => setSelectedEvent(null)}
        onEdit={() => {
          if (!selectedEvent) return;
          const href = eventHref(selectedEvent);
          setSelectedEvent(null);
          navigate(href);
        }}
      />

      <Modal
        open={aiPickerOpen}
        onClose={() => setAiPickerOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500" />
            AIで予定を取り込み
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            登録先を選んでください。あとから変更もできます。
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => openAi("internship_step")}
              className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition text-left"
            >
              <GraduationCap size={20} className="text-amber-600" />
              <div>
                <div className="font-medium text-slate-900">インターン情報として登録</div>
                <div className="text-xs text-slate-500">
                  インターンの説明会・選考ステップ
                </div>
              </div>
            </button>
            <button
              onClick={() => openAi("selection_step")}
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition text-left"
            >
              <Briefcase size={20} className="text-blue-600" />
              <div>
                <div className="font-medium text-slate-900">本選考情報として登録</div>
                <div className="text-xs text-slate-500">
                  本選考の説明会・選考ステップ
                </div>
              </div>
            </button>
            <button
              onClick={() => openAi("company_only")}
              className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition text-left"
            >
              <Building2 size={20} className="text-violet-600" />
              <div>
                <div className="font-medium text-slate-900">企業情報のみ登録</div>
                <div className="text-xs text-slate-500">
                  マイページURL・ID等を企業として保存（予定なし）
                </div>
              </div>
            </button>
            <button
              onClick={() => openAi(undefined)}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition text-left"
            >
              <Sparkles size={20} className="text-slate-500" />
              <div>
                <div className="font-medium text-slate-900">AIにおまかせ</div>
                <div className="text-xs text-slate-500">
                  内容から自動で判別
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      <AIImportModal
        key={String(aiTarget) + String(aiOpen)}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        initialTargetKind={aiTarget}
      />
    </div>
  );
}

const KIND_LABELS: Record<CalendarEvent["kind"], string> = {
  intern_period: "インターン",
  intern_deadline: "エントリー締切",
  intern_briefing: "インターン説明会",
  selection_deadline: "本選考締切",
  step: "選考ステップ",
  offer_deadline: "内定承諾期限",
  result: "結果発表",
};

function EventDetailModal({
  event,
  company,
  onClose,
  onEdit,
}: {
  event: CalendarEvent | null;
  company?: Company;
  onClose: () => void;
  onEdit: () => void;
}) {
  if (!event) return null;
  const extra = (event.extra || {}) as Record<string, unknown>;
  const startTime = (extra.start_time || extra.time) as string | undefined;
  const endTime = extra.end_time as string | undefined;
  const mode = extra.mode as string | undefined;
  const onlineUrl = extra.online_url as string | undefined;
  const location = extra.location as string | undefined;
  const meetingCode = extra.meeting_code as string | undefined;
  const meetingPassword = extra.meeting_password as string | undefined;

  let dateText = formatDate(event.start);
  if (event.end) {
    // fullcalendar end is exclusive; subtract 1 day
    const endD = new Date(event.end);
    endD.setDate(endD.getDate() - 1);
    const endStr = endD.toISOString().slice(0, 10);
    if (endStr !== event.start) {
      dateText = `${formatDate(event.start)} 〜 ${formatDate(endStr)}`;
    }
  }
  const timeText =
    startTime && endTime
      ? `${startTime} 〜 ${endTime}`
      : startTime
      ? startTime
      : "";

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="予定の詳細"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            閉じる
          </button>
          <button className="btn-primary" onClick={onEdit}>
            <Pencil size={14} /> 編集
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className="w-1.5 self-stretch rounded-full shrink-0"
            style={{ background: event.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-slate-900 break-words">
              {event.title}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {KIND_LABELS[event.kind] || event.kind}
              {company ? ` / ${company.name}` : ""}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-slate-700">
          <div className="flex items-center gap-1.5">
            <CalendarIcon size={14} className="text-slate-400" />
            {dateText}
          </div>
          {timeText && (
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" />
              {timeText}
            </div>
          )}
          {mode && (
            <div className="flex items-center gap-1.5">
              {mode === "online" ? (
                <Video size={14} className="text-slate-400" />
              ) : (
                <MapPin size={14} className="text-slate-400" />
              )}
              {mode === "online" ? "オンライン" : "対面"}
              {location ? ` / ${location}` : ""}
            </div>
          )}
          {!mode && location && (
            <div className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" />
              {location}
            </div>
          )}
          {onlineUrl && (
            <a
              href={onlineUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-primary-600 hover:underline break-all"
            >
              <Globe size={14} /> {onlineUrl}
            </a>
          )}
          {meetingCode && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <KeyRound size={14} className="text-slate-400" />
              ID: <span className="font-mono">{meetingCode}</span>
            </div>
          )}
          {meetingPassword && (
            <div className="flex items-center gap-1.5 text-slate-700">
              <KeyRound size={14} className="text-slate-400" />
              PW: <span className="font-mono">{meetingPassword}</span>
            </div>
          )}
        </div>

        {company?.mypage_url && (
          <a
            href={company.mypage_url}
            target="_blank"
            rel="noreferrer"
            className="btn-outline !py-1.5 !px-3 text-sm inline-flex"
          >
            <Globe size={14} /> {company.name} のマイページを開く
          </a>
        )}
      </div>
    </Modal>
  );
}
