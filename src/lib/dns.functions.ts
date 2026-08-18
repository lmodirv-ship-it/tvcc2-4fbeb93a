import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ domain: z.string().min(3).max(253) });

export const verifyDns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { checkDomainOwnership } = await import("./hn-rls.server");
    const res = await checkDomainOwnership(data.domain);
    return { verified: res.verified, method: res.method };
  });
