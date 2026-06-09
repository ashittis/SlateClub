export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterPath: string | null;
  airDate: string | null;
}

export interface Series {
  id: string;
  tmdbId: number;
  mediaType: "tv";
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  originalLanguage: string | null;
  numberOfSeasons: number | null;
  genres: { id: number; name: string }[] | null;
  credits: {
    director?: { id: number; name: string; job: string };
    cast: { id: number; name: string; character: string; profile_path: string | null; order: number }[];
  } | null;
  seasons: SeasonSummary[];
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string | null;
  stillPath: string | null;
  airDate: string | null;
  community: number | null;
}

export interface SeasonDetail {
  seasonNumber: number;
  name: string;
  overview: string | null;
  episodes: Episode[];
}

/** The current user's ratings for a whole series (from /api/series/{id}/my-ratings). */
export interface SeriesMyRatings {
  overall: number | null;
  seasons: Record<string, number>; // "1" -> 4.5
  episodes: Record<string, number>; // "1:3" -> 9.0
  reactions: Record<string, string>; // "1:3" -> "peak"
}
