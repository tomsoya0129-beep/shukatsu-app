import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Link as LinkIcon, Tag, Globe } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import {
  createCompany,
  deleteCompany,
  listCompanies,
  reorderCompanies,
  updateCompany,
} from "../api/endpoints";
import type { Company, CompanyInput } from "../api/types";
import ColorPicker from "../components/ColorPicker";
import ConfirmDialog from "../components/ConfirmDialog";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { SortableList } from "../components/SortableList";
import { contrastText, splitTags } from "../lib/utils";

const EMPTY: CompanyInput = {
  name: "",
  industry: "",
  location: "",
  recruit_url: "",
  mypage_url: "",
  login_id: "",
  color: "#2563eb",
  tags: "",
  memo: "",
};

export default function CompaniesPage() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: listCompanies,
  });

  const [editing, setEditing] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Company | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Handle #company-<id> hash navigation from dashboard/calendar
  const location = useLocation();
  useEffect(() => {
    const m = location.hash.match(/^#company-(\d+)/);
    if (!m) return;
    const id = Number(m[1]);
    if (!id || companies.length === 0) return;
    setHighlightedId(id);
    setFilterTag(null); // ensure it's visible
    setTimeout(() => {
      const el = document.getElementById(`company-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const t = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(t);
  }, [location.hash, companies.length]);

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("企業を追加しました");
      setCreating(false);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CompanyInput> }) =>
      updateCompany(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("更新しました");
      setEditing(null);
    },
  });
  const reorder = useMutation({
    mutationFn: reorderCompanies,
    onMutate: async (ids: number[]) => {
      await qc.cancelQueries({ queryKey: ["companies"] });
      const prev = qc.getQueryData<Company[]>(["companies"]);
      if (prev) {
        const map = new Map(prev.map((x) => [x.id, x]));
        const reordered = ids
          .map((id) => map.get(id))
          .filter((x): x is Company => !!x);
        const others = prev.filter((x) => !ids.includes(x.id));
        qc.setQueryData<Company[]>(["companies"], [...reordered, ...others]);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["companies"], ctx.prev);
      toast.error("並び替えの保存に失敗しました");
    },
  });

  const remove = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["internships"] });
      qc.invalidateQueries({ queryKey: ["selections"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("削除しました");
      setToDelete(null);
    },
    onError: (e: any) => {
      console.error("delete company failed", e);
      toast.error(e?.response?.data?.detail ?? "削除に失敗しました");
    },
  });

  const allTags = Array.from(
    new Set(companies.flatMap((c) => splitTags(c.tags)))
  );
  const filtered = filterTag
    ? companies.filter((c) => splitTags(c.tags).includes(filterTag))
    : companies;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">企業</h1>
          <p className="text-sm text-slate-500">
            業界・所在地・ログインID・タグなどを管理します
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> 新規追加
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Tag size={14} className="text-slate-400" />
          <button
            className={`chip ${
              filterTag === null ? "bg-primary-600 text-white" : ""
            }`}
            onClick={() => setFilterTag(null)}
          >
            すべて
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              className={`chip ${
                filterTag === t ? "bg-primary-600 text-white" : ""
              }`}
              onClick={() => setFilterTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-slate-400 py-6 text-center">
          読み込み中...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-slate-500 text-sm">
          まだ企業がありません。「新規追加」から登録しましょう。
        </div>
      ) : (
        <>
          {filterTag === null && filtered.length > 1 && (
            <p className="text-[11px] text-slate-400">
              ⚡ 長押ししてドラッグすると並び替えられます
            </p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <SortableList
              items={filtered}
              enabled={filterTag === null}
              onReorder={(ids) => reorder.mutate(ids)}
              renderItem={(c, handle) => (
            <div
              id={`company-${c.id}`}
              className={`card p-4 transition ${
                highlightedId === c.id
                  ? "ring-2 ring-primary-500 shadow-lg"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {handle}
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: c.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {c.industry || "-"}
                      {c.location ? ` ・ ${c.location}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="btn-ghost !px-2 !py-1"
                    onClick={() => setEditing(c)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-rose-600"
                    onClick={() => setToDelete(c)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {splitTags(c.tags).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {splitTags(c.tags).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                {c.recruit_url && (
                  <a
                    className="flex items-center gap-1 hover:text-primary-600 truncate"
                    href={c.recruit_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkIcon size={12} /> 採用ページ
                  </a>
                )}
                {c.mypage_url && (
                  <a
                    className="flex items-center gap-1 hover:text-primary-600 truncate"
                    href={c.mypage_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <LinkIcon size={12} /> マイページ
                  </a>
                )}
                {c.login_id && (
                  <div className="text-slate-500">
                    ログインID: <span className="font-mono">{c.login_id}</span>
                  </div>
                )}
              </div>
              {c.memo && (
                <p className="mt-3 text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">
                  {c.memo}
                </p>
              )}
              <div
                className="mt-3 text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded inline-flex"
                style={{
                  background: c.color,
                  color: contrastText(c.color),
                }}
              >
                色タグ
              </div>
            </div>
              )}
            />
          </div>
        </>
      )}

      <CompanyFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(d) => create.mutate(d)}
        loading={create.isPending}
      />
      <CompanyFormModal
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(d) => editing && update.mutate({ id: editing.id, data: d })}
        loading={update.isPending}
      />
      <ConfirmDialog
        open={!!toDelete}
        danger
        title="企業を削除"
        message={
          toDelete
            ? `「${toDelete.name}」と関連するインターン・本選考データも一緒に削除します。よろしいですか？（取り消せません）`
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

function CompanyFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  initial?: Company;
  onClose: () => void;
  onSubmit: (data: CompanyInput) => void;
  loading?: boolean;
}) {
  const [form, setForm] = useState<CompanyInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            name: initial.name,
            industry: initial.industry || "",
            location: initial.location || "",
            recruit_url: initial.recruit_url || "",
            mypage_url: initial.mypage_url || "",
            login_id: initial.login_id || "",
            color: initial.color,
            tags: initial.tags || "",
            memo: initial.memo || "",
          }
        : EMPTY
    );
  }, [open, initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("企業名を入力してください");
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "企業を編集" : "企業を追加"}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={loading}
          >
            {loading ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        {form.mypage_url && (
          <a
            href={form.mypage_url}
            target="_blank"
            rel="noreferrer"
            className="btn-outline !py-1.5 !px-3 text-sm inline-flex w-full md:w-auto justify-center"
          >
            <Globe size={14} /> マイページを開く
          </a>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="企業名" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: 〇〇株式会社"
            />
          </Field>
          <Field label="業界">
            <input
              className="input"
              value={form.industry || ""}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="例: IT、コンサル、メーカー"
            />
          </Field>
          <Field label="所在地">
            <input
              className="input"
              value={form.location || ""}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="例: 東京都渋谷区"
            />
          </Field>
          <Field label="ログインID" hint="マイページ用。パスワードは保存しません">
            <input
              className="input"
              value={form.login_id || ""}
              onChange={(e) => setForm({ ...form, login_id: e.target.value })}
              placeholder="user@example.com など"
            />
          </Field>
          <Field label="採用ページURL">
            <input
              className="input"
              value={form.recruit_url || ""}
              onChange={(e) =>
                setForm({ ...form, recruit_url: e.target.value })
              }
              placeholder="https://..."
            />
          </Field>
          <Field label="マイページURL">
            <input
              className="input"
              value={form.mypage_url || ""}
              onChange={(e) => setForm({ ...form, mypage_url: e.target.value })}
              placeholder="https://..."
            />
          </Field>
        </div>
        <Field label="タグ" hint="カンマ区切り（例: IT, 外資, 夏インターン）">
          <input
            className="input"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="IT, 外資, 夏インターン"
          />
        </Field>
        <Field label="カラー">
          <ColorPicker
            value={form.color}
            onChange={(c) => setForm({ ...form, color: c })}
          />
        </Field>
        <Field label="メモ">
          <textarea
            className="input min-h-[90px]"
            value={form.memo || ""}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            placeholder="自由記述"
          />
        </Field>
      </form>
    </Modal>
  );
}
