# AI providers: connect, verify, and stay connected

The assistant gets its brain from an OpenAI-compatible endpoint. A provider row
(`ai_providers`) is a base URL plus an encrypted key; its models (`ai_models`)
are what chat may actually pick from. This document describes the setup flow
added in `000020_ai_provider_health`, and why it is shaped that way.

Two rules drive the design:

1. **Nothing is stored that has not answered.** A key is checked against the
   endpoint's model list before it is written. A refused key leaves the database
   exactly as it was, so a typo in a replacement key cannot take a working
   provider offline.
2. **Connecting is the same act as turning the feature on.** A verified provider
   is enabled and has a starter set of models switched on, so there is no second
   screen of toggles between "I pasted a key" and "chat works".

## Presets in the connect dialog

| Tile | Base URL | Notes |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | GPT models |
| Anthropic | `https://api.anthropic.com/v1` | Claude through Anthropic's OpenAI-compatible layer |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | Google Gemini's OpenAI-compatible endpoint |
| Grok | `https://api.x.ai/v1` | xAI |
| Mistral | `https://api.mistral.ai/v1` | Mistral models |
| Others | *(blank)* | Any OpenAI-compatible endpoint; type name and base URL |

A tile only fills in name and base URL — the key is always typed by the admin,
still verified against `GET {base_url}/models` before anything is stored, and
switching tiles clears a key typed for the previous provider.

All five vendor endpoints accept `Authorization: Bearer <key>` on their model
list (checked against each host without a valid key: they answer 401/400 rather
than 404), which is what makes them usable with one OpenAI-compatible client.
Anthropic's layer is documented for Chat Completions; if its model list is ever
withdrawn, the connect step will say so plainly (the failure is classified, not
guessed) and "Save without verifying" still stores the key.

## The flow

```
Pick a preset (or type name + base URL) and paste the key
        │
        ▼
POST /api/ai/providers/connect
        │
        ├── GET {base_url}/models          ← the key is verified here, first
        │      ├── 401/403  → 422 invalid_key
        │      ├── 404/405  → 422 endpoint_missing
        │      ├── timeout  → 422 timeout
        │      ├── 5xx/unreachable → 422 unreachable
        │      └── 200      → chat models only (embeddings, whisper, tts,
        │                     image, moderation, rerank are filtered out)
        │
        ├── refused and no `allow_unverified` → nothing is written
        └── accepted
               ├── provider row: encrypted key, key_hint, is_enabled = 1,
               │                 health = ok, checked_at = now
               ├── catalogue: every discovered model stored
               └── starter set: one fast/cheap model as the default, plus one
                   flagship when the catalogue has one
```

The response names what happened, so the UI can say it in one line:

```json
{
  "provider": { "...": "the full row, with health and enabled_model_count" },
  "provider_id": "…",
  "code": "ok",
  "enabled_models": ["gpt-4o-mini", "gpt-4o"],
  "default_model": "gpt-4o-mini"
}
```

## Endpoints

| Call | What it does |
|---|---|
| `GET /api/ai/providers?scope=institutional\|personal` | Rows with `model_count`, `enabled_model_count`, `health`, `health_detail`, `checked_at` — enough for a status pill without a second request per provider. |
| `POST /api/ai/providers/connect` | Create + verify + discover + starter set, one call. `{scope, name, base_url, api_key, preset?, allow_unverified?}`. |
| `PUT /api/ai/providers/{id}/key` | Rotate a key. Verified first; on failure 422 and the old cipher, hint and health are untouched (`kept_existing: true`). |
| `POST /api/ai/providers/{id}/test` | Check the stored key without re-pasting it. Records `health`/`checked_at`, refreshes the catalogue, and returns `{ok, code, message, ...}` with HTTP 200 — a failed check is a report, not a server error. |
| `POST /api/ai/providers/{id}/models/bulk` | `{action: enable \| disable \| enable_all \| disable_all \| enable_recommended, model_ids?}` — one request instead of a PATCH per row. |
| `PATCH /api/ai/models/{id}` | Single model toggle, or promote it to the provider default. |

