import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Bell, Mail, Send, RefreshCw } from "lucide-react";
import {
  getPrefs,
  updatePrefs,
  sendTestEmail,
  type NotificationPrefs,
} from "../api/endpoints";

const DEFAULT_PREFS: NotificationPrefs = {
  email_enabled: true,
  deadline_3d: true,
  deadline_1d: true,
  aptitude_3d: true,
  aptitude_1d: true,
  interview_1d: true,
  interview_1h: true,
  intern_start_1d: true,
  intern_start_1h: true,
  briefing_1d: true,
  briefing_1h: true,
  submission_3d: true,
  submission_1d: true,
  offer_3d: true,
  offer_1d: true,
};

type Section = {
  title: string;
  items: { key: keyof NotificationPrefs; label: string; hint?: string }[];
};

const SECTIONS: Section[] = [
  {
    title: "エントリー締切",
    items: [
      { key: "deadline_3d", label: "3日前", hint: "インターン/本選考" },
      { key: "deadline_1d", label: "前日" },
    ],
  },
  {
    title: "適性検査の締切",
    items: [
      { key: "aptitude_3d", label: "3日前" },
      { key: "aptitude_1d", label: "前日" },
    ],
  },
  {
    title: "面接・選考ステップ",
    items: [
      { key: "interview_1d", label: "前日" },
      { key: "interview_1h", label: "1時間前" },
    ],
  },
  {
    title: "説明会",
    items: [
      { key: "briefing_1d", label: "前日" },
      { key: "briefing_1h", label: "1時間前" },
    ],
  },
  {
    title: "インターン開始",
    items: [
      { key: "intern_start_1d", label: "前日" },
      { key: "intern_start_1h", label: "1時間前" },
    ],
  },
  {
    title: "提出物",
    items: [
      { key: "submission_3d", label: "3日前" },
      { key: "submission_1d", label: "前日" },
    ],
  },
  {
    title: "内定承諾期限",
    items: [
      { key: "offer_3d", label: "3日前" },
      { key: "offer_1d", label: "前日" },
    ],
  },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["prefs"],
    queryFn: getPrefs,
  });

  const [email, setEmail] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setEmail(data.email ?? "");
      setPrefs({ ...DEFAULT_PREFS, ...data.prefs });
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updatePrefs({ email: email || null, prefs }),
    onSuccess: () => {
      toast.success("設定を保存しました");
      qc.invalidateQueries({ queryKey: ["prefs"] });
      setDirty(false);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.detail ?? "保存に失敗しました");
    },
  });

  const test = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: (r) => {
      toast.success(`テストメールを送信しました: ${r.to}`);
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.detail ?? "テスト送信に失敗しました"
      );
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">読み込み中...</div>;
  }

  const togglePref = (k: keyof NotificationPrefs) => {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
    setDirty(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-center gap-2">
        <Bell className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold">通知設定</h1>
      </header>

      <section className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <Mail className="w-5 h-5" /> メールアドレス
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          通知の送信先メールアドレスです。
          {data?.provider && (
            <>
              <br />
              送信元: <span className="font-mono text-slate-600">{data.provider}</span>
              {data.configured === false && (
                <span className="text-red-600 font-semibold"> （未設定）</span>
              )}
            </>
          )}
        </p>
        <input
          type="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setDirty(true);
          }}
        />
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            保存
          </button>
          <button
            className="btn"
            disabled={!data?.email || test.isPending}
            onClick={() => test.mutate()}
            title={!data?.email ? "先にメールを保存してください" : "テスト送信"}
          >
            <Send className="w-4 h-4 mr-1" />
            テスト送信
          </button>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-slate-700">
            メール通知を有効にする
          </div>
          <Toggle
            checked={prefs.email_enabled}
            onChange={() => togglePref("email_enabled")}
          />
        </div>
        <p className="text-xs text-slate-500">
          全体スイッチです。オフにするとすべての通知メールが止まります。
        </p>
      </section>

      <section className="card p-5 space-y-5">
        <div className="font-semibold text-slate-700">通知タイミング</div>
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {sec.title}
            </div>
            {sec.items.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
              >
                <div>
                  <div className="text-sm text-slate-700">{item.label}</div>
                  {item.hint && (
                    <div className="text-xs text-slate-400">{item.hint}</div>
                  )}
                </div>
                <Toggle
                  checked={!!prefs[item.key]}
                  onChange={() => togglePref(item.key)}
                />
              </label>
            ))}
          </div>
        ))}

        <div className="pt-2">
          <button
            className="btn btn-primary"
            disabled={save.isPending || !dirty}
            onClick={() => save.mutate()}
          >
            設定を保存
          </button>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        ※ 「前日」は日本時間 07:00 にチェック、「1時間前」はイベント開始時刻の1時間前に送信されます。
      </p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-primary-600" : "bg-slate-300"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
