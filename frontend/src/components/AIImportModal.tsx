import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseImportText,
  parseImportImage,
  listCompanies,
  createCompany,
  updateCompany,
  listInternships,
  listSelections,
  addInternshipStep,
  addStep as addSelectionStep,
  createInternship,
  type ParsedEvent,
} from "../api/endpoints";
import type { StepType } from "../api/types";
import Modal from "./Modal";
import Field from "./Field";
import { Loader2, Sparkles, Upload, ClipboardPaste, AlertTriangle } from "lucide-react";

type TargetKind =
  | "internship_step"
  | "selection_step"
  | "internship"
  | "company_only";

interface Props {
  open: boolean;
  onClose: () => void;
  initialTargetKind?: TargetKind;
}

const STEP_TYPE_OPTIONS: { value: StepType; label: string }[] = [
  { value: "briefing", label: "説明会・セミナー" },
  { value: "es", label: "エントリーシート" },
  { value: "aptitude", label: "適性検査" },
  { value: "gd", label: "GD" },
  { value: "interview_1", label: "一次面接" },
  { value: "interview_2", label: "二次面接" },
  { value: "interview_3", label: "三次面接" },
  { value: "interview_final", label: "最終面接" },
  { value: "other", label: "その他" },
];

export default function AIImportModal({ open, onClose, initialTargetKind }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edit form state (after parsing)
  const [targetKind, setTargetKind] = useState<TargetKind>(
    initialTargetKind || "internship_step"
  );
  const [companyId, setCompanyId] = useState<number | "new">("new");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [internshipId, setInternshipId] = useState<number | "new">("new");
  const [selectionId, setSelectionId] = useState<number | null>(null);
  const [edited, setEdited] = useState<ParsedEvent | null>(null);

  const companiesQ = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
    enabled: open,
  });
  const internshipsQ = useQuery({
    queryKey: ["internships"],
    queryFn: listInternships,
    enabled: open,
  });
  const selectionsQ = useQuery({
    queryKey: ["selections"],
    queryFn: listSelections,
    enabled: open,
  });

  const filteredInternships = useMemo(() => {
    if (companyId === "new" || !internshipsQ.data) return [];
    return internshipsQ.data.filter((i) => i.company_id === companyId);
  }, [companyId, internshipsQ.data]);
  const filteredSelections = useMemo(() => {
    if (companyId === "new" || !selectionsQ.data) return [];
    return selectionsQ.data.filter((s) => s.company_id === companyId);
  }, [companyId, selectionsQ.data]);

  // Dedup detection: same kind + date + step_type for the same target?
  const duplicateWarning = useMemo<string | null>(() => {
    if (!edited || companyId === "new") return null;
    const date = edited.scheduled_date || edited.start_date;
    if (!date) return null;
    if (targetKind === "selection_step" && selectionId) {
      const sel = selectionsQ.data?.find((s) => s.id === selectionId);
      const dup = sel?.steps?.find(
        (st) => st.scheduled_date === date && st.step_type === edited.step_type
      );
      if (dup) return `この本選考に同じ日付・同じ種類のステップが既に存在します（ID:${dup.id}）`;
    }
    if (targetKind === "internship_step" && internshipId !== "new") {
      const i = internshipsQ.data?.find((x) => x.id === internshipId);
      const dup = i?.steps?.find(
        (st) => st.scheduled_date === date && st.step_type === edited.step_type
      );
      if (dup) return `このインターンに同じ日付・同じ種類のステップが既に存在します（ID:${dup.id}）`;
    }
    if (targetKind === "internship") {
      const dup = internshipsQ.data?.find(
        (i) => i.company_id === companyId && i.start_date === date
      );
      if (dup) return `この企業に同じ開始日のインターンが既に存在します（${dup.title || `ID:${dup.id}`}）`;
    }
    return null;
  }, [edited, targetKind, companyId, selectionId, internshipId, selectionsQ.data, internshipsQ.data]);

  const parseMut = useMutation({
    mutationFn: async () => {
      setError(null);
      if (tab === "text") {
        if (!text.trim()) throw new Error("テキストを貼り付けてください");
        return parseImportText(text);
      } else {
        if (!file) throw new Error("画像を選択してください");
        return parseImportImage(file);
      }
    },
    onSuccess: (resp) => {
      setParsed(resp.parsed);
      setEdited(resp.parsed);
      // Auto-pick target only if user didn't pre-select via initialTargetKind
      if (!initialTargetKind) {
        const hasDate = !!(resp.parsed.scheduled_date || resp.parsed.start_date);
        if (!hasDate) {
          setTargetKind("company_only");
        } else if (resp.parsed.event_kind === "selection_step") {
          setTargetKind("selection_step");
        } else if (resp.parsed.event_kind === "internship") {
          setTargetKind("internship");
        } else {
          setTargetKind("internship_step");
        }
      }
      // Try match company by name
      if (resp.parsed.company_name && companiesQ.data) {
        const match = companiesQ.data.find(
          (c) =>
            c.name === resp.parsed.company_name ||
            c.name.includes(resp.parsed.company_name!) ||
            (resp.parsed.company_name && resp.parsed.company_name.includes(c.name))
        );
        if (match) setCompanyId(match.id);
        else {
          setCompanyId("new");
          setNewCompanyName(resp.parsed.company_name);
        }
      }
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err.response?.data?.detail || err.message || "解析に失敗しました");
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!edited) throw new Error("解析結果がありません");

      // Resolve company id (also propagate URLs/login_id)
      let cid: number;
      if (companyId === "new") {
        const name = newCompanyName.trim() || edited.company_name?.trim() || "";
        if (!name) throw new Error("企業名を入力してください");
        const memoBits: string[] = [];
        if (edited.notes) memoBits.push(edited.notes);
        const c = await createCompany({
          name,
          industry: null,
          location: null,
          recruit_url: edited.recruit_url || null,
          mypage_url: edited.mypage_url || null,
          login_id: edited.login_id || null,
          color: "#3b82f6",
          tags: "",
          memo: memoBits.join("\n") || null,
        });
        cid = c.id;
      } else {
        cid = companyId;
        // Update existing company's URLs/login_id only if currently empty
        const existing = companiesQ.data?.find((c) => c.id === cid);
        const updates: Record<string, string> = {};
        if (existing && !existing.mypage_url && edited.mypage_url) {
          updates.mypage_url = edited.mypage_url;
        }
        if (existing && !existing.recruit_url && edited.recruit_url) {
          updates.recruit_url = edited.recruit_url;
        }
        if (existing && !existing.login_id && edited.login_id) {
          updates.login_id = edited.login_id;
        }
        if (Object.keys(updates).length > 0) {
          try {
            await updateCompany(cid, updates);
          } catch {
            // non-fatal
          }
        }
      }

      if (targetKind === "company_only") {
        return;
      }

      const sd = edited.start_date || edited.scheduled_date;
      const st = edited.start_time || edited.scheduled_time;
      const ed = edited.scheduled_date || edited.start_date;
      const et = edited.scheduled_time || edited.start_time;

      if (targetKind === "internship") {
        await createInternship({
          company_id: cid,
          title: edited.label || null,
          entry_deadline: null,
          entry_deadline_time: null,
          start_date: sd || null,
          start_time: st || null,
          end_date: edited.end_date || null,
          end_time: edited.end_time || null,
          mode: edited.mode || "online",
          online_url: edited.online_url || null,
          meeting_code: edited.meeting_code || null,
          meeting_password: edited.meeting_password || null,
          related_url: null,
          memo: edited.notes || null,
          briefing_date: null,
          briefing_time: null,
          status: "not_applied",
        });
      } else if (targetKind === "internship_step") {
        let iid: number;
        if (internshipId === "new") {
          const i = await createInternship({
            company_id: cid,
            title: null,
            entry_deadline: null,
            entry_deadline_time: null,
            start_date: null,
            start_time: null,
            end_date: null,
            end_time: null,
            mode: "online",
            online_url: null,
            meeting_code: null,
            meeting_password: null,
            related_url: null,
            memo: null,
            briefing_date: null,
            briefing_time: null,
            status: "not_applied",
          });
          iid = i.id;
        } else {
          iid = internshipId as number;
        }
        const isPeriod = !!(edited.start_date && edited.scheduled_date && edited.start_date !== edited.scheduled_date);
        await addInternshipStep(iid, {
          step_type: (edited.step_type as StepType) || "other",
          label: edited.label || null,
          order_index: 0,
          scheduled_date: ed || null,
          scheduled_time: et || null,
          start_date: isPeriod ? edited.start_date : null,
          start_time: isPeriod ? edited.start_time : null,
          location: edited.location || null,
          mode: edited.mode || null,
          online_url: edited.online_url || null,
          meeting_code: edited.meeting_code || null,
          meeting_password: edited.meeting_password || null,
          result: "pending",
          memo: edited.notes || null,
        });
      } else if (targetKind === "selection_step") {
        if (!selectionId) throw new Error("追加する本選考を選択してください");
        const isPeriod = !!(edited.start_date && edited.scheduled_date && edited.start_date !== edited.scheduled_date);
        await addSelectionStep(selectionId, {
          step_type: (edited.step_type as StepType) || "other",
          label: edited.label || null,
          order_index: 0,
          scheduled_date: ed || null,
          scheduled_time: et || null,
          start_date: isPeriod ? edited.start_date : null,
          start_time: isPeriod ? edited.start_time : null,
          location: edited.location || null,
          mode: edited.mode || null,
          online_url: edited.online_url || null,
          meeting_code: edited.meeting_code || null,
          meeting_password: edited.meeting_password || null,
          result: "pending",
          memo: edited.notes || null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["selections"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      handleClose();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err.response?.data?.detail || err.message || "登録に失敗しました");
    },
  });

  const handleClose = () => {
    setText("");
    setFile(null);
    setParsed(null);
    setEdited(null);
    setError(null);
    setTab("text");
    setCompanyId("new");
    setNewCompanyName("");
    setInternshipId("new");
    setSelectionId(null);
    setTargetKind("internship_step");
    onClose();
  };

  const updateEdited = <K extends keyof ParsedEvent>(k: K, v: ParsedEvent[K]) => {
    setEdited((p) => (p ? { ...p, [k]: v } : p));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-violet-500" />
          AIで予定を取り込み
        </div>
      }
    >
      {!parsed ? (
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            メールの本文を貼り付けるか、スクリーンショット画像をアップロードすると、AIが企業名・日時・種類を自動抽出します。
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTab("text")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                tab === "text"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <ClipboardPaste size={14} />
              テキスト貼り付け
            </button>
            <button
              onClick={() => setTab("image")}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
                tab === "image"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <Upload size={14} />
              画像アップロード
            </button>
          </div>

          {tab === "text" ? (
            <textarea
              className="w-full border border-slate-300 rounded-lg p-3 text-sm min-h-[180px]"
              placeholder="メールの本文をここに貼り付け..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          ) : (
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm"
              />
              {file && (
                <div className="mt-2 text-xs text-slate-500">
                  選択中: {file.name} ({Math.round(file.size / 1024)}KB)
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-700"
            >
              キャンセル
            </button>
            <button
              onClick={() => parseMut.mutate()}
              disabled={parseMut.isPending}
              className="px-4 py-1.5 rounded-lg text-sm bg-violet-600 text-white disabled:opacity-50 flex items-center gap-1.5"
            >
              {parseMut.isPending && <Loader2 size={14} className="animate-spin" />}
              <Sparkles size={14} />
              AIで解析
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-sm">
            <div className="font-medium text-violet-900 mb-1 flex items-center gap-1">
              <Sparkles size={14} /> AIが以下を抽出しました
            </div>
            <div className="text-violet-700 text-xs">
              内容を確認・編集して登録ボタンを押してください
            </div>
          </div>

          {/* Target kind */}
          <Field label="登録先">
            <div className="flex gap-2 flex-wrap">
              {[
                { v: "internship_step" as const, l: "インターン選考のステップ" },
                { v: "selection_step" as const, l: "本選考のステップ" },
                { v: "internship" as const, l: "新規インターン" },
                { v: "company_only" as const, l: "企業情報のみ" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setTargetKind(opt.v)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    targetKind === opt.v
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </Field>

          {/* Company picker */}
          <Field label="企業">
            <select
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
              value={companyId === "new" ? "new" : String(companyId)}
              onChange={(e) =>
                setCompanyId(e.target.value === "new" ? "new" : Number(e.target.value))
              }
            >
              <option value="new">+ 新規企業として作成</option>
              {companiesQ.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {companyId === "new" && (
              <input
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm mt-2"
                placeholder="企業名"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
              />
            )}
          </Field>

          {/* Target sub-picker */}
          {targetKind === "internship_step" && companyId !== "new" && (
            <Field label="追加先のインターン">
              <select
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                value={internshipId === "new" ? "new" : String(internshipId)}
                onChange={(e) =>
                  setInternshipId(
                    e.target.value === "new" ? "new" : Number(e.target.value)
                  )
                }
              >
                <option value="new">+ 新規インターンを作成して追加</option>
                {filteredInternships.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title || `インターン #${i.id}`}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {targetKind === "selection_step" && companyId !== "new" && (
            <Field label="追加先の本選考">
              <select
                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                value={selectionId ? String(selectionId) : ""}
                onChange={(e) =>
                  setSelectionId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">選択してください</option>
                {filteredSelections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title || `本選考 #${s.id}`}
                  </option>
                ))}
              </select>
              {filteredSelections.length === 0 && (
                <div className="text-xs text-rose-600 mt-1">
                  この企業には本選考が登録されていません。先に本選考を作成してください。
                </div>
              )}
            </Field>
          )}

          {edited && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <Field label="種類">
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.step_type || "other"}
                  onChange={(e) => updateEdited("step_type", e.target.value)}
                >
                  {STEP_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ラベル(任意)">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.label || ""}
                  onChange={(e) => updateEdited("label", e.target.value)}
                />
              </Field>
              <Field label="日付">
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.scheduled_date || ""}
                  onChange={(e) => updateEdited("scheduled_date", e.target.value)}
                />
              </Field>
              <Field label="時刻">
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.scheduled_time || ""}
                  onChange={(e) => updateEdited("scheduled_time", e.target.value)}
                />
              </Field>
              <Field label="開始日(期間モード)">
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.start_date || ""}
                  onChange={(e) => updateEdited("start_date", e.target.value)}
                />
              </Field>
              <Field label="開始時刻(期間モード)">
                <input
                  type="time"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.start_time || ""}
                  onChange={(e) => updateEdited("start_time", e.target.value)}
                />
              </Field>
              <Field label="形式">
                <select
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.mode || ""}
                  onChange={(e) =>
                    updateEdited("mode", (e.target.value || null) as ParsedEvent["mode"])
                  }
                >
                  <option value="">未設定</option>
                  <option value="online">オンライン</option>
                  <option value="offline">対面</option>
                </select>
              </Field>
              <Field label="場所(対面)">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.location || ""}
                  onChange={(e) => updateEdited("location", e.target.value)}
                />
              </Field>
              <Field label="オンラインURL">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.online_url || ""}
                  onChange={(e) => updateEdited("online_url", e.target.value)}
                />
              </Field>
              <Field label="会議コード">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.meeting_code || ""}
                  onChange={(e) => updateEdited("meeting_code", e.target.value)}
                />
              </Field>
              <Field label="パスワード">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.meeting_password || ""}
                  onChange={(e) => updateEdited("meeting_password", e.target.value)}
                />
              </Field>
              <Field label="マイページURL">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.mypage_url || ""}
                  onChange={(e) => updateEdited("mypage_url", e.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <Field label="採用ページURL">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.recruit_url || ""}
                  onChange={(e) => updateEdited("recruit_url", e.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <Field label="マイページID">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.login_id || ""}
                  onChange={(e) => updateEdited("login_id", e.target.value)}
                />
              </Field>
              <Field label="メモ" className="md:col-span-2">
                <input
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  value={edited.notes || ""}
                  onChange={(e) => updateEdited("notes", e.target.value)}
                />
              </Field>
            </div>
          )}

          {duplicateWarning && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">重複の可能性</div>
                <div className="text-xs mt-0.5">{duplicateWarning}</div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 rounded p-2">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <button
              onClick={() => {
                setParsed(null);
                setEdited(null);
                setError(null);
              }}
              className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-700"
            >
              ← やり直す
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-100 text-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={() => submitMut.mutate()}
                disabled={submitMut.isPending}
                className="px-4 py-1.5 rounded-lg text-sm bg-emerald-600 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitMut.isPending && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                登録
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
