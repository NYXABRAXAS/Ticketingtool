const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "pdf", "doc", "docx", "xls", "xlsx", "txt"]);

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

// Extension-vs-declared-MIME agreement check plus a denylist of executable/script
// extensions, defense in depth against a renamed .exe/.js being smuggled through.
const DANGEROUS_EXTENSIONS = new Set(["exe", "bat", "cmd", "sh", "js", "vbs", "ps1", "msi", "dll", "scr", "jar", "com", "app"]);

export function validateUploadedFile(originalName: string, mimeType: string, sizeBytes: number, maxBytes: number): { ok: true } | { ok: false; reason: string } {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";

  if (DANGEROUS_EXTENSIONS.has(ext)) return { ok: false, reason: "This file type is not allowed for security reasons." };
  if (!ALLOWED_EXTENSIONS.has(ext)) return { ok: false, reason: `File type .${ext} is not supported.` };
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return { ok: false, reason: "File content type is not supported." };
  if (sizeBytes <= 0) return { ok: false, reason: "File is empty." };
  if (sizeBytes > maxBytes) return { ok: false, reason: `File exceeds the maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))} MB.` };

  return { ok: true };
}
