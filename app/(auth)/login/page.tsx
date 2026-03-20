"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as "seeker" | "employer" | null;
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [userType, setUserType] = useState<"seeker" | "employer">(
    typeParam ?? "seeker"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState(errorParam ?? "");
  const [isLoading, setIsLoading] = useState(false);

  // If type param is set, default to signup
  useEffect(() => {
    if (typeParam) setMode("signup");
  }, [typeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        userType,
        companyName,
        isSignUp: String(mode === "signup"),
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === "Email already registered"
            ? "That email is already registered. Sign in instead?"
            : "Invalid email or password."
        );
        return;
      }

      if (result?.ok) {
        router.push(userType === "seeker" ? "/chat" : "/employer/chat");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const isRaj = userType === "seeker";
  const accentColor = isRaj ? "amber" : "blue";

  return (
    <div className="w-full max-w-sm">
      {/* Header */}
      <div className="text-center mb-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 block mb-6">
          ← Raj &amp; Prachi
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === "signup"
            ? "Tell us who you are to get started"
            : "Sign in to continue"}
        </p>
      </div>

      {/* User type toggle (signup only) */}
      {mode === "signup" && (
        <div className="flex rounded-xl border border-gray-200 p-1 mb-6 bg-white">
          <button
            type="button"
            onClick={() => setUserType("seeker")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              userType === "seeker"
                ? "bg-amber-600 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Job seeker
          </button>
          <button
            type="button"
            onClick={() => setUserType("employer")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              userType === "employer"
                ? "bg-[#1E3A5F] text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Employer
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Company name (employer signup only) */}
        {mode === "signup" && userType === "employer" && (
          <div>
            <label
              htmlFor="companyName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Acme Corp"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
            className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 ${
              isRaj
                ? "focus:ring-amber-400 focus:border-amber-400"
                : "focus:ring-blue-400 focus:border-blue-400"
            }`}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min. 8 characters"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className={`w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 ${
              isRaj
                ? "focus:ring-amber-400 focus:border-amber-400"
                : "focus:ring-blue-400 focus:border-blue-400"
            }`}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3.5 rounded-2xl text-white font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 mt-2 ${
            isRaj
              ? "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
              : "bg-[#1E3A5F] hover:bg-[#162d4a] focus-visible:ring-blue-500"
          }`}
        >
          {isLoading
            ? "Please wait..."
            : mode === "signup"
            ? "Create account"
            : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="text-amber-600 hover:underline font-medium"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="text-amber-600 hover:underline font-medium"
            >
              Sign up
            </button>
          </>
        )}
      </p>
    </div>
  );
}
