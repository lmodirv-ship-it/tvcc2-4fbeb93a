import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ domain: z.string().min(3).max(253) });

async function doh(name: string, type: "CNAME" | "TXT") {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url, { headers: { accept: "application/dns-json" } });
  if (!res.ok) return [];
  const data: any = await res.json();
  return (data.Answer || []) as Array<{ data: string; type: number }>;
}

export const verifyDns = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const domain = data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const target = `_tvcc.${domain}`;
    const expectedCname = "network.tvcc.ma";
    const expectedTxt = "tvcc-network=enabled";

    const [cnameAns, txtAns] = await Promise.all([doh(target, "CNAME"), doh(target, "TXT")]);

    const cnameOk = cnameAns.some((a) => a.data.toLowerCase().replace(/\.$/, "").includes(expectedCname));
    const txtOk = txtAns.some((a) => a.data.toLowerCase().includes(expectedTxt));
    return { verified: cnameOk || txtOk, method: cnameOk ? "CNAME" : txtOk ? "TXT" : null };
  });
