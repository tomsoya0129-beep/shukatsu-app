import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { login } from "../api/endpoints";
import { useAuth } from "../store/auth";
import { GraduationCap } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuth((s) => s.setAuth);
  const [firstName, setFirstName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName || !birthday) return;
    setLoading(true);
    try {
      const res = await login({ first_name: firstName, birthday });
      setAuth(res.user, res.access_token);
      toast.success(`おかえりなさい、${res.user.first_name}さん`);
      navigate("/");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "ログインに失敗しました";
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
          <h1 className="text-xl font-bold mt-3">就活マネージャー</h1>
          <p className="text-xs text-slate-500 mt-1">
            インターン・本選考を一元管理
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
          <button
            className="btn-primary w-full mt-2"
            type="submit"
            disabled={loading}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-slate-500">
          初めてご利用の方は
          <Link to="/signup" className="text-primary-600 font-medium ml-1">
            アカウント作成
          </Link>
        </div>
      </div>
    </div>
  );
}
