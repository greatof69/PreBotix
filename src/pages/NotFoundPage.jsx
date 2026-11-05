import { ArrowLeft, CircuitBoard } from "lucide-react";

export default function NotFoundPage() {
  return <main className="not-found-page" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px 20px", textAlign: "center" }}>
    <div style={{ maxWidth: 520 }}>
      <a className="brand" href="/" aria-label="PreBotix home" style={{ display: "inline-flex", marginBottom: 28 }}><span className="brand-icon"><CircuitBoard size={22} /></span><span>PRE<span className="brand-accent">BOTIX</span><small>ENGINEER YOUR IDEAS</small></span></a>
      <p style={{ fontSize: "clamp(4rem, 14vw, 8rem)", lineHeight: 1, margin: "0 0 12px", fontWeight: 800 }}>404</p>
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist or may have moved.</p>
      <a className="button button-primary" href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 16 }}><ArrowLeft size={17} /> Back to home</a>
    </div>
  </main>;
}
