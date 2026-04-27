export async function GET() {
  const res = await fetch("https://api.pexels.com/v1/search?query=education", {
    headers: {
      Authorization: process.env.NEXT_PUBLIC_PEXELS_API_KEY!,
    },
  });

  const data = await res.json();

  return Response.json(data);
}