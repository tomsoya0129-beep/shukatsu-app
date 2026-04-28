import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  Gift,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Video,
  Globe,
  Link as LinkIcon,
  FileText,
  Check,
  Trophy,
  Sparkles,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  addStep,
  addSubmission,
  createSelection,
  deleteSelection,
  deleteStep,
  deleteSubmission,
  listCompanies,
  listSelections,
  reorderSelections,
  updateSelection,
  updateStep,
  updateSubmission,
} from "../api/endpoints";
import type {
  Selection,
  SelectionInput,
  SelectionStepInput,
  SubmissionInput,
} from "../api/types";
import AIImportModal from "../components/AIImportModal";
import CompanyQuickCreate from "../components/CompanyQuickCreate";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { SortableList } from "../components/SortableList";
import {
  DOC_TYPE_LABELS,
  SELECTION_STATUS_BADGE,
  SELECTION_STATUS_LABELS,
  STEP_RESULT_LABELS,
  STEP_TYPE_LABELS,
} from "../lib/constants";
import { contrastText, formatDate } from "../lib/utils";

const EMPTY_SEL = (companyId?: number): SelectionInput => ({
  company_id: companyId || 0,
  title: "",
  result_announcement_date: null,
  overall_status: "in_progress",
  offer_deadline: null,
  offer_event_date: null,
  offer_salary: "",
  offer_location: "",
  memo: "",
});

