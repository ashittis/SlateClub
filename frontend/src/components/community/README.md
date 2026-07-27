# community components — posts

Building blocks for the community post surfaces (feed-style posts with composer).

## Components
- **`PostCard.tsx`** — renders a single post (author, body, film reference, replies/upvotes).
- **`PostComposer.tsx`** — the composer to write a new post, optionally attaching a film.
  Post-type selector covers the body-based kinds (post/question/discussion/review/fan theory/news).
- **`PostTypeBadge.tsx`** — colour-coded flair for a post's kind (pill taxonomy; `text` shows none).

## Notes
- Composer supports attaching a film reference; posts animate in with Framer Motion.
- Calls the community `posts` endpoints.
