import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ExternalLink,
  Globe,
  KeyRound,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Video,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  addInternshipSession,
  addInternshipStep,
  createInternship,
  deleteInternship,
  deleteInternshipSession,
  deleteInternshipStep,
  listCompanies,
  listInternships,
  reorderInternships,
  updateInternship,
  updateInternshipSession,
  updateInternshipStep,
} from "../api/endpoints";
import type {
  Internship,
  InternshipInput,
  InternshipSessionInput,
  InternshipStepInput,
} from "../api/types";
import AIImportModal from "../components/AIImportModal";
import CompanyQuickCreate from "../components/CompanyQuickCreate";
import ConfirmDialog from "../components/ConfirmDialog";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { SortableList } from "../components/SortableList";
import {
  INTERN_MODE_LABELS,
  INTERN_STATUS_LABELS,
  STEP_RESULT_LABELS,
  STEP_TYPE_LABELS,
} from "../lib/constants";
import { contrastText, formatDate } from "../lib/utils";
import { useSearchParams } from "react-router-dom";

const EMPTY = (companyId?: number): InternshipInput => ({
  company_id: companyId || 0,
  title: "",
  entry_deadline: null,
  entry_deadline_time: null,
  start_date: null,
  start_time: null,
  end_date: null,
  end_time: null,
  mode: "offline",
  online_url: "",
  meeting_code: "",
  meeting_password: "",
  related_url: "",
  memo: "",
  briefing_date: null,
  briefing_time: null,
  status: "not_applied",
});

