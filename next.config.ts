import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["wink-nlp", "wink-eng-lite-web-model", "pdf-parse", "adm-zip", "pino", "pino-pretty"],
};

export default nextConfig;
