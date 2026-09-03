"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthPanel, FormError, inputClassName } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Registration failed. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <AuthPanel
      title="Create your account"
      subtitle="Start managing your farm with AI intelligence."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <div>
          <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-moss-300">
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Umar Aslam"
            className={inputClassName}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-moss-300">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className={inputClassName}
          />
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-moss-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-sprout-400 hover:text-sprout-300">
          Sign in
        </Link>
      </p>
    </AuthPanel>
  );
}
