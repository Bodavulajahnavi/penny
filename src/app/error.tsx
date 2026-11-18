"use client";
import { RefreshCw } from "lucide-react";
import { Logo } from "@/components/icons";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page">
      <section className="card error-card">
        <Logo />
        <h1>A little pause, not a setback.</h1>
        <p>We couldn’t load your workspace. Your saved data is safe. Give it another try in a moment.</p>
        <button className="button button-primary" onClick={reset}>
          <RefreshCw size={16} />
          Try again
        </button>
      </section>
    </main>
  );
}
