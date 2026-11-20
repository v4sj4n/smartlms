import { useEffect, useState } from "react";

type Health = { status: string; service: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("backend not reachable");
        return res.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>SmartLMS</h1>
      <p>Frontend (React) is running.</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {health ? (
        <p>
          Backend says: <strong>{health.status}</strong> ({health.service})
        </p>
      ) : (
        !error && <p>Connecting to backend…</p>
      )}
    </main>
  );
}
