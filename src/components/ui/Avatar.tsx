import { cn } from "@/lib/cn";

const sizes = {
  sm: "size-9 text-sm",
  md: "size-11 text-base",
  lg: "size-20 text-2xl",
};

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised font-semibold text-accent ring-1 ring-line",
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads; sizes are tiny
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
