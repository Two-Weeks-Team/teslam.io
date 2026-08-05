import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";
import { capturedAt } from "@/lib/economics";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(capturedAt);
  const languages = { ko: `${SITE}/`, en: `${SITE}/en` };

  return [
    {
      url: `${SITE}/`,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
      alternates: { languages },
    },
    {
      url: `${SITE}/en`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.9,
      alternates: { languages },
    },
  ];
}
