export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    if (!q) return Response.json({ error: "Missing q" }, { status: 400 });

    // Wikimedia Commons API: search images
    const api = new URL("https://commons.wikimedia.org/w/api.php");
    api.searchParams.set("action", "query");
    api.searchParams.set("format", "json");
    api.searchParams.set("origin", "*");
    api.searchParams.set("generator", "search");
    api.searchParams.set("gsrsearch", q);
    api.searchParams.set("gsrlimit", "1");
    api.searchParams.set("gsrnamespace", "6"); // File namespace (images)
    api.searchParams.set("prop", "imageinfo");
    api.searchParams.set("iiprop", "url");
    api.searchParams.set("iiurlwidth", "800"); // thumbnail width

    const res = await fetch(api.toString(), { cache: "no-store" });
    if (!res.ok) {
      return Response.json({ error: "Wikimedia request failed" }, { status: 502 });
    }

    const json: any = await res.json();
    const pages = json?.query?.pages;
    const firstKey = pages ? Object.keys(pages)[0] : null;
    const page = firstKey ? pages[firstKey] : null;
    const info = page?.imageinfo?.[0];

    const imageUrl = info?.thumburl || info?.url || null;

    return Response.json({ imageUrl });
  } catch (e: any) {
    return Response.json(
      { error: "Failed to fetch image", message: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
