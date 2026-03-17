import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/plugin/",
          "/bookmarks",
          "/notifications",
          "/settings",
          "/admin/",
          "/accept-invite",
          "/reset-password",
          "/test",
          "/_next/",
        ],
      },
    ],
    sitemap: "https://researchopia.com/sitemap.xml",
  };
}
