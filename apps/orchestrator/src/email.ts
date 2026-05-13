/**
 * Transactional email. Uses Resend (resend.com) when RESEND_API_KEY is set;
 * otherwise logs the rendered email to the console so the operator can still
 * recover a password-reset link from `pm2 logs seo-orchestrator`.
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. */
  text?: string;
}

export async function sendEmail(args: SendArgs): Promise<{ sent: boolean; detail: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Seowebsitesbuilder <noreply@seowebsitesbuilder.com>";

  if (!apiKey) {
    console.log(`[email] (no RESEND_API_KEY) ${from} -> ${args.to} :: ${args.subject}`);
    if (args.text) console.log(`[email] text: ${args.text}`);
    else console.log(`[email] html: ${args.html}`);
    return { sent: false, detail: "RESEND_API_KEY not set; email logged to console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[email] resend ${res.status}: ${body}`);
      return { sent: false, detail: `Resend ${res.status}` };
    }
    return { sent: true, detail: "sent via resend" };
  } catch (err: any) {
    console.warn(`[email] resend network error: ${err?.message || err}`);
    return { sent: false, detail: String(err?.message || err) };
  }
}
