/** @type {import('next').NextConfig} */

const nextConfig = {
    images: {
        domains: ['images.unsplash.com'],
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    async redirects() {
        return [
            { source: "/dashboard", destination: "/", permanent: false },
            { source: "/business-reports/pms-login", destination: "/admin/pms-login", permanent: false },
        ];
    },
};

module.exports = nextConfig;
