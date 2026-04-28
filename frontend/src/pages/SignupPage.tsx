import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { signup } from "../api/endpoints";
import { useAuth } from "../store/auth";
import { GraduationCap } from "lucide-react";

export default function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [firstName, setFirstName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName || !birthday) return;
    setLoading(true);
    try {
      const res = await signup({
        first_name: firstName,
        birthday,
        display_name: displayName || undefined,
        email: email || undefined,
      });
      setAuth(res.user, res.access_token);
      toast.success(`ようこそ、${res.user.first_name}さん`);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "アカウント作成に失敗しました";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center px-4 py-10 bg-gradient-to-br from-primary-50 via-white to-rose-50">
      <div className="w-full max-w-sm card p-7">
        <div className="flex flex-col items-center mb-5">
          <div className="bg-primary-600 text-white p-3 rounded-2xl shadow">
            <GraduationCap size={26} />
          </div>
          <h1 className="text-xl font-bold mt-3">アカウント作成</h1>
          <p className="text-xs text-slate-500 mt-1">
            名前と生年月日だけで始められます
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">名前（下の名前）</label>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="例: 想埜"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="label">生年月日</label>
            <input
              type="date"
              className="input"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
          <div>
            <label className="label">
              表示名 <span className="text-slate-400">(任意)</span>
            </label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: 田森 想埜"
            />
          </div>
          <div>
            <label className="label">
              メールアドレス <span className="text-slate-400">(任意・通知用)</span>
            </label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@example.com"
              autoComplete="email"
            />
          </div>
          <button
            className="btn-primary w-full mt-2"
            type="submit"
            disabled={loading}
          >
            {loading ? "作成中..." : "アカウントを作成"}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-slate-500">
          すでにアカウントをお持ちの方は
          <Link to="/login" className="text-primary-600 font-medium ml-1">
            ログイン
          </Link>
        </div>
      </div>
    </div>
  );
}
