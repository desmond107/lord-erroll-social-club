import { headers } from "next/headers";

/**
 * Cloudflare Turnstile CAPTCHA. Renders nothing until TURNSTILE_SITE_KEY / _SECRET_KEY are
 * set, so local development works without keys. The widget injects a hidden
 * `cf-turnstile-response` input into the surrounding form, verified on the server.
 */
export async function Turnstile() {
  const site = process.env.TURNSTILE_SITE_KEY;
  if (!site) return null;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script nonce={nonce} src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile my-4" data-sitekey={site} data-theme="light" />
    </>
  );
}
