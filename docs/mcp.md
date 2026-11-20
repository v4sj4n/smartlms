# The OptimoLMS MCP server

The backend is an MCP server. Its tools are the backend's own create actions, so
the assistant can build real course content — not just talk about it — and any
MCP client can drive the same actions.

## Where it lives

| Thing | Value |
|---|---|
| Endpoint | `POST /api/mcp` (JSON-RPC 2.0, Streamable HTTP transport, JSON responses) |
| Protocol version | `2025-06-18` |
| Catalogue for the UI | `GET /api/mcp/tools` |
| Catalogue row | `mcp_apps.key = 'optimolms'` (migration `000018_mcp_optimolms`) |
| Registry | `backend/internal/handler/mcp_tools.go` |
| Transport + JSON-RPC | `backend/internal/handler/mcp.go` |
| Chat integration | `backend/internal/handler/ai_chat.go` |

Identity comes from the session, like every other route: an MCP client signs in
through `POST /api/auth/login` and then either keeps the `optimolms_session`
cookie a browser would keep, or sends the token from that response as
`Authorization: Bearer <token>`. There is no `user_id` parameter and no identity
header — a caller cannot name an account it is not signed in as (`session.go`,
`docs/STATUS.md` §1.1). A request without a session is answered 401 before the
JSON-RPC endpoint is reached.

`GET /api/mcp` answers `405` on purpose: this server replies with JSON, it does
not hold an SSE stream open.

## Tools

Every tool carries the permission its HTTP twin requires, and runs as the person
who is signed in.

| Tool | Permission | What it does |
|---|---|---|
| `list_subjects` | `subjects.view` | Subjects with their content counts — the entry point, since everything else takes a `subject_id` |
| `create_subject` | `subjects.manage` | Creates a subject; the caller becomes its lecturer |
| `list_weeks` | `subjects.view` | The subject's course weeks |
| `create_week` | `subjects.manage` | Appends a week (number 1–30, dates optional) |
| `create_lecture` | `lectures.manage` | Adds a lecture, optionally scheduled and filed under a week |
| `create_assignment` | `assignments.manage` | Adds a published assignment with due date, points, submission type |
| `create_quiz` | `quizzes.manage` | Creates the quiz shell |
| `add_quiz_question` | `quizzes.manage` | Appends an `mcq`, `true_false` or `short_answer` question |
| `create_flashcard_set` | `flashcards.manage` | Creates a titled set of front/back cards in a single call |
| `create_forum_thread` | `forums.moderate` | Starts a topic, creating the subject's forum on first use |
| `post_forum_reply` | `forums.post` | Replies to a thread as the signed-in user |

A tool the caller's permissions do not cover is not listed by `tools/list`, and
`tools/call` on it answers an error result (`isError: true`) with the missing
permission named. Tool failures come back the same way: the model is told what
the backend refused, and it reports that to the user instead of retrying with
different arguments.

## How the assistant uses it

The MCP tab on `/assistant` shows the server, its endpoint and its tools, and
holds the switch: a person connects OptimoLMS there (`user_mcp_apps` with
`app_key = 'optimolms'`).

`POST /api/ai/chat` then:

1. offers the tools the caller's permissions cover (`visibleMCPTools`),
2. streams a turn, collecting any tool calls and their arguments,
3. runs each call through the same registry, emitting `tool-input-start`,
   `tool-input-available` and `tool-output-available` on the UI message stream,
4. feeds the results back and streams the next turn — capped at six rounds.

Before the switch, no tools are offered at all, and the system prompt tells the
assistant to point the user at *AI assistant › MCP* when they ask for content to
be created.

## Adding a tool

Add one entry to `mcpTools()` in `mcp_tools.go`: name, title, description, the
module it belongs to, the permission key, the JSON Schema, and a `Run` that
writes through the same tables the screens write through. Nothing else needs to
change — the JSON-RPC endpoint, the chat loop and the MCP tab all read that
registry.
