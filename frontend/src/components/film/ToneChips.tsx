"use client";

interface Genre {
  id: number;
  name: string;
}

interface ToneChipsProps {
  genres: Genre[];
}

export default function ToneChips({ genres }: ToneChipsProps) {
  if (genres.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {genres.map((genre) => (
        <span
          key={genre.id}
          className="inline-block rounded-full bg-glass-8 px-2.5 py-0.5 text-xs font-medium text-glass-55 border border-glass-6/50"
        >
          {genre.name}
        </span>
      ))}
    </div>
  );
}
