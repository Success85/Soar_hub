"use server";

import { toActionError, type ActionResult } from "@/lib/errors";
import { getRequestMeta } from "@/lib/request";
import { submitContact } from "@/lib/services/content";

export async function contactAction(_: unknown, fd: FormData): Promise<ActionResult> {
  try {
    await submitContact(
      { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), subject: String(fd.get("subject") ?? ""), message: String(fd.get("message") ?? ""), website: String(fd.get("website") ?? "") },
      (await getRequestMeta()).ip,
    );
    return { ok: true, message: "Thank you — your message has been received. We aim to reply within three working days." };
  } catch (e) {
    return toActionError(e);
  }
}
