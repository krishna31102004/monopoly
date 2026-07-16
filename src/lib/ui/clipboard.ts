type ClipboardEnvironment = {
  clipboard?: Pick<Clipboard, "writeText">;
  document: Pick<Document, "body" | "createElement" | "execCommand">;
};

/** Copies text with a DOM fallback; success is reported only after a real copy attempt succeeds. */
export async function copyText(text: string, environment: ClipboardEnvironment): Promise<boolean> {
  try {
    if (environment.clipboard?.writeText) {
      await environment.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the temporary textarea fallback.
  }

  try {
    const textarea = environment.document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    environment.document.body.appendChild(textarea);
    textarea.select();
    const copied = environment.document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
