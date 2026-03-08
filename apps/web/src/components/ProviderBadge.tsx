const PROVIDERS: Record<string, { label: string; color: string }> = {
  spotify: { label: "Spotify", color: "#1DB954" },
  youtube: { label: "YouTube", color: "#FF0000" },
  soundcloud: { label: "SoundCloud", color: "#FF5500" },
  pandora: { label: "Pandora", color: "#3668FF" },
};

interface ProviderBadgeProps {
  provider: string;
  size?: "sm" | "md";
}

export default function ProviderBadge({ provider, size = "sm" }: ProviderBadgeProps) {
  const info = PROVIDERS[provider] ?? { label: provider, color: "#6366f1" };
  const px = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-white ${px}`}
      style={{ backgroundColor: info.color }}
    >
      {info.label}
    </span>
  );
}
