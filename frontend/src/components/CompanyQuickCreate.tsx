import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createCompany } from "../api/endpoints";
import type { Company, CompanyInput } from "../api/types";
import ColorPicker from "./ColorPicker";
import Field from "./Field";
import Modal from "./Modal";

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

export default function CompanyQuickCreate({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Company) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<CompanyInput>(EMPTY);

  useEffect(() => {
    if (open) setForm(EMPTY);
  }, [open]);

  const create = useMutation({
    mutationFn: createCompany,
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("企業を登録しました");
      onCreated(c);
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "登録に失敗しました"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新規企業を登録"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            キャンセル
          </button>
          <button
            className="btn-primary"
            disabled={create.isPending || !form.name.trim()}
            onClick={() => create.mutate(form)}
          >
            {create.isPending ? "保存中..." : "登録"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="企業名" required>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例: 株式会社〇〇"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="業界">
            <input
              className="input"
              value={form.industry || ""}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="例: IT・通信"
            />
          </Field>
          <Field label="所在地">
            <input
              className="input"
              value={form.location || ""}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="例: 東京"
            />
          </Field>
        </div>
        <Field label="カラー" hint="カレンダーでの識別色">
          <ColorPicker
            value={form.color}
            onChange={(c) => setForm({ ...form, color: c })}
          />
        </Field>
        <Field label="タグ" hint="カンマ区切り">
          <input
            className="input"
            value={form.tags || ""}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="例: IT, メガベンチャー"
          />
        </Field>
        <p className="text-xs text-slate-500">
          その他の情報（採用ページURL、マイページURL、ログインIDなど）は後で「企業」ページから編集できます。
        </p>
      </div>
    </Modal>
  );
}
