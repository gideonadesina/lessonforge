import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    // Log to help debug
    console.log("🔍 Unsplash API called with query:", query);

    const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

    if (!UNSPLASH_KEY) {
      console.error("❌ UNSPLASH_ACCESS_KEY not found in environment");
      return NextResponse.json(
        { error: "Unsplash key missing" },
        { status: 500 }
      );
    }

    // Use fallback if no query provided
    const searchQuery = query || "education classroom";

    // Clean the query
    const cleanedQuery = searchQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3) // Allow up to 3 words
      .join(" ");

    console.log("🧹 Cleaned query:", cleanedQuery);

    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      cleanedQuery
    )}&per_page=1&orientation=landscape&content_filter=high`;

    const res = await fetch(unsplashUrl, {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_KEY}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Unsplash API error:", res.status, errorText);
      throw new Error(`Unsplash API failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("📊 Unsplash returned:", data.results?.length, "results");

    const image =
      data.results?.[0]?.urls?.regular ||
      "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200";

    return NextResponse.json({ image, query: cleanedQuery });
  } catch (err) {
    console.error("❌ Error in Unsplash route:", err);
    return NextResponse.json(
      {
        image:
          "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 200 } // Return 200 with fallback image
    );
  }
}