Institutional rows need `assistant.configure`; a personal row is managed only by
its owner and a person may hold one. `POST /api/ai/chat` still needs
`assistant.use`, checked in the handler before any provider is touched.

## Verification outcomes

Stored in `ai_providers.health` (`""` = never checked) and shown as the pill:

| Code | Pill | What it means |
|---|---|---|
| `ok` | `Ready · N models` (or `No models on`) | The key works and at least one model is on. |
| `invalid_key` | `Invalid key` | 401/403/400 — copy the key again from the provider. |
| `endpoint_missing` | `Wrong base URL` | 404/405 — the URL usually ends in `/v1`. |
| `unreachable` | `Unreachable` | DNS, TLS or connection failure, or a 5xx from the provider. |
| `timeout` | `Timed out` | The endpoint did not answer within 20s. |
| `rate_limited` | `Rate limited` | HTTP 429 — the key is fine, the quota is not. |
| `no_models` | `No models` | The endpoint answered but listed nothing chat-capable. |

A provider that is switched off shows `Disabled` regardless of health, because
what matters for a chat request is whether it is on.

## When the assistant is offered

`GET /api/ai/chat-models` also answers *whether chat can work*, so no chat
surface has to guess:

```json
{ "providers": [], "default_model_id": null, "ready": false, "reason": "no_model" }
```

| `reason` | Meaning | What the UI does |
|---|---|---|
| `""` (`ready: true`) | Enabled provider + key + at least one enabled model | Floating button and `/chat` are live |
| `no_provider` | Nothing configured at all | Both hidden; `/chat` explains setup, with a link for admins |
| `inactive_provider` | Provider exists but is switched off or has no key | Same, naming the provider as the problem |
| `no_model` | Provider is usable, every model is off | Same, naming the model list |

`useAssistantAccess()` (`frontend/src/chat/access.ts`) combines that with
`assistant.use`: the floating launcher renders only when the person may use the
assistant **and** a model can answer, and it renders nothing while the answer is
still loading rather than flashing and disappearing. The same flag gates the
sidebar entry (`buildNavItems(..., assistantReady)` in `frontend/src/modules.ts`),
so an assistant with nothing to answer with is not advertised anywhere; the
people who can fix that still reach the setup screen from Settings › AI →
Manage providers. `/chat` keeps the
permission page for `assistant.use` and adds the setup page for the three
readiness reasons. The assistant settings page (`/assistant`) stays reachable
regardless — it is where the problem gets fixed.

`POST /api/ai/chat` was already closed to anyone without `assistant.use`; this
only stops the UI from offering a conversation that cannot be answered.

## Model choice

- **Starter set** (`ai.Starter`): one fast/cheap model (`gpt-4o-mini`,
  `claude-3-5-haiku`, `gemini-*-flash`, `llama-3.3-70b`, …) as the default, plus
  one flagship (`gpt-4o`, `claude-sonnet-4`, `gemini-*-pro`, …). Dated variants
  are matched by substring, shortest id wins. A catalogue matching neither
  preference still gets its first chat model, so connecting never ends with zero
  models.
- **Never override a decision.** Discovery adds models and never disables one.
  The starter set is applied only while the provider has no default and no
  enabled model; after that, only an explicit action changes the selection.
- **The default is respected even when it is off.** `resolveAIModel` (in
  `ai_chat.go`) falls back to the first enabled model if the stored default has
  since been switched off, and disabling a model clears it from being the
  default. Chat never reaches for a model the catalogue says is unavailable.

## Tests

`backend/internal/handler/ai_providers_test.go` drives the flow against a fake
endpoint: a good key enables the starter pair, a 401 stores nothing, a 404
reports `endpoint_missing`, a refused rotation keeps the working key, the test
endpoint records health, bulk actions keep the default coherent, and a student
can connect a personal provider but not an institutional one.
`backend/internal/ai/models_test.go` covers the chat-model filter and the
starter recommendation.
