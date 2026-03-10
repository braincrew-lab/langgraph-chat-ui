import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: process.env.SERVER_ACTION_BODY_SIZE_LIMIT || "10mb",
    },
  },
  async headers() {
    const securityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: process.env.SECURITY_HEADER_CONTENT_TYPE_OPTIONS || "nosniff",
      },
      {
        key: "Referrer-Policy",
        value:
          process.env.SECURITY_HEADER_REFERRER_POLICY ||
          "strict-origin-when-cross-origin",
      },
    ];

    // X-Frame-Options: set to empty string to disable (e.g., for iframe embedding)
    const xFrameOptions =
      process.env.SECURITY_HEADER_X_FRAME_OPTIONS ?? "DENY";
    if (xFrameOptions) {
      securityHeaders.push({
        key: "X-Frame-Options",
        value: xFrameOptions,
      });
    }

    // Content-Security-Policy: set to empty string to disable
    const csp =
      process.env.SECURITY_HEADER_CSP ?? "frame-ancestors 'none'";
    if (csp) {
      securityHeaders.push({
        key: "Content-Security-Policy",
        value: csp,
      });
    }

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