export default function SelectionsPage() {
  const qc = useQueryClient();
  const { data: selections = [], isLoading } = useQuery({
    queryKey: ["selections"],
    queryFn: listSelections,
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const [creating, setCreating] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [editing, setEditing] = useState<Selection | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [quickStepFor, setQuickStepFor] = useState<Selection | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const editId = searchParams.get("edit");
    const stepId = searchParams.get("step");
    if (editId) {
      const target = selections.find((s) => String(s.id) === editId);
      if (target) {
        setEditing(target);
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
    } else if (stepId) {
      const target = selections.find((s) =>
        s.steps.some((st) => String(st.id) === stepId)
      );
      if (target) {
        setExpanded((prev) => ({ ...prev, [target.id]: true }));
        setTimeout(() => {
          const el = document.getElementById(`step-${stepId}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        const next = new URLSearchParams(searchParams);
        next.delete("step");
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, selections, setSearchParams]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["selections"] });
    qc.invalidateQueries({ queryKey: ["calendar-events"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const quickStepCreate = useMutation({
    mutationFn: ({
      selectionId,
      data,
    }: {
      selectionId: number;
      data: SelectionStepInput;
    }) => addStep(selectionId, data),
    onSuccess: () => {
      invalidate();
      toast.success("追加しました");
      setQuickStepFor(null);
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "追加に失敗しました"),
  });

  const create = useMutation({
    mutationFn: createSelection,
    onSuccess: () => {
      invalidate();
      toast.success("追加しました");
      setCreating(false);
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<SelectionInput>;
    }) => updateSelection(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("更新しました");
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: deleteSelection,
    onSuccess: () => {
      invalidate();
      toast.success("削除しました");
    },
  });
  const reorder = useMutation({
    mutationFn: reorderSelections,
    onMutate: async (ids: number[]) => {
      await qc.cancelQueries({ queryKey: ["selections"] });
      const prev = qc.getQueryData<Selection[]>(["selections"]);
      if (prev) {
        const map = new Map(prev.map((x) => [x.id, x]));
        const reordered = ids
          .map((id) => map.get(id))
          .filter((x): x is Selection => !!x);
        const others = prev.filter((x) => !ids.includes(x.id));
        qc.setQueryData<Selection[]>(["selections"], [...reordered, ...others]);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["selections"], ctx.prev);
      toast.error("並び替えの保存に失敗しました");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">本選考</h1>
          <p className="text-sm text-slate-500">
            選考ステップ、面接、提出物、内定情報を一元管理
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
      ) : selections.length === 0 && companies.length > 0 ? (
        <div className="card p-10 text-center text-slate-500 text-sm">
          選考情報がまだありません
        </div>
      ) : (
        <>
          {selections.length > 1 && (
            <p className="text-[11px] text-slate-400">
              ⚡ 長押ししてドラッグすると並び替えられます
            </p>
          )}
          <div className="space-y-3">
            <SortableList
              items={selections}
              onReorder={(ids) => reorder.mutate(ids)}
              renderItem={(s, handle) => {
                const c = companyById.get(s.company_id);
                const isOpen = expanded[s.id] ?? false;
                return (
              <div className="card">
                <div className="p-4 flex items-start gap-3">
                  {handle}
                  <div
                    className="w-1.5 self-stretch rounded-full shrink-0"
                    style={{ background: c?.color || "#94a3b8" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">
                            {c?.name || "?"}
                          </span>
                          <span
                            className={`badge ${
                              SELECTION_STATUS_BADGE[s.overall_status]
                            }`}
                          >
                            {SELECTION_STATUS_LABELS[s.overall_status]}
                          </span>
                        </div>
                        {s.title && (
                          <div className="text-xs text-slate-500 truncate">
                            {s.title}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          className="btn-ghost !px-2 !py-1"
                          onClick={() => setEditing(s)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-ghost !px-2 !py-1 text-rose-600"
                          onClick={() => {
                            if (confirm("削除してよろしいですか？"))
                              remove.mutate(s.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-3 gap-y-1 text-xs text-slate-600">
                      {s.result_announcement_date && (
                        <div className="flex items-center gap-1">
                          <Trophy size={11} />{" "}
                          発表 {formatDate(s.result_announcement_date)}
                        </div>
                      )}
                      {s.offer_deadline && (
                        <div className="flex items-center gap-1">
                          <Gift size={11} />{" "}
                          承諾期限 {formatDate(s.offer_deadline)}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <ClipboardCheck size={11} />
                        ステップ {s.steps.length} / 提出物{" "}
                        {s.submissions.length}
                      </div>
                    </div>

                    {(c?.mypage_url || c?.recruit_url) && (
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
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <button
                        className="text-xs text-primary-600 inline-flex items-center gap-0.5 hover:underline"
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [s.id]: !isOpen }))
                        }
                      >
                        {isOpen ? (
                          <>
                            <ChevronUp size={14} /> 詳細を閉じる
                          </>
                        ) : (
                          <>
                            <ChevronDown size={14} /> 詳細を開く
                          </>
                        )}
                      </button>
                      <button
                        className="btn-outline !py-1 !px-2 text-xs"
                        onClick={() => setQuickStepFor(s)}
                      >
                        <Plus size={12} /> ステップ追加
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <SelectionDetail selection={s} onChange={invalidate} />
                )}
              </div>
            );
              }}
            />
          </div>
        </>
      )}

      <AIImportModal open={aiImporting} onClose={() => setAiImporting(false)} />
      <SelectionFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(d) => create.mutate(d)}
        loading={create.isPending}
      />
      <SelectionFormModal
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(d) => editing && update.mutate({ id: editing.id, data: d })}
        loading={update.isPending}
      />
      <StepFormModal
        open={!!quickStepFor}
        initial={
          quickStepFor
            ? {
                step_type: "interview_1",
                label: null,
                order_index: quickStepFor.steps.length,
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
              }
            : undefined
        }
        onClose={() => setQuickStepFor(null)}
        onSubmit={(d) => {
          if (!quickStepFor) return;
          quickStepCreate.mutate({ selectionId: quickStepFor.id, data: d });
        }}
        loading={quickStepCreate.isPending}
        mypageUrl={
          quickStepFor
            ? companyById.get(quickStepFor.company_id)?.mypage_url
            : null
        }
        companyName={
          quickStepFor
            ? companyById.get(quickStepFor.company_id)?.name
            : undefined
        }
      />
    </div>
  );
}

function SelectionDetail({
  selection,
  onChange,
}: {
  selection: Selection;
  onChange: () => void;
}) {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
  const company = companies.find((c) => c.id === selection.company_id);
  const [stepOpen, setStepOpen] = useState<SelectionStepInput | null>(null);
  const [stepEditId, setStepEditId] = useState<number | null>(null);
  const [subOpen, setSubOpen] = useState<SubmissionInput | null>(null);
  const [subEditId, setSubEditId] = useState<number | null>(null);

  const stepCreate = useMutation({
    mutationFn: (data: SelectionStepInput) => addStep(selection.id, data),
    onSuccess: () => {
      onChange();
      toast.success("追加しました");
      setStepOpen(null);
    },
  });
  const stepUpdate = useMutation({
    mutationFn: ({
      stepId,
      data,
    }: {
      stepId: number;
      data: Partial<SelectionStepInput>;
    }) => updateStep(selection.id, stepId, data),
    onSuccess: () => {
      onChange();
      toast.success("更新しました");
      setStepOpen(null);
      setStepEditId(null);
    },
  });
  const stepRemove = useMutation({
    mutationFn: (stepId: number) => deleteStep(selection.id, stepId),
    onSuccess: () => {
      onChange();
      toast.success("削除しました");
    },
  });

  const subCreate = useMutation({
    mutationFn: (data: SubmissionInput) => addSubmission(selection.id, data),
    onSuccess: () => {
      onChange();
      toast.success("追加しました");
      setSubOpen(null);
    },
  });
  const subUpdate = useMutation({
    mutationFn: ({
      submissionId,
      data,
    }: {
      submissionId: number;
      data: Partial<SubmissionInput>;
    }) => updateSubmission(selection.id, submissionId, data),
    onSuccess: () => {
      onChange();
      toast.success("更新しました");
      setSubOpen(null);
      setSubEditId(null);
    },
  });
  const subRemove = useMutation({
    mutationFn: (submissionId: number) =>
      deleteSubmission(selection.id, submissionId),
    onSuccess: () => {
      onChange();
      toast.success("削除しました");
    },
  });

  return (
    <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-4 bg-slate-50/50">
      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">選考ステップ</h3>
          <button
            className="btn-outline !py-1 !px-2 text-xs"
            onClick={() => {
              setStepEditId(null);
              setStepOpen({
                step_type: "interview_1",
                label: null,
                order_index: selection.steps.length,
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
              });
            }}
          >
            <Plus size={12} /> ステップ追加
          </button>
        </div>
        {selection.steps.length === 0 ? (
          <div className="text-xs text-slate-500">ステップがありません</div>
        ) : (
          <div className="space-y-1.5">
            {selection.steps.map((st) => (
              <div
                key={st.id}
                className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-start gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {st.label || STEP_TYPE_LABELS[st.step_type]}
                    </span>
                    <span
                      className={`badge ${
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
                      {STEP_RESULT_LABELS[st.result]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {st.scheduled_date && (
                      <span className="inline-flex items-center gap-0.5">
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
                      </span>
                    )}
                    {st.mode && (
                      <span className="inline-flex items-center gap-0.5">
                        {st.mode === "online" ? (
                          <Video size={10} />
                        ) : (
                          <MapPin size={10} />
                        )}
                        {st.mode}
                      </span>
                    )}
                    {st.location && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} /> {st.location}
                      </span>
                    )}
                    {st.online_url && (
                      <a
                        href={st.online_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary-600 hover:underline"
                      >
                        <Globe size={10} /> URL
                      </a>
                    )}
                    {st.meeting_code && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-slate-400">ID:</span>
                        {st.meeting_code}
                      </span>
                    )}
                    {st.meeting_password && (
                      <span className="inline-flex items-center gap-0.5">
                        <span className="text-slate-400">PW:</span>
                        {st.meeting_password}
                      </span>
                    )}
                  </div>
                  {st.memo && (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                      {st.memo}
                    </p>
                  )}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button
                    className="btn-ghost !p-1"
                    onClick={() => {
                      setStepEditId(st.id);
                      setStepOpen({
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
                      });
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn-ghost !p-1 text-rose-600"
                    onClick={() => {
                      if (confirm("削除してよろしいですか？"))
                        stepRemove.mutate(st.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submissions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">提出物</h3>
          <button
            className="btn-outline !py-1 !px-2 text-xs"
            onClick={() => {
              setSubEditId(null);
              setSubOpen({
                doc_type: "resume",
                label: null,
                deadline: null,
                submitted: false,
                memo: null,
              });
            }}
          >
            <Plus size={12} /> 提出物追加
          </button>
        </div>
        {selection.submissions.length === 0 ? (
          <div className="text-xs text-slate-500">提出物がありません</div>
        ) : (
          <div className="space-y-1.5">
            {selection.submissions.map((sub) => (
              <div
                key={sub.id}
                className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center gap-2"
              >
                <button
                  onClick={() =>
                    subUpdate.mutate({
                      submissionId: sub.id,
                      data: { submitted: !sub.submitted },
                    })
                  }
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    sub.submitted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {sub.submitted && <Check size={12} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText size={12} className="text-slate-400" />
                    <span
                      className={`text-sm font-medium ${
                        sub.submitted
                          ? "line-through text-slate-400"
                          : ""
                      }`}
                    >
                      {sub.label || DOC_TYPE_LABELS[sub.doc_type]}
                    </span>
                    {sub.deadline && (
                      <span className="text-[11px] text-slate-500">
                        〆 {formatDate(sub.deadline)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <button
                    className="btn-ghost !p-1"
                    onClick={() => {
                      setSubEditId(sub.id);
                      setSubOpen({
                        doc_type: sub.doc_type,
                        label: sub.label,
                        deadline: sub.deadline,
                        submitted: sub.submitted,
                        memo: sub.memo,
                      });
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="btn-ghost !p-1 text-rose-600"
                    onClick={() => {
                      if (confirm("削除してよろしいですか？"))
                        subRemove.mutate(sub.id);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offer info */}
      {(selection.offer_salary ||
        selection.offer_location ||
        selection.offer_event_date ||
        selection.memo) && (
        <div>
          <h3 className="text-sm font-semibold mb-1">内定情報・メモ</h3>
          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1 text-xs">
            {selection.offer_salary && (
              <div>
                <span className="text-slate-500">条件（給与等）: </span>
                {selection.offer_salary}
              </div>
            )}
            {selection.offer_location && (
              <div>
                <span className="text-slate-500">勤務地: </span>
                {selection.offer_location}
              </div>
            )}
            {selection.offer_event_date && (
              <div>
                <span className="text-slate-500">内定者懇親会: </span>
                {formatDate(selection.offer_event_date)}
              </div>
            )}
            {selection.memo && (
              <p className="whitespace-pre-wrap text-slate-700">
                {selection.memo}
              </p>
            )}
          </div>
        </div>
      )}

      <StepFormModal
        open={!!stepOpen}
        initial={stepOpen || undefined}
        onClose={() => {
          setStepOpen(null);
          setStepEditId(null);
        }}
        onSubmit={(d) => {
          if (stepEditId) {
            stepUpdate.mutate({ stepId: stepEditId, data: d });
          } else {
            stepCreate.mutate(d);
          }
        }}
        loading={stepCreate.isPending || stepUpdate.isPending}
        mypageUrl={company?.mypage_url}
        companyName={company?.name}
      />
      <SubmissionFormModal
        open={!!subOpen}
        initial={subOpen || undefined}
        onClose={() => {
          setSubOpen(null);
          setSubEditId(null);
        }}
        onSubmit={(d) => {
          if (subEditId) {
            subUpdate.mutate({ submissionId: subEditId, data: d });
          } else {
            subCreate.mutate(d);
          }
        }}
        loading={subCreate.isPending || subUpdate.isPending}
      />
    </div>
  );
}

function SelectionFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  initial?: Selection;
  onClose: () => void;
  onSubmit: (data: SelectionInput) => void;
  loading?: boolean;
}) {
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });
  const [form, setForm] = useState<SelectionInput>(EMPTY_SEL());
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        company_id: initial.company_id,
        title: initial.title || "",
        result_announcement_date: initial.result_announcement_date,
        overall_status: initial.overall_status,
        offer_deadline: initial.offer_deadline,
        offer_event_date: initial.offer_event_date,
        offer_salary: initial.offer_salary || "",
        offer_location: initial.offer_location || "",
        memo: initial.memo || "",
      });
    } else {
      setForm(EMPTY_SEL(companies[0]?.id));
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
      title={initial ? "選考を編集" : "選考を追加"}
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
          <Field label="選考タイトル">
            <input
              className="input"
              value={form.title || ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例: 2026新卒 本選考"
            />
          </Field>
          <Field label="結果発表日">
            <input
              type="date"
              className="input"
              value={form.result_announcement_date || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  result_announcement_date: e.target.value || null,
                })
              }
            />
          </Field>
          <Field label="全体ステータス">
            <select
              className="input"
              value={form.overall_status}
              onChange={(e) =>
                setForm({
                  ...form,
                  overall_status:
                    e.target.value as SelectionInput["overall_status"],
                })
              }
            >
              {Object.entries(SELECTION_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="内定承諾期限">
            <input
              type="date"
              className="input"
              value={form.offer_deadline || ""}
              onChange={(e) =>
                setForm({ ...form, offer_deadline: e.target.value || null })
              }
            />
          </Field>
          <Field label="内定者懇親会">
            <input
              type="date"
              className="input"
              value={form.offer_event_date || ""}
              onChange={(e) =>
                setForm({ ...form, offer_event_date: e.target.value || null })
              }
            />
          </Field>
          <Field label="給与等（提示条件）">
            <input
              className="input"
              value={form.offer_salary || ""}
              onChange={(e) =>
                setForm({ ...form, offer_salary: e.target.value })
              }
              placeholder="例: 初年度年収 500万円"
            />
          </Field>
          <Field label="勤務地">
            <input
              className="input"
              value={form.offer_location || ""}
              onChange={(e) =>
                setForm({ ...form, offer_location: e.target.value })
              }
              placeholder="例: 東京本社"
            />
          </Field>
        </div>
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

function StepFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
  mypageUrl,
  companyName,
}: {
  open: boolean;
  initial?: SelectionStepInput;
  onClose: () => void;
  onSubmit: (d: SelectionStepInput) => void;
  loading?: boolean;
  mypageUrl?: string | null;
  companyName?: string;
}) {
  const defaultStep: SelectionStepInput = {
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
  const [form, setForm] = useState<SelectionStepInput>(defaultStep);
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
      title={initial && "step_type" in (initial || {}) ? "ステップ" : "ステップ"}
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
                  mode: (e.target.value || null) as never,
                })
              }
            >
              <option value="">--</option>
              <option value="offline">オフライン</option>
              <option value="online">オンライン</option>
            </select>
          </Field>
          <Field label="結果">
            <select
              className="input"
              value={form.result}
              onChange={(e) =>
                setForm({ ...form, result: e.target.value as never })
              }
            >
              {Object.entries(STEP_RESULT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="場所 / URL">
          <input
            className="input"
            value={form.location || ""}
            onChange={(e) =>
              setForm({ ...form, location: e.target.value || null })
            }
            placeholder="例: 本社8階 / 〇〇ビル"
          />
        </Field>
        <Field label="オンラインURL">
          <input
            className="input"
            value={form.online_url || ""}
            onChange={(e) =>
              setForm({ ...form, online_url: e.target.value || null })
            }
            placeholder="https://..."
          />
        </Field>
        {form.mode === "online" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="会議コード" hint="ミーティングID等">
              <input
                className="input"
                value={form.meeting_code || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    meeting_code: e.target.value || null,
                  })
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
        )}
        <Field label="メモ">
          <textarea
            className="input min-h-[70px]"
            value={form.memo || ""}
            onChange={(e) => setForm({ ...form, memo: e.target.value || null })}
          />
        </Field>
      </div>
    </Modal>
  );
}

function SubmissionFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  initial?: SubmissionInput;
  onClose: () => void;
  onSubmit: (d: SubmissionInput) => void;
  loading?: boolean;
}) {
  const defaultSub: SubmissionInput = {
    doc_type: "resume",
    label: null,
    deadline: null,
    submitted: false,
    memo: null,
  };
  const [form, setForm] = useState<SubmissionInput>(defaultSub);

  useEffect(() => {
    if (!open) return;
    setForm(initial || defaultSub);
     
  }, [open, initial]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="提出物"
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="種類">
            <select
              className="input"
              value={form.doc_type}
              onChange={(e) =>
                setForm({ ...form, doc_type: e.target.value as never })
              }
            >
              {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
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
            />
          </Field>
          <Field label="締切">
            <input
              type="date"
              className="input"
              value={form.deadline || ""}
              onChange={(e) =>
                setForm({ ...form, deadline: e.target.value || null })
              }
            />
          </Field>
          <Field label="提出状況">
            <label className="flex items-center gap-2 text-sm mt-2">
              <input
                type="checkbox"
                checked={form.submitted}
                onChange={(e) =>
                  setForm({ ...form, submitted: e.target.checked })
                }
              />
              提出済み
            </label>
          </Field>
        </div>
        <Field label="メモ">
          <textarea
            className="input min-h-[60px]"
            value={form.memo || ""}
            onChange={(e) => setForm({ ...form, memo: e.target.value || null })}
          />
        </Field>
      </div>
    </Modal>
  );
}
