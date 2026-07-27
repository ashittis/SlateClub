# community/models — tables owned by the community slice

Each file defines the SQLAlchemy tables for one community surface. They inherit
`Base` from `app.core.database` and are registered in `app/models_registry.py`.

| File | Tables |
|---|---|
| `posts.py` | `Post`, `PostReply`, `PostUpvote` (+ `POST_TYPES` constant) |
| `discourse.py` | `HotTake`, `HotTakeReaction`, `Poll`, `PollVote`, `ReviewVote` |
| `circles.py` | `TasteCircle`, `TasteCircleMember`, `TasteCircleMessage` |
| `chapters.py` | `Chapter`, `ChapterMember`, `ChapterEvent` |
| `festivals.py` | `Festival`, `FestivalPost` |
| `dms.py` | `FilmDM` (a shared film + note between two users) |
| `chat.py` | `ChatConversation`, `ChatMessage` |

All reference `User` (from `shared/models/user`) by foreign key; `dms.py` also references
`Movie`.
