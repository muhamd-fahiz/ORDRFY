/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dev-mode only (production builds have no such restriction at all -- see
  // README.md's tunnel-testing section). Without this, Next.js blocks a real phone/device
  // on the LAN from loading any client JS/HMR at all -- the page still renders (server HTML
  // arrives fine) but every "use client" component silently has no working click handlers.
  // Confirmed via the dev server's own logs: repeated "Blocked cross-origin request" entries
  // for this exact IP, which is exactly what made the marketing FAQ/vertical-tabs taps do
  // nothing on a real phone. Update this IP if the testing device's LAN address changes.
  // "*.trycloudflare.com" allow-lists every quick-tunnel hostname Cloudflare hands out (a
  // new random one each time `cloudflared tunnel --url ...` runs), so dev mode keeps
  // working through the tunnel too -- confirmed live against a real tunnel, not assumed.
  allowedDevOrigins: ["192.168.1.107", "*.trycloudflare.com"],
};

export default nextConfig;
