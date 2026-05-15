import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["wink-nlp", "wink-eng-lite-web-model", "pdf-parse", "adm-zip"],
};

export default nextConfig;
