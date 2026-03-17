import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllGuidePaths } from "@/app/guide/guide-config";

const BASE_URL = "https://researchopia.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/papers`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/webpages`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/feed`, changeFrequency: "hourly", priority: 0.7 },
    { url: `${BASE_URL}/search`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE_URL}/academic-navigation`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/guide`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/updates`, changeFrequency: "weekly", priority: 0.4 },
  ];

  // Guide pages from config
  const guidePaths = getAllGuidePaths();
  const guidePages: MetadataRoute.Sitemap = guidePaths.map((p) => ({
    url: `${BASE_URL}/guide/${p.category}/${p.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Dynamic pages from database
  let paperPages: MetadataRoute.Sitemap = [];
  let profilePages: MetadataRoute.Sitemap = [];
  let webpagePages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    const { data: papers } = await supabase
      .from("papers")
      .select("doi, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    paperPages = (papers || []).map((p: { doi: string; updated_at: string | null }) => ({
      url: `${BASE_URL}/papers/${encodeURIComponent(p.doi)}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("username, updated_at")
      .not("username", "is", null)
      .limit(5000);

    profilePages = (profiles || []).map((p: { username: string; updated_at: string | null }) => ({
      url: `${BASE_URL}/profile/${encodeURIComponent(p.username)}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));

    const { data: webpages } = await supabase
      .from("webpages")
      .select("url_hash, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);

    webpagePages = (webpages || []).map((w: { url_hash: string; updated_at: string | null }) => ({
      url: `${BASE_URL}/webpages/${w.url_hash}`,
      lastModified: w.updated_at ? new Date(w.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    }));
  } catch {
    // Database unavailable — return static pages only
  }

  return [...staticPages, ...guidePages, ...paperPages, ...profilePages, ...webpagePages];
}
