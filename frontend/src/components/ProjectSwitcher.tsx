import { useEffect, useState } from "react";
import { api } from "../api/client";
import { ProjectOption } from "../types";
import { useAuth } from "../context/AuthContext";

// Section 8 of the spec: a dropdown only appears when the user is authorized for more
// than one project; a single-project user just sees a static label (rendered by Layout).
export function ProjectSwitcher() {
  const { me, refresh } = useAuth();
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    api.get<{ current: string; projects: ProjectOption[] }>("/api/projects").then((r) => setProjects(r.projects));
  }, [me?.project.id]);

  if (projects.length <= 1) return null;

  return (
    <select
      value={me?.project.id}
      onChange={async (e) => {
        await api.post("/api/projects/switch", { projectId: e.target.value });
        await refresh();
        window.location.href = "/dashboard";
      }}
      style={{ width: "100%", marginTop: 6 }}
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  );
}
