import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * دخول المالك المباشر — لا يمر بقاعدة البيانات.
 * البريد وكلمة السر محفوظان كسرَّين على الخادم فقط.
 */

type OwnerSession = { owner?: boolean; email?: string };

function sessionConfig() {
  return {
    password: process.env["OWNER_SESSION_SECRET"]!,
    name: "tvcc-owner",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const ownerSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }) => {
    const email = process.env["OWNER_EMAIL"];
    const password = process.env["OWNER_PASSWORD"];
    if (!email || !password) return { ok: false as const, reason: "not_configured" as const };

    const okEmail = matches((data.email || "").trim().toLowerCase(), email.trim().toLowerCase());
    const okPassword = matches(data.password || "", password);
    if (!okEmail || !okPassword) return { ok: false as const, reason: "invalid" as const };

    const session = await useSession<OwnerSession>(sessionConfig());
    await session.update({ owner: true, email: email.trim().toLowerCase() });
    return { ok: true as const, email: email.trim().toLowerCase() };
  });

export const getOwnerSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await useSession<OwnerSession>(sessionConfig());
    return { owner: Boolean(session.data.owner), email: session.data.email ?? null };
  } catch {
    return { owner: false, email: null };
  }
});

export const ownerSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<OwnerSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
