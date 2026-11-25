import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMemberCode, MEMBER_CODE_PATTERN, normaliseMemberCode } from "@/lib/member-code";

describe("member ID", () => {
  it("has the SOAR-YY-XXXXXX shape with the joining year", () => {
    expect(generateMemberCode(new Date("2026-11-24T10:00:00Z"))).toMatch(/^SOAR-26-[A-Z2-9]{6}$/);
    expect(generateMemberCode(new Date("2031-01-01T00:00:00Z")).startsWith("SOAR-31-")).toBe(true);
  });
  it("never uses look-alike characters and rarely repeats", () => {
    const codes = Array.from({ length: 5000 }, () => generateMemberCode());
    for (const c of codes) {
      expect(c).toMatch(MEMBER_CODE_PATTERN);
      expect(c.slice(8)).not.toMatch(/[01OIL]/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("normalises what people type", () => {
    expect(normaliseMemberCode("soar 26 7k4qxm")).toBe("SOAR-26-7K4QXM");
    expect(normaliseMemberCode("SOAR267K4QXM")).toBe("SOAR-26-7K4QXM");
    expect(normaliseMemberCode(" SOAR-26-7K4QXM ")).toBe("SOAR-26-7K4QXM");
    expect(normaliseMemberCode("SOAR-26-7K4QX0")).toBeNull(); // 0 is never used
    expect(normaliseMemberCode("amina@example.com")).toBeNull();
  });
});

describe("Resend email provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("posts the message to the Resend API with an idempotency key and returns its id", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "SOAR Hub <onboarding@resend.dev>");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const { sendEmail } = await import("@/lib/integrations/email");
    const res = await sendEmail({ to: "amina@example.com", subject: "Hi", text: "Body", html: "<p>Body</p>", idempotencyKey: "k1" });
    expect(res).toMatchObject({ provider: "resend", messageId: "msg_123" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k1");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: "SOAR Hub <onboarding@resend.dev>", to: ["amina@example.com"], subject: "Hi" });
  });
  it("reports a clear, non-retryable error when Resend rejects the sender", async () => {
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_PROVIDER_API_KEY", "re_test_key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ name: "validation_error", message: "The domain is not verified" }), { status: 403 })));
    vi.resetModules();
    const { sendEmail } = await import("@/lib/integrations/email");
    await expect(sendEmail({ to: "a@b.co", subject: "s", text: "t", html: "h", idempotencyKey: "k" })).rejects.toThrow(/Resend error 403.*not verified/);
  });
});

describe("SMTP (Gmail) email provider", () => {
  afterEach(() => {
    vi.doUnmock("nodemailer");
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const setup = (sendMail: (o: Record<string, unknown>) => Promise<unknown>) => {
    const createTransport = vi.fn(() => ({ sendMail }));
    vi.doMock("nodemailer", () => ({ default: { createTransport }, createTransport }));
    vi.stubEnv("EMAIL_PROVIDER", "smtp");
    vi.stubEnv("SMTP_USER", "soar.sender@gmail.com");
    vi.stubEnv("SMTP_PASSWORD", "abcd efgh ijkl mnop");
    vi.stubEnv("EMAIL_FROM", "SOAR Hub <soar.sender@gmail.com>");
    vi.resetModules();
    return createTransport;
  };
  it("sends through smtp.gmail.com:465 with the App Password (spaces removed)", async () => {
    const sendMail = vi.fn(async () => ({ messageId: "<abc@gmail.com>", response: "250 OK" }));
    const createTransport = setup(sendMail);
    const { sendEmail } = await import("@/lib/integrations/email");
    const res = await sendEmail({ to: "anyone@example.com", subject: "Hi", text: "Body", html: "<p>Body</p>", idempotencyKey: "k" });
    expect(res).toMatchObject({ provider: "smtp", messageId: "<abc@gmail.com>" });
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "soar.sender@gmail.com", pass: "abcdefghijklmnop" } }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: "SOAR Hub <soar.sender@gmail.com>", to: "anyone@example.com", subject: "Hi" }));
  });
  it("explains a rejected Gmail login", async () => {
    setup(async () => {
      throw Object.assign(new Error("Invalid login: 535-5.7.8 Username and Password not accepted"), { code: "EAUTH", responseCode: 535 });
    });
    const { sendEmail } = await import("@/lib/integrations/email");
    await expect(sendEmail({ to: "a@b.co", subject: "s", text: "t", html: "h", idempotencyKey: "k" })).rejects.toThrow(/App Password/);
  });
});
