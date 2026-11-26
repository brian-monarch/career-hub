// Cloudflare Email Worker: forwards each email sent to the ingest address to Career Hub.
// Setup: Cloudflare > Workers & Pages > Create > Worker, paste this file, then add a
// secret variable INGEST_SECRET (same value as in Vercel). In Email Routing, route
// the ingest address to this Worker.
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const res = await fetch("https://monarchcareerhub.com/api/inbound-email", {
      method: "POST",
      headers: { "content-type": "text/plain", "x-ingest-secret": env.INGEST_SECRET, "x-mail-from": message.from },
      body: raw,
    });
    if (!res.ok) console.log(`Career Hub ingest failed (${res.status})`);
  },
};
