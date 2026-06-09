export type MediaType = "movie" | "tv";

export interface Movie {
  id: string;
  tmdbId: number;
  mediaType?: MediaType;
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  originalLanguage: string | null;
  genres: { id: number; name: string }[] | null;
  credits: {
    director?: { id: number; name: string; job: string };
    cast: { id: number; name: string; character: string; profile_path: string | null; order: number }[];
  } | null;
}

export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
  genres: { id: number; name: string }[];
}

export interface TmdbSearchResult {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbMovie[];
}