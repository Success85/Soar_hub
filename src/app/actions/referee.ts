"use server";

import { toActionError, type ActionResult } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request";
import { submitRefereeLetter } from "@/lib/services/referees";

export async function refereeUploadAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose your letter file to upload.", fieldErrors: { file: "Required" } };
    if (fd.get("declaration") !== "on") return { ok: false, error: "Please confirm the declaration.", fieldErrors: { declaration: "Required" } };
    await submitRefereeLetter(String(fd.get("token") ?? ""), file, String(fd.get("confirmedName") ?? ""), await getRequestMeta());
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
