"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (password.length < 8) {
      setError("密码长度至少需要 8 个字符");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || "注册失败");
        return;
      }

      router.refresh();
      router.push("/");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4">
      <div className="space-y-6 rounded-[2rem] border border-black/6 bg-white/86 px-6 py-8 shadow-[0_24px_80px_rgba(31,20,10,0.06)] backdrop-blur">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">
            创建账号
          </h1>
          <p className="text-base leading-7 text-stone-600">
            开始记录你的每日轨迹，整理生活与工作的碎片。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-[1.4rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">邮箱</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
              placeholder="至少 8 个字符"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-stone-700">确认密码</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-full border border-black/8 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-300"
              placeholder="再次输入密码"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? "注册中..." : "创建账号"}
          </button>
        </form>

        <div className="text-center text-sm text-stone-600">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-stone-900 underline underline-offset-4">
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
}
