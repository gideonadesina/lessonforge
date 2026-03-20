export default function sitemap() {
  const base = "https://lessonforge.app";

  return [
    { url: `${base}/`, lastModified: new Date() },
      { url: `${base}/select-role`, lastModified: new Date() },
    { url: `${base}/auth/teacher`, lastModified: new Date() },
    { url: `${base}/auth/principal`, lastModified: new Date() },
    { url: `${base}/principal`, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
  ];
}
