export type SlateCoverLayout = "mosaic_4" | "stack_3" | "spiral";
export type SlateVisibility = "public" | "unlisted" | "private";

export interface SlateCreator {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface SlateCollaborator extends SlateCreator {
  role: string;
}

export interface SlateCard {
  id: string;
  title: string;
  description: string | null;
  coverLayout: SlateCoverLayout;
  visibility: SlateVisibility;
  isCollaborative: boolean;
  filmCount: number;
  saveCount: number;
  likeCount: number;
  likedByMe: boolean;
  collaboratorCount: number;
  createdAt: string;
  updatedAt: string;
  coverPosters: string[];
  creator: SlateCreator | null;
}

export interface SlateFilm {
  tmdbId: number;
  mediaType: "movie" | "tv";
  note: string | null;
  position: number;
  addedAt: string;
  title: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  originalLanguage: string | null;
}

export interface SlateDetail extends SlateCard {
  films: SlateFilm[];
  savedByMe: boolean;
  canEdit: boolean;
  collaborators: SlateCollaborator[];
}

export interface SlateRoomMessage {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  user: SlateCreator;
}
