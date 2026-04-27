"use client";

export async function exportSlideToPng(
  slideElement: HTMLElement,
  fileName: string
): Promise<void> {
  if (!slideElement) {
    throw new Error("No slide selected for export");
  }

  await waitForImages(slideElement);

  // Dynamic import keeps html2canvas out of the initial bundle.
  const html2canvas = (await import("html2canvas")).default;

  const canvas = await html2canvas(slideElement, {
    scale: Math.min(2, window.devicePixelRatio || 2),
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: "#ffffff",
    width: slideElement.offsetWidth,
    height: slideElement.offsetHeight,
    windowWidth: document.documentElement.clientWidth,
    windowHeight: document.documentElement.clientHeight,
  });

  const blob = await canvasToBlob(canvas);
  if (!blob) {
    throw new Error("Failed to render slide image");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        })
    )
  ).then(() => undefined);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 1);
  });
}
