import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export default function App() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const meta = useQuery({ queryKey: ["meta"], queryFn: api.meta });
  const campuses = useQuery({ queryKey: ["campuses"], queryFn: api.campuses });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 960 }}>
      <h1>SmartLMS</h1>

      {health.isPending && <p>Connecting to backend…</p>}
      {health.isError && <p style={{ color: "crimson" }}>{String(health.error)}</p>}
      {health.data && (
        <p>
          Backend: <strong>{health.data.status}</strong> ({health.data.service}, db{" "}
          {health.data.db})
        </p>
      )}

      {meta.data && (
        <>
          <h2>Roles &amp; modules</h2>
          {meta.data.roles.map((role) => (
            <div key={role.id} style={{ marginBottom: "0.75rem" }}>
              <strong>{role.name}</strong> →{" "}
              {role.modules.map((m) => m.key).join(", ") || "—"}
            </div>
          ))}
          <h2>Seeded users</h2>
          <ul>
            {meta.data.users.map((u) => (
              <li key={u.email}>
                {u.name} ({u.email}) — {u.role}
              </li>
            ))}
          </ul>
        </>
      )}

      {campuses.data && (
        <>
          <h2>Campuses</h2>
          {campuses.data.map((c) => (
            <div key={c.id} style={{ marginBottom: "1rem" }}>
              <strong>{c.name}</strong>
              {c.address ? ` — ${c.address}` : ""}
              {c.stories.map((s) => (
                <div key={s.id} style={{ marginLeft: "1rem" }}>
                  Floor {s.floor} {s.name ? `(${s.name})` : ""}
                  <ul style={{ margin: "0.25rem 0" }}>
                    {s.classes.map((cl) => (
                      <li key={cl.id}>
                        {cl.name} — capacity {cl.capacity}
                        {cl.tags.length > 0 ? ` — tags: ${cl.tags.join(", ")}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </main>
  );
}
