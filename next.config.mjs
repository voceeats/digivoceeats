/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "payfood.us" }],
        destination: "https://www.digivoceeats.com/pay",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.payfood.us" }],
        destination: "https://www.digivoceeats.com/pay",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
