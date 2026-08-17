import { useEffect, useState } from "react";
import { api } from "../../api/client";

interface RedmineInfo { baseUrl: string; apiKeyConfigured: boolean }

export function RedmineConfig() {
  const [info, setInfo] = useState<RedmineInfo | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { api.get<RedmineInfo>("/api/admin/redmine").then(setInfo); }, []);

  return (
    <div>
      <h2>Redmine Connection</h2>
      <div className="card" style={{ maxWidth: 520 }}>
        <p><strong>Base URL:</strong> {info?.baseUrl ?? "…"}</p>
        <p><strong>API Key:</strong> {info?.apiKeyConfigured ? "Configured (hidden)" : "Not configured"}</p>
        <p style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
          The Redmine URL and API key are set via the <code>REDMINE_BASE_URL</code> and <code>REDMINE_API_KEY</code> environment
          variables on the backend. They are never stored in the database or shown in the browser.
        </p>
        <button
          className="btn btn-primary"
          disabled={testing}
          onClick={async () => {
            setTesting(true);
            setResult(null);
            try {
              setResult(await api.post("/api/admin/redmine/test-connection"));
            } finally {
              setTesting(false);
            }
          }}
        >
          {testing ? "Testing…" : "Test Redmine Connection"}
        </button>
        {result && (
          <p style={{ marginTop: 12, color: result.ok ? "var(--success)" : "var(--danger)" }}>
            {result.ok ? "✓" : "✗"} {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
