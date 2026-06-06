export interface ReleaseFilm {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string;
  originalLanguage: string | null;
  voteAverage: number | null;
  popularity: number;
}

export interface ReleaseDay {
  date: string;
  films: ReleaseFilm[];
}

export interface CalendarResponse {
  days: ReleaseDay[];
}
