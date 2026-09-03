"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthPanel, FormError, inputClassName } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Login failed. Try again.",
      );
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("demo@terramind.ai");
    setPassword("terramind123");
  }

  return (
    <AuthPanel title="Welcome back" subtitle="Sign in to your farm command center.">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-moss-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@farm.com"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-moss-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClassName}
          />
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>

      <button
        onClick={fillDemo}
        className="mt-4 w-full rounded-xl border border-dashed border-earth-400/40 bg-earth-400/5 px-3 py-2.5 text-xs text-earth-300 transition-colors hover:bg-earth-400/10"
      >
        Explore the demo farm — demo@terramind.ai / terramind123
      </button>

      <p className="mt-6 text-center text-xs text-moss-400">
        New to TerraMind?{" "}
        <Link href="/register" className="font-medium text-sprout-400 hover:text-sprout-300">
          Create an account
        </Link>
      </p>
    </AuthPanel>
  );
}
