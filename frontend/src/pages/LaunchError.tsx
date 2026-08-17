import { useSearchParams } from "react-router-dom";

export function LaunchError() {
  const [params] = useSearchParams();
  const reason = params.get("reason") ?? "This launch link is invalid or has expired.";

  return (
    <div className="centered-screen">
      <h2>Ticketing Tool could not be opened</h2>
      <p style={{ color: "var(--text-muted)", maxWidth: 480 }}>{reason}</p>
      <p style={{ color: "var(--text-muted)", maxWidth: 480 }}>Please return to your LOS and click "Ticketing Tool" again.</p>
    </div>
  );
}
