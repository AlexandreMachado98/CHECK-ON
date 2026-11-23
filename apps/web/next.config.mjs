/** @type {import('next').NextConfig} */
const securityHeaders = [
  // O portal nunca é aberto dentro de outro site (evita clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Links para fora não levam o endereço da tela (que pode ter ids e o token do crachá).
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Crachá público: não entra em buscadores nem em cache compartilhado.
      { source: '/badge/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Referrer-Policy', value: 'no-referrer' }] },
    ];
  },
};

export default nextConfig;