export default function InternshipsPage() {
  const qc = useQueryClient();
  const { data: interns = [], isLoading } = useQuery({
    queryKey: ["internships"],
    queryFn: listInternships,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });

  const companyById = new Map(companies.map((c) => [c.id, c]));

  const [editing, setEditing] = useState<Internship | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [toDelete, setToDelete] = useState<Internship | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Open edit modal when ?edit=<id> is set
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    const target = interns.find((x) => x.id === Number(editId));
    if (target) {
      setEditing(target);
      // clear the param so refreshing the page doesn't reopen it
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  }, [interns, searchParams, setSearchParams]);
  const [stepTarget, setStepTarget] = useState<{
    internshipId: number;
    stepId: number | null;
    initial: InternshipStepInput;
  } | null>(null);
  const [sessionTarget, setSessionTarget] = useState<{
    internshipId: number;
    sessionId: number | null;
    initial: InternshipSessionInput;
  } | null>(null);

  const stepCreate = useMutation({
    mutationFn: ({
      internshipId,
      data,
    }: {
      internshipId: number;
      data: InternshipStepInput;
    }) => addInternshipStep(internshipId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("追加しました");
      setStepTarget(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "追加に失敗しました"),
  });
  const stepUpdate = useMutation({
    mutationFn: ({
      internshipId,
      stepId,
      data,
    }: {
      internshipId: number;
      stepId: number;
      data: Partial<InternshipStepInput>;
    }) => updateInternshipStep(internshipId, stepId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("更新しました");
      setStepTarget(null);
    },
  });
  const stepRemove = useMutation({
    mutationFn: ({
      internshipId,
      stepId,
    }: {
      internshipId: number;
      stepId: number;
    }) => deleteInternshipStep(internshipId, stepId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("削除しました");
    },
  });

  const sessionCreate = useMutation({
    mutationFn: ({
      internshipId,
      data,
    }: {
      internshipId: number;
      data: InternshipSessionInput;
    }) => addInternshipSession(internshipId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("日程を追加しました");
      setSessionTarget(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "追加に失敗しました"),
  });
  const sessionUpdate = useMutation({
    mutationFn: ({
      internshipId,
      sessionId,
      data,
    }: {
      internshipId: number;
      sessionId: number;
      data: Partial<InternshipSessionInput>;
    }) => updateInternshipSession(internshipId, sessionId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("更新しました");
      setSessionTarget(null);
    },
  });
  const sessionRemove = useMutation({
    mutationFn: ({
      internshipId,
      sessionId,
    }: {
      internshipId: number;
      sessionId: number;
    }) => deleteInternshipSession(internshipId, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("削除しました");
    },
  });

  const create = useMutation({
    mutationFn: createInternship,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("追加しました");
      setCreating(false);
    },
    onError: () => toast.error("追加に失敗しました"),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<InternshipInput>;
    }) => updateInternship(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("更新しました");
      setEditing(null);
    },
  });
  const reorder = useMutation({
    mutationFn: reorderInternships,
    onMutate: async (ids: number[]) => {
      await qc.cancelQueries({ queryKey: ["internships"] });
      const prev = qc.getQueryData<Internship[]>(["internships"]);
      if (prev) {
        const map = new Map(prev.map((x) => [x.id, x]));
        const reordered = ids
          .map((id) => map.get(id))
          .filter((x): x is Internship => !!x);
        const others = prev.filter((x) => !ids.includes(x.id));
        qc.setQueryData<Internship[]>(["internships"], [...reordered, ...others]);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["internships"], ctx.prev);
      toast.error("並び替えの保存に失敗しました");
    },
  });

  const remove = useMutation({
    mutationFn: deleteInternship,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("削除しました");
      setToDelete(null);
    },
    onError: (e: any) => {
      console.error("delete internship failed", e);
      toast.error(e?.response?.data?.detail ?? "削除に失敗しました");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">インターン</h1>
          <p className="text-sm text-slate-500">
            エントリー締切・期間・オンライン情報を管理
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 rounded-lg text-sm bg-violet-600 text-white flex items-center gap-1 shadow-sm hover:bg-violet-700"
            onClick={() => setAiImporting(true)}
            title="メールやスクショから自動取り込み"
          >
            <Sparkles size={14} /> AI取り込み
          </button>
          <button
            className="btn-primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={16} /> 新規追加
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400 py-6 text-center">
          読み込み中...
        </div>
      ) : interns.length === 0 ? (
        <div className="card p-10 text-center text-slate-500 text-sm">
          インターン情報がまだありません
        </div>
      ) : (
        <>
          {interns.length > 1 && (
            <p className="text-[11px] text-slate-400">
              ⚡ 長押ししてドラッグすると並び替えられます
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <SortableList
              items={interns}
              onReorder={(ids) => reorder.mutate(ids)}
              renderItem={(i, handle) => {
                const c = companyById.get(i.company_id);
                return (
              <div className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {handle}
                    <div
                      className="w-2 h-12 rounded-full shrink-0 mt-0.5"
                      style={{ background: c?.color || "#94a3b8" }}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {c?.name || "?"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {i.title || "（タイトルなし）"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <span
                      className="badge"
                      style={{
                        background: c?.color,
                        color: c ? contrastText(c.color) : "#fff",
                      }}
                    >
                      {INTERN_STATUS_LABELS[i.status]}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {(i.start_date || i.end_date) && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      期間: {formatDate(i.start_date)}
                      {i.start_time ? ` ${i.start_time}` : ""} 〜{" "}
                      {formatDate(i.end_date || i.start_date)}
                      {i.end_time ? ` ${i.end_time}` : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {i.mode === "online" ? (
                      <Video size={12} />
                    ) : (
                      <MapPin size={12} />
                    )}
                    {INTERN_MODE_LABELS[i.mode]}
                  </div>
                </div>

                {/* Additional sessions (複数日程) */}
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-500">
                      追加日程
                    </div>
                    <button
                      className="btn-outline !py-0.5 !px-1.5 text-[11px]"
                      onClick={() =>
                        setSessionTarget({
                          internshipId: i.id,
                          sessionId: null,
                          initial: {
                            label: null,
                            order_index: (i.sessions || []).length,
                            start_date: null,
                            start_time: null,
                            end_date: null,
                            end_time: null,
                            mode: i.mode === "online" ? "online" : "offline",
                            location: null,
                            online_url: null,
                            meeting_code: null,
                            meeting_password: null,
                            memo: null,
                          },
                        })
                      }
                    >
                      <Plus size={10} /> 日程追加
                    </button>
                  </div>
                  {(i.sessions || []).length > 0 && (
                    <div className="mt-1 space-y-1">
                      {i.sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px] flex items-start gap-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-700">
                              {sess.label || "日程"}
                            </div>
                            {sess.start_date && (
                              <div className="text-slate-600 flex items-center gap-0.5 mt-0.5">
                                <Calendar size={10} />
                                {formatDate(sess.start_date)}
                                {sess.start_time ? ` ${sess.start_time}` : ""}
                                {(sess.end_date &&
                                  sess.end_date !== sess.start_date) ||
                                sess.end_time
                                  ? ` 〜 ${
                                      sess.end_date
                                        ? formatDate(sess.end_date)
                                        : ""
                                    }${sess.end_time ? ` ${sess.end_time}` : ""}`
                                  : ""}
                              </div>
                            )}
                            {sess.mode && (
                              <div className="text-slate-500 flex items-center gap-0.5 mt-0.5">
                                {sess.mode === "online" ? (
                                  <Video size={10} />
                                ) : (
                                  <MapPin size={10} />
                                )}
                                {sess.mode === "online" ? "オンライン" : "対面"}
                                {sess.location ? ` / ${sess.location}` : ""}
                              </div>
                            )}
                            {sess.mode === "online" && sess.online_url && (
                              <a
                                href={sess.online_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 flex items-center gap-0.5 text-primary-600 hover:underline break-all"
                              >
                                <Video size={10} /> {sess.online_url}
                              </a>
                            )}
                            {sess.mode === "online" && sess.meeting_code && (
                              <div className="text-slate-600">
                                <span className="text-slate-400">ID: </span>
                                {sess.meeting_code}
                              </div>
                            )}
                            {sess.mode === "online" &&
                              sess.meeting_password && (
                                <div className="text-slate-600">
                                  <span className="text-slate-400">PW: </span>
                                  {sess.meeting_password}
                                </div>
                              )}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button
                              className="btn-ghost !p-0.5"
                              onClick={() =>
                                setSessionTarget({
                                  internshipId: i.id,
                                  sessionId: sess.id,
                                  initial: {
                                    label: sess.label,
                                    order_index: sess.order_index,
                                    start_date: sess.start_date,
                                    start_time: sess.start_time,
                                    end_date: sess.end_date,
                                    end_time: sess.end_time,
                                    mode: sess.mode,
                                    location: sess.location,
                                    online_url: sess.online_url,
                                    meeting_code: sess.meeting_code,
                                    meeting_password: sess.meeting_password,
                                    memo: sess.memo,
                                  },
                                })
                              }
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              className="btn-ghost !p-0.5 text-rose-600"
                              onClick={() => {
                                if (confirm("削除してよろしいですか？"))
                                  sessionRemove.mutate({
                                    internshipId: i.id,
                                    sessionId: sess.id,
                                  });
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {i.mode === "online" && (i.online_url || i.meeting_code) && (
                  <div className="mt-2 p-2 rounded-lg bg-slate-50 text-xs space-y-1">
                    {i.online_url && (
                      <a
                        href={i.online_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-primary-600 hover:underline break-all"
                      >
                        <Globe size={12} /> ミーティングURL
                      </a>
                    )}
                    {i.meeting_code && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <KeyRound size={12} />
                        コード:{" "}
                        <span className="font-mono">{i.meeting_code}</span>
                      </div>
                    )}
                    {i.meeting_password && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <KeyRound size={12} />
                        パスワード:{" "}
                        <span className="font-mono">{i.meeting_password}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {c?.mypage_url && (
                    <a
                      href={c.mypage_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <Globe size={12} /> マイページ
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {c?.recruit_url && (
                    <a
                      href={c.recruit_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <LinkIcon size={12} /> 採用ページ
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {i.related_url && (
                    <a
                      href={i.related_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                    >
                      <LinkIcon size={12} /> 関連URL
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>

                {i.memo && (
                  <p className="mt-2 text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">
                    {i.memo}
                  </p>
                )}

                {/* Internship selection steps */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-slate-600">
                      インターン選考ステップ
                    </div>
                    <button
                      className="btn-outline !py-0.5 !px-1.5 text-[11px]"
                      onClick={() =>
                        setStepTarget({
                          internshipId: i.id,
                          stepId: null,
                          initial: {
                            step_type: "interview_1",
                            label: null,
                            order_index: (i.steps || []).length,
                            scheduled_date: null,
                            scheduled_time: null,
                            start_date: null,
                            start_time: null,
                            location: null,
                            mode: null,
                            online_url: null,
                            meeting_code: null,
                            meeting_password: null,
                            result: "pending",
                            memo: null,
                          },
                        })
                      }
                    >
                      <Plus size={10} /> 追加
                    </button>
                  </div>
                  {(!i.steps || i.steps.length === 0) ? (
                    <div className="text-[11px] text-slate-400">
                      ステップがありません
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {i.steps.map((st) => (
                        <div
                          key={st.id}
                          className="p-1.5 bg-slate-50 rounded border border-slate-200 text-xs flex items-start gap-1.5"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">
                                {st.label ||
                                  STEP_TYPE_LABELS[st.step_type] ||
                                  st.step_type}
                              </span>
                              <span
                                className={`text-[10px] px-1 rounded ${
                                  st.result === "passed"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : st.result === "failed"
                                    ? "bg-rose-100 text-rose-700"
                                    : st.result === "skipped"
                                    ? "bg-slate-200 text-slate-600"
                                    : st.result === "waiting"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {STEP_RESULT_LABELS[st.result] || st.result}
                              </span>
                            </div>
                            {st.scheduled_date && (
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-0.5">
                                <Calendar size={10} />
                                {st.start_date ? (
                                  <>
                                    {formatDate(st.start_date)}
                                    {st.start_time && ` ${st.start_time}`}
                                    {" 〜 締切 "}
                                    {formatDate(st.scheduled_date)}
                                    {st.scheduled_time && ` ${st.scheduled_time}`}
                                  </>
                                ) : (
                                  <>
                                    {(st.step_type === "es" || st.step_type === "aptitude") && "締切 "}
                                    {formatDate(st.scheduled_date)}
                                    {st.scheduled_time && ` ${st.scheduled_time}`}
                                  </>
                                )}
                              </div>
                            )}
                            {st.mode === "online" &&
                              (st.online_url ||
                                st.meeting_code ||
                                st.meeting_password) && (
                                <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                                  {st.online_url && (
                                    <a
                                      href={st.online_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-0.5 text-primary-600 hover:underline break-all"
                                    >
                                      <Video size={10} />
                                      {st.online_url}
                                    </a>
                                  )}
                                  {st.meeting_code && (
                                    <div>
                                      <span className="text-slate-400">
                                        ID:{" "}
                                      </span>
                                      {st.meeting_code}
                                    </div>
                                  )}
                                  {st.meeting_password && (
                                    <div>
                                      <span className="text-slate-400">
                                        PW:{" "}
                                      </span>
                                      {st.meeting_password}
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button
                              className="btn-ghost !p-0.5"
                              onClick={() =>
                                setStepTarget({
                                  internshipId: i.id,
                                  stepId: st.id,
                                  initial: {
                                    step_type: st.step_type,
                                    label: st.label,
                                    order_index: st.order_index,
                                    scheduled_date: st.scheduled_date,
                                    scheduled_time: st.scheduled_time,
                                    start_date: st.start_date,
                                    start_time: st.start_time,
                                    location: st.location,
                                    mode: st.mode,
                                    online_url: st.online_url,
                                    meeting_code: st.meeting_code,
                                    meeting_password: st.meeting_password,
                                    result: st.result,
                                    memo: st.memo,
                                  },
                                })
                              }
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              className="btn-ghost !p-0.5 text-rose-600"
                              onClick={() => {
                                if (confirm("削除してよろしいですか？"))
                                  stepRemove.mutate({
                                    internshipId: i.id,
                                    stepId: st.id,
                                  });
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end gap-1">
                  <button
                    className="btn-ghost !px-2 !py-1"
                    onClick={() => setEditing(i)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-rose-600"
                    onClick={() => setToDelete(i)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
              }}
            />
          </div>
        </>
      )}

      <AIImportModal open={aiImporting} onClose={() => setAiImporting(false)} />
      <InternshipFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(d) => create.mutate(d)}
        loading={create.isPending}
      />
      <InternshipFormModal
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(d) => editing && update.mutate({ id: editing.id, data: d })}
        loading={update.isPending}
      />
      <InternshipStepFormModal
        open={!!stepTarget}
        initial={stepTarget?.initial}
        onClose={() => setStepTarget(null)}
        onSubmit={(d) => {
          if (!stepTarget) return;
          if (stepTarget.stepId == null) {
            stepCreate.mutate({
              internshipId: stepTarget.internshipId,
              data: d,
            });
          } else {
            stepUpdate.mutate({
              internshipId: stepTarget.internshipId,
              stepId: stepTarget.stepId,
              data: d,
            });
          }
        }}
        loading={stepCreate.isPending || stepUpdate.isPending}
        mypageUrl={
          stepTarget
            ? companyById.get(
                interns.find((i) => i.id === stepTarget.internshipId)
                  ?.company_id ?? 0
              )?.mypage_url
            : null
        }
        companyName={
          stepTarget
            ? companyById.get(
                interns.find((i) => i.id === stepTarget.internshipId)
                  ?.company_id ?? 0
              )?.name
            : undefined
        }
      />
      <InternshipSessionFormModal
        open={!!sessionTarget}
        initial={sessionTarget?.initial}
        onClose={() => setSessionTarget(null)}
        mypageUrl={
          sessionTarget
            ? companyById.get(
                interns.find((i) => i.id === sessionTarget.internshipId)
                  ?.company_id ?? 0
              )?.mypage_url
            : null
        }
        companyName={
          sessionTarget
            ? companyById.get(
                interns.find((i) => i.id === sessionTarget.internshipId)
                  ?.company_id ?? 0
              )?.name
            : undefined
        }
        onSubmit={(d) => {
          if (!sessionTarget) return;
          if (sessionTarget.sessionId == null) {
            sessionCreate.mutate({
              internshipId: sessionTarget.internshipId,
              data: d,
            });
          } else {
            sessionUpdate.mutate({
              internshipId: sessionTarget.internshipId,
              sessionId: sessionTarget.sessionId,
              data: d,
            });
          }
        }}
        loading={sessionCreate.isPending || sessionUpdate.isPending}
      />
      <ConfirmDialog
        open={!!toDelete}
        danger
        title="インターンを削除"
        message={
          toDelete
            ? `「${companyById.get(toDelete.company_id)?.name ?? "?"} / ${
                toDelete.title || "（タイトルなし）"
              }」を削除します。よろしいですか？`
            : ""
        }
        confirmLabel="削除する"
        loading={remove.isPending}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function InternshipFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  initial?: Internship;
  onClose: () => void;
  onSubmit: (data: InternshipInput) => void;
  loading?: boolean;
}) {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
  const [form, setForm] = useState<InternshipInput>(EMPTY());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        company_id: initial.company_id,
        title: initial.title || "",
        entry_deadline: initial.entry_deadline,
        entry_deadline_time: initial.entry_deadline_time,
        start_date: initial.start_date,
        start_time: initial.start_time,
        end_date: initial.end_date,
        end_time: initial.end_time,
        mode: initial.mode,
        online_url: initial.online_url || "",
        meeting_code: initial.meeting_code || "",
        meeting_password: initial.meeting_password || "",
        related_url: initial.related_url || "",
        memo: initial.memo || "",
        briefing_date: initial.briefing_date,
        briefing_time: initial.briefing_time,
        status: initial.status,
      });
    } else {
      setForm(EMPTY(companies[0]?.id));
    }
  }, [open, initial, companies]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.company_id) {
      toast.error("企業を選択してください");
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "インターンを編集" : "インターンを追加"}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {(() => {
          const selCo = companies.find((c) => c.id === form.company_id);
          return selCo?.mypage_url ? (
            <a
              href={selCo.mypage_url}
              target="_blank"
              rel="noreferrer"
              className="btn-outline !py-1.5 !px-3 text-sm inline-flex w-full md:w-auto justify-center"
            >
              <Globe size={14} /> {selCo.name} のマイページを開く
            </a>
          ) : null;
        })()}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="企業" required>
            <div className="flex gap-2">
              <select
                className="input flex-1"
                value={form.company_id || ""}
                onChange={(e) =>
                  setForm({ ...form, company_id: Number(e.target.value) })
                }
              >
                <option value="">-- 企業を選択 --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-outline whitespace-nowrap"
                onClick={() => setQuickCreateOpen(true)}
                title="新規企業を追加"
              >
                <Plus size={14} /> 新規
              </button>
            </div>
          </Field>
          <Field label="タイトル">
            <input
              className="input"
              value={form.title || ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例: サマーインターン5days"
            />
          </Field>
          <Field label="ステータス">
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as InternshipInput["status"],
                })
              }
            >
              {Object.entries(INTERN_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="開始日時">
            <div className="flex gap-2">
              <input
                type="date"
                className="input flex-1"
                value={form.start_date || ""}
                onChange={(e) =>
                  setForm({ ...form, start_date: e.target.value || null })
                }
              />
              <input
                type="time"
                className="input w-28"
                value={form.start_time || ""}
                onChange={(e) =>
                  setForm({ ...form, start_time: e.target.value || null })
                }
              />
            </div>
          </Field>
          <Field label="終了日時">
            <div className="flex gap-2">
              <input
                type="date"
                className="input flex-1"
                value={form.end_date || ""}
                onChange={(e) =>
                  setForm({ ...form, end_date: e.target.value || null })
                }
              />
              <input
                type="time"
                className="input w-28"
                value={form.end_time || ""}
                onChange={(e) =>
                  setForm({ ...form, end_time: e.target.value || null })
                }
              />
            </div>
          </Field>
          <Field label="形式">
            <select
              className="input"
              value={form.mode}
              onChange={(e) =>
                setForm({
                  ...form,
                  mode: e.target.value as InternshipInput["mode"],
                })
              }
            >
              {Object.entries(INTERN_MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="関連URL" hint="募集要項など">
            <input
              className="input"
              value={form.related_url || ""}
              onChange={(e) =>
                setForm({ ...form, related_url: e.target.value })
              }
              placeholder="https://..."
            />
          </Field>
        </div>

        {form.mode !== "offline" && (
          <div className="p-3 rounded-lg bg-slate-50 space-y-3">
            <div className="text-xs font-semibold text-slate-600">
              オンライン情報
            </div>
            <Field label="ミーティングURL">
              <input
                className="input"
                value={form.online_url || ""}
                onChange={(e) =>
                  setForm({ ...form, online_url: e.target.value })
                }
                placeholder="https://zoom.us/j/..."
              />
            </Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="ミーティングコード">
                <input
                  className="input"
                  value={form.meeting_code || ""}
                  onChange={(e) =>
                    setForm({ ...form, meeting_code: e.target.value })
                  }
                />
              </Field>
              <Field label="パスワード">
                <input
                  className="input"
                  value={form.meeting_password || ""}
                  onChange={(e) =>
                    setForm({ ...form, meeting_password: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>
        )}

        <Field label="メモ">
          <textarea
            className="input min-h-[80px]"
            value={form.memo || ""}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
          />
        </Field>
      </form>
      <CompanyQuickCreate
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={(c) => setForm((f) => ({ ...f, company_id: c.id }))}
      />
    </Modal>
  );
}

function InternshipStepFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
  mypageUrl,
  companyName,
}: {
  open: boolean;
  initial?: InternshipStepInput;
  onClose: () => void;
  onSubmit: (d: InternshipStepInput) => void;
  loading?: boolean;
  mypageUrl?: string | null;
  companyName?: string;
}) {
  const defaultStep: InternshipStepInput = {
    step_type: "interview_1",
    label: null,
    order_index: 0,
    scheduled_date: null,
    scheduled_time: null,
    start_date: null,
    start_time: null,
    location: null,
    mode: null,
    online_url: null,
    meeting_code: null,
    meeting_password: null,
    result: "pending",
    memo: null,
  };
  const [form, setForm] = useState<InternshipStepInput>(defaultStep);
  const [periodMode, setPeriodMode] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = initial || defaultStep;
    setForm(next);
    setPeriodMode(!!next.start_date);
     
  }, [open, initial]);

  const isEsOrApt = form.step_type === "es" || form.step_type === "aptitude";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="インターン選考ステップ"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit(form)}
            disabled={loading}
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {mypageUrl && (
          <a
            href={mypageUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-outline !py-1.5 !px-3 text-sm inline-flex w-full md:w-auto justify-center"
          >
            <Globe size={14} /> {companyName ? `${companyName} の` : ""}マイページを開く
          </a>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="種類">
            <select
              className="input"
              value={form.step_type}
              onChange={(e) =>
                setForm({ ...form, step_type: e.target.value as never })
              }
            >
              {Object.entries(STEP_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ラベル（任意）">
            <input
              className="input"
              value={form.label || ""}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="例: 人事面接"
            />
          </Field>
          {isEsOrApt && (
            <div className="col-span-2 flex items-center gap-2">
              <label className="text-xs text-slate-500 inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={periodMode}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setPeriodMode(on);
                    if (!on) {
                      setForm((f) => ({ ...f, start_date: null, start_time: null }));
                    }
                  }}
                />
                期間モード（開始日と締切日を分けて入力）
              </label>
            </div>
          )}
          {isEsOrApt && periodMode && (
            <>
              <Field label="開始日">
                <input
                  type="date"
                  className="input"
                  value={form.start_date || ""}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value || null })
                  }
                />
              </Field>
              <Field label="開始時刻">
                <input
                  type="time"
                  className="input"
                  value={form.start_time || ""}
                  onChange={(e) =>
                    setForm({ ...form, start_time: e.target.value || null })
                  }
                />
              </Field>
            </>
          )}
          <Field label={isEsOrApt ? "締切日" : "日付"}>
            <input
              type="date"
              className="input"
              value={form.scheduled_date || ""}
              onChange={(e) =>
                setForm({ ...form, scheduled_date: e.target.value || null })
              }
            />
          </Field>
          <Field label={isEsOrApt ? "締切時刻" : "時間"}>
            <input
              type="time"
              className="input"
              value={form.scheduled_time || ""}
              onChange={(e) =>
                setForm({ ...form, scheduled_time: e.target.value || null })
              }
            />
          </Field>
          <Field label="形式">
            <select
              className="input"
              value={form.mode || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  mode: (e.target.value || null) as InternshipStepInput["mode"],
                })
              }
            >
              <option value="">-</option>
              <option value="online">オンライン</option>
              <option value="offline">対面</option>
            </select>
          </Field>
          <Field label="結果">
            <select
              className="input"
              value={form.result}
              onChange={(e) =>
                setForm({
                  ...form,
                  result: e.target.value as InternshipStepInput["result"],
                })
              }
            >
              {Object.entries(STEP_RESULT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="場所" hint="対面時の住所など">
            <input
              className="input"
              value={form.location || ""}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="オンラインURL" hint="Zoom等">
            <input
              className="input"
              value={form.online_url || ""}
              onChange={(e) =>
                setForm({ ...form, online_url: e.target.value })
              }
              placeholder="https://..."
            />
          </Field>
          {form.mode === "online" && (
            <>
              <Field label="会議コード" hint="ミーティングIDなど">
                <input
                  className="input"
                  value={form.meeting_code || ""}
                  onChange={(e) =>
                    setForm({ ...form, meeting_code: e.target.value })
                  }
                  placeholder="例: 123 456 7890"
                />
              </Field>
              <Field label="パスワード">
                <input
                  className="input"
                  value={form.meeting_password || ""}
                  onChange={(e) =>
                    setForm({ ...form, meeting_password: e.target.value })
                  }
                  placeholder="例: abc123"
                />
              </Field>
            </>
          )}
        </div>
        <Field label="メモ">
          <textarea
            className="input min-h-[60px]"
            value={form.memo || ""}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function InternshipSessionFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
  mypageUrl,
  companyName,
}: {
  open: boolean;
  initial?: InternshipSessionInput;
  onClose: () => void;
  onSubmit: (d: InternshipSessionInput) => void;
  loading?: boolean;
  mypageUrl?: string | null;
  companyName?: string;
}) {
  const defaultSess: InternshipSessionInput = {
    label: null,
    order_index: 0,
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
    mode: "offline",
    location: null,
    online_url: null,
    meeting_code: null,
    meeting_password: null,
    memo: null,
  };
  const [form, setForm] = useState<InternshipSessionInput>(defaultSess);

  useEffect(() => {
    if (!open) return;
    setForm(initial || defaultSess);
     
  }, [open, initial]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="インターン日程"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={() => onSubmit(form)}
            disabled={loading}
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {mypageUrl && (
          <a
            href={mypageUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-outline !py-1.5 !px-3 text-sm inline-flex w-full md:w-auto justify-center"
          >
            <Globe size={14} /> {companyName ? `${companyName} の` : ""}マイページを開く
          </a>
        )}
        <Field label="ラベル（任意）" hint="例: Day1, 第1回">
          <input
            className="input"
            value={form.label || ""}
            onChange={(e) => setForm({ ...form, label: e.target.value || null })}
            placeholder="例: Day1"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始日">
            <input
              type="date"
              className="input"
              value={form.start_date || ""}
              onChange={(e) =>
                setForm({ ...form, start_date: e.target.value || null })
              }
            />
          </Field>
          <Field label="開始時間">
            <input
              type="time"
              className="input"
              value={form.start_time || ""}
              onChange={(e) =>
                setForm({ ...form, start_time: e.target.value || null })
              }
            />
          </Field>
          <Field label="終了日">
            <input
              type="date"
              className="input"
              value={form.end_date || ""}
              onChange={(e) =>
                setForm({ ...form, end_date: e.target.value || null })
              }
            />
          </Field>
          <Field label="終了時間">
            <input
              type="time"
              className="input"
              value={form.end_time || ""}
              onChange={(e) =>
                setForm({ ...form, end_time: e.target.value || null })
              }
            />
          </Field>
          <Field label="形式">
            <select
              className="input"
              value={form.mode || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  mode: (e.target.value ||
                    null) as InternshipSessionInput["mode"],
                })
              }
            >
              <option value="">-</option>
              <option value="online">オンライン</option>
              <option value="offline">対面</option>
            </select>
          </Field>
          <Field label="場所" hint="対面時の住所など">
            <input
              className="input"
              value={form.location || ""}
              onChange={(e) =>
                setForm({ ...form, location: e.target.value || null })
              }
            />
          </Field>
        </div>
        {form.mode === "online" && (
          <div className="space-y-3">
            <Field label="オンラインURL" hint="Zoom等">
              <input
                className="input"
                value={form.online_url || ""}
                onChange={(e) =>
                  setForm({ ...form, online_url: e.target.value || null })
                }
                placeholder="https://..."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="会議コード" hint="ミーティングIDなど">
                <input
                  className="input"
                  value={form.meeting_code || ""}
                  onChange={(e) =>
                    setForm({ ...form, meeting_code: e.target.value || null })
                  }
                  placeholder="例: 123 456 7890"
                />
              </Field>
              <Field label="パスワード">
                <input
                  className="input"
                  value={form.meeting_password || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      meeting_password: e.target.value || null,
                    })
                  }
                  placeholder="例: abc123"
                />
              </Field>
            </div>
          </div>
        )}
        <Field label="メモ">
          <textarea
            className="input min-h-[60px]"
            value={form.memo || ""}
            onChange={(e) =>
              setForm({ ...form, memo: e.target.value || null })
            }
          />
        </Field>
      </div>
    </Modal>
  );
}
