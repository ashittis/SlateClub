export interface PostUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export type PostType = "text" | "question";

export interface Post {
  id: string;
  title: string | null;
  body: string;
  postType: PostType;
  tmdbId: number | null;
  replyCount: number;
  upvoteCount: number;
  myUpvote: boolean;
  createdAt: string;
  user: PostUser;
}

export interface PostReply {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  user: PostUser;
}
