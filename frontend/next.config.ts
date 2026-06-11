import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todo el fetching de datos es client-side (Mapbox + Laravel API).
  // No usamos Node.js APIs en el servidor → compatible con el edge runtime de Cloudflare Workers.
};

export default nextConfig;
