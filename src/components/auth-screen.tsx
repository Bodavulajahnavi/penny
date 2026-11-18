"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sprout, UserRound } from "lucide-react";
import { Logo, PlantIllustration } from "@/components/icons";
import { apiJson, rememberSession } from "@/lib/api-client";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState<"" | "form" | "demo">("");
  const [error, setError] = useState("");
  const isSignup = mode === "signup";

  async function authenticate(event?: FormEvent, demo = false) {
    event?.preventDefault();
    setPending(demo ? "demo" : "form");
    setError("");
    try {
      const result = await apiJson<{ sessionToken?: string }>("/api/auth", {
        method: "POST",
        body: JSON.stringify(demo ? { action: "demo" } : { action: mode, name, email, password }),
      });
      await rememberSession(result.sessionToken);
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setPending("");
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link href="/" aria-label="Penny home">
          <Logo />
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow">
            <Sprout size={15} />A LITTLE CLARITY. A LOT OF POSSIBILITY.
          </span>
          <h1>
            Less money stress.
            <br />
            More <span>life.</span>
          </h1>
          <p>Your everyday finances, thoughtfully brought together. Make room for the things that matter.</p>
          <div className="auth-preview" aria-hidden="true">
            <div className="auth-preview-top">
              <span className="auth-preview-icon">
                <Sprout size={21} />
              </span>
              <div>
                <strong>Your money is growing.</strong>
                <span>One small step at a time.</span>
              </div>
              <Check size={18} />
            </div>
            <div className="auth-preview-value">
              $8,165<span>.55</span>
            </div>
            <div className="auth-preview-chart">
              <svg viewBox="0 0 400 80" fill="none">
                <path
                  d="M0 70C30 68 38 45 67 49S106 75 139 48 171 56 202 35 238 46 270 24 304 36 333 15 365 23 400 3"
                  stroke="#4c8159"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <path
                  d="M0 70C30 68 38 45 67 49S106 75 139 48 171 56 202 35 238 46 270 24 304 36 333 15 365 23 400 3V80H0Z"
                  fill="url(#authGradient)"
                />
                <defs>
                  <linearGradient id="authGradient" x1="200" y1="0" x2="200" y2="80" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#94b98c" stopOpacity=".3" />
                    <stop offset="1" stopColor="#94b98c" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="auth-preview-bottom">
              <span>Monthly balance</span>
              <span>
                <i />
                Looking good
              </span>
            </div>
          </div>
          <PlantIllustration />
        </div>
        <div className="auth-story-footer">
          <LockKeyhole size={14} />
          Private by design. Yours by nature.
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          {isSignup && <span className="auth-welcome-pill">A fresh start looks good on you.</span>}
          <h2>{isSignup ? "Meet your money." : "Welcome back."}</h2>
          <p>
            {isSignup ? "Create your account. Build better money habits." : "A little clarity is just a sign-in away."}
          </p>
          <form className="app-form" onSubmit={(event) => authenticate(event)}>
            {isSignup && (
              <label>
                Full name
                <div className="input-with-icon">
                  <UserRound size={17} />
                  <input
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />
                </div>
              </label>
            )}
            <label>
              Email address
              <div className="input-with-icon">
                <Mail size={17} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
            </label>
            <label>
              Password
              <div className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={isSignup ? "At least 8 characters" : "Enter your password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={isSignup ? 8 : undefined}
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-primary auth-submit" type="submit" disabled={Boolean(pending)}>
              {pending === "form" && <LoaderCircle size={17} className="spin" />}
              {pending === "form" ? "Just a moment…" : isSignup ? "Create account" : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-divider">
            <span />
            or take a look around
            <span />
          </div>
          <button
            className="button button-secondary demo-button"
            onClick={() => authenticate(undefined, true)}
            disabled={Boolean(pending)}
          >
            {pending === "demo" ? <LoaderCircle size={17} className="spin" /> : <Sprout size={18} />}
            Explore the demo
            <ArrowRight size={16} />
          </button>
          <p className="demo-credentials">
            Demo: <strong>demo@example.com</strong> / <strong>demo1234</strong>
          </p>
          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "New around here?"}{" "}
            <Link href={isSignup ? "/?view=login" : "/?view=signup"}>
              {isSignup ? "Sign in" : "Create an account"}
              <ArrowRight size={13} />
            </Link>
          </p>
        </div>
        <div className="auth-form-footer">
          A little today. A better tomorrow.
          <span>© {new Date().getFullYear()} penny</span>
        </div>
      </section>
    </main>
  );
}
