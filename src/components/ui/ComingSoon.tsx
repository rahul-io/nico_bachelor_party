import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

export function ComingSoon({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <Icon className="size-10 text-accent" aria-hidden />
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="max-w-64 text-muted">{body}</p>
    </Card>
  );
}
