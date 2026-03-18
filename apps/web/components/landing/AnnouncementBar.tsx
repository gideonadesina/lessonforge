import { Megaphone } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="border-b border-purple-200/60 bg-purple-100/70">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2.5 text-center text-xs font-medium tracking-wide text-purple-900 md:text-sm">
        <Megaphone className="h-3.5 w-3.5" />
        <span>Now supporting WAEC, NECO &amp; Cambridge curriculum</span>
      </div>
    </div>
  );
}
