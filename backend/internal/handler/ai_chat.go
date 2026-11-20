package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"

	"smartlms/backend/internal/keycrypt"
	"smartlms/backend/internal/util"
)

// POST /api/ai/chat streams an OpenAI-compatible completion back to the
// frontend as the AI SDK UI Message Stream — the SSE format @ai-sdk/react's
// useChat parses. Provider keys are decrypted in memory only; the user's
// assistant settings plus their page context become the system message.
type aiChatRequest struct {
	UserID   string        `json:"user_id"`
	ModelID  string        `json:"model_id"`
	Messages []aiUIMessage `json:"messages"`
	Context  aiChatContext `json:"context"`
}

type aiUIMessage struct {
	ID    string     `json:"id"`
	Role  string     `json:"role"`
	Parts []aiUIPart `json:"parts"`
}

type aiUIPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type aiChatContext struct {
	Page  string `json:"page"`
	Title string `json:"title"`
}

// streamedToolCall collects one tool call while its arguments trickle in: the
// provider streams the JSON in fragments tagged with a call index.
type streamedToolCall struct {
	id   string
	name string
	args strings.Builder
}

// The provider row as the chat loop needs it, ciphertext included.
type chatProvider struct {
	ID           string
	Scope        string
	Name         string
	BaseURL      string
	APIKeyCipher string
	DefaultModel string
}

// resolveAIProvider: the user's own enabled provider wins over the
// institution's, matching "personal first, institutional second".
func resolveAIProvider(ctx context.Context, db *sql.DB, userID string) (chatProvider, error) {
	const selectClause = `
		SELECT id, scope, name, base_url, api_key_cipher, default_model
		FROM ai_providers
		WHERE is_enabled = 1 AND api_key_cipher IS NOT NULL AND scope = ? %s
		ORDER BY name LIMIT 1`

	var row chatProvider
	personal := fmt.Sprintf(selectClause, "AND owner_user_id = ?")
	err := db.QueryRowContext(ctx, personal, "personal", userID).Scan(
		&row.ID, &row.Scope, &row.Name, &row.BaseURL, &row.APIKeyCipher, &row.DefaultModel)
	if err == nil {
		return row, nil
	}
	if err != sql.ErrNoRows {
		return chatProvider{}, err
	}

	// Institutional fallback: any enabled provider with a stored key.
	institutional := fmt.Sprintf(selectClause, "")
	err = db.QueryRowContext(ctx, institutional, "institutional").Scan(
		&row.ID, &row.Scope, &row.Name, &row.BaseURL, &row.APIKeyCipher, &row.DefaultModel)
	return row, err
}

// The provider's default model, else its first enabled stored model.
func resolveAIModel(ctx context.Context, db *sql.DB, provider chatProvider) (string, error) {
	if provider.DefaultModel != "" {
		return provider.DefaultModel, nil
	}
	var model string
	err := db.QueryRowContext(ctx, `
		SELECT model_id FROM ai_models
		WHERE provider_id = ? AND is_enabled = 1
		ORDER BY model_id LIMIT 1`, provider.ID).Scan(&model)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return model, err
}

// usableProviderClause restricts ai_providers (aliased p) to the ones this
// user may chat through: enabled, keyed, and either theirs or institutional.
// It takes the user id as its single argument.
const usableProviderClause = `p.is_enabled = 1 AND p.api_key_cipher IS NOT NULL
	AND (p.scope = 'institutional' OR (p.scope = 'personal' AND p.owner_user_id = ?))`

// resolveAIModelByID: an explicit pick from the chat's model picker — an
// enabled ai_models row whose provider this user may use.
func resolveAIModelByID(ctx context.Context, db *sql.DB, userID, modelRowID string) (chatProvider, string, error) {
	var row chatProvider
	var model string
	err := db.QueryRowContext(ctx, `
		SELECT p.id, p.scope, p.name, p.base_url, p.api_key_cipher, p.default_model, m.model_id
		FROM ai_models m JOIN ai_providers p ON p.id = m.provider_id
		WHERE m.id = ? AND m.is_enabled = 1 AND `+usableProviderClause,
		modelRowID, userID).Scan(
		&row.ID, &row.Scope, &row.Name, &row.BaseURL, &row.APIKeyCipher, &row.DefaultModel, &model)
	return row, model, err
}

// resolveChatTarget picks provider + model: an explicit, usable model_id
// wins; otherwise the default personal-then-institutional resolution.
func resolveChatTarget(ctx context.Context, db *sql.DB, userID, modelRowID string) (chatProvider, string, error) {
	if modelRowID != "" {
		provider, model, err := resolveAIModelByID(ctx, db, userID, modelRowID)
		if err == nil {
			return provider, model, nil
		}
		if err != sql.ErrNoRows {
			return chatProvider{}, "", err
		}
	}
	provider, err := resolveAIProvider(ctx, db, userID)
	if err != nil {
		return chatProvider{}, "", err
	}
	model, err := resolveAIModel(ctx, db, provider)
	return provider, model, err
}

// defaultChatModelRowID: the ai_models.id the chat would use with no
// model_id, or "" when that model has no enabled row.
func defaultChatModelRowID(ctx context.Context, db *sql.DB, userID string) (string, error) {
	provider, err := resolveAIProvider(ctx, db, userID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	model, err := resolveAIModel(ctx, db, provider)
	if err != nil || model == "" {
		return "", err
	}
	var id string
	err = db.QueryRowContext(ctx, `
		SELECT id FROM ai_models WHERE provider_id = ? AND model_id = ? AND is_enabled = 1`,
		provider.ID, model).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return id, err
}

type chatModelOut struct {
	ID      string `json:"id"`
	ModelID string `json:"model_id"`
}

type chatModelProviderOut struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Scope        string         `json:"scope"`
	DefaultModel string         `json:"default_model"`
	Models       []chatModelOut `json:"models"`
}

type chatModelsOut struct {
	Providers      []chatModelProviderOut `json:"providers"`
	DefaultModelID *string                `json:"default_model_id"`
}

// listChatModels: chat-ready providers (usable, with at least one enabled
// model), personal first then by name, each with its enabled models.
func listChatModels(ctx context.Context, db *sql.DB, userID string) (chatModelsOut, error) {
	out := chatModelsOut{Providers: []chatModelProviderOut{}}
	rows, err := db.QueryContext(ctx, `
		SELECT p.id, p.name, p.scope, p.default_model, m.id, m.model_id
		FROM ai_providers p JOIN ai_models m ON m.provider_id = p.id AND m.is_enabled = 1
		WHERE `+usableProviderClause+`
		ORDER BY CASE p.scope WHEN 'personal' THEN 0 ELSE 1 END, p.name, p.id, m.model_id`, userID)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var provider chatModelProviderOut
		var model chatModelOut
		if err := rows.Scan(&provider.ID, &provider.Name, &provider.Scope, &provider.DefaultModel,
			&model.ID, &model.ModelID); err != nil {
			return out, err
		}
		if n := len(out.Providers); n == 0 || out.Providers[n-1].ID != provider.ID {
			provider.Models = []chatModelOut{}
			out.Providers = append(out.Providers, provider)
		}
		last := &out.Providers[len(out.Providers)-1]
		last.Models = append(last.Models, model)
	}
	if err := rows.Err(); err != nil {
		return out, err
	}
	defaultID, err := defaultChatModelRowID(ctx, db, userID)
	if err != nil {
		return out, err
	}
	if defaultID != "" {
		out.DefaultModelID = &defaultID
	}
	return out, nil
}

// reasoningDelta pulls reasoning text that OpenAI-compatible servers put on
// the delta outside the typed struct ("reasoning_content" or "reasoning").
func reasoningDelta(raw string) string {
	if raw == "" || !strings.Contains(raw, "reasoning") {
		return ""
	}
	var fields struct {
		ReasoningContent *string `json:"reasoning_content"`
		Reasoning        *string `json:"reasoning"`
	}
	if json.Unmarshal([]byte(raw), &fields) != nil {
		return ""
	}
	if fields.ReasoningContent != nil && *fields.ReasoningContent != "" {
		return *fields.ReasoningContent
	}
	if fields.Reasoning != nil {
		return *fields.Reasoning
	}
	return ""
}

// estimateTokens: roughly four characters per token, rounded up.
func estimateTokens(text string) int64 {
	n := int64(utf8.RuneCountInString(text))
	return (n + 3) / 4
}

// buildAIChatSystemPrompt: identity + personalization + stored prompt + the page
// the user was on + what the MCP tools let the assistant actually do, all kept
// inside the permissions the user holds.
func buildAIChatSystemPrompt(page, title string, s *aiSettingsOut, scope accessScope) string {
	var b strings.Builder
	b.WriteString("You are " + s.AssistantName + ", the assistant inside SmartLMS.")
	if s.DisplayName != "" {
		fmt.Fprintf(&b, " The user's name is %s; address them by it.", s.DisplayName)
	}
	if s.Occupation != "" {
		fmt.Fprintf(&b, " They work or study as: %s.", s.Occupation)
	}
	if len(s.Traits) > 0 {
		fmt.Fprintf(&b, " Match this communication style: %s.", strings.Join(s.Traits, ", "))
	}
	if s.Notes != "" {
		fmt.Fprintf(&b, " Extra context about the user: %s", s.Notes)
	}
	if s.SystemPrompt != "" {
		b.WriteString("\n\n" + s.SystemPrompt)
	}
	// The assistant answers inside the user's own permissions, never beyond.
	if len(scope.Modules) > 0 || len(scope.Permissions) > 0 {
		b.WriteString("\n\nAccess limits you must respect:")
		if len(scope.Modules) > 0 {
			fmt.Fprintf(&b, " the user's SmartLMS modules are %s;", strings.Join(scope.Modules, ", "))
		}
		if len(scope.Permissions) > 0 {
			fmt.Fprintf(&b, " their permissions are %s;", strings.Join(scope.Permissions, ", "))
		}
		b.WriteString(" help only with what those cover.")
		b.WriteString(" If they ask for something outside their permissions, say plainly that you cannot help with it in their account and suggest they ask an administrator for access. Never invent data, records or screens they cannot see.")
	}
	if page != "" {
		fmt.Fprintf(&b, "\n\nThe user reached you from the SmartLMS page '%s'", page)
		if title != "" {
			fmt.Fprintf(&b, " while viewing '%s'. Use that material as context when it is relevant, and offer to explain or summarise it.", title)
		} else {
			b.WriteString(".")
		}
	}
	return b.String()
}

// registerAIChat wires the streaming endpoint.
func registerAIChat(mux *http.ServeMux, db *sql.DB, crypt *keycrypt.Crypt) {
	mux.HandleFunc("GET /api/ai/chat-models", func(w http.ResponseWriter, r *http.Request) {
		userID := strings.TrimSpace(r.URL.Query().Get("user_id"))
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		out, err := listChatModels(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Models could not be listed."})
			return
		}
		writeJSON(w, http.StatusOK, out)
	})

	mux.HandleFunc("POST /api/ai/chat", func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		var req aiChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		// The assistant is permission-gated: without assistant.use the user
		// never reaches a provider, whatever the UI shows.
		ctx := r.Context()
		userID := strings.TrimSpace(req.UserID)
		if userID == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		scope, err := loadAccessScope(ctx, db, userID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unknown user"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Permissions could not be read."})
			return
		}
		if !slices.Contains(scope.Permissions, PermAssistantUse) {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "Your account does not hold the " + PermAssistantUse + " permission, so the assistant is unavailable. Ask an administrator for access.",
			})
			return
		}

		// SSE from here on: failures ride in-band as UI message stream events.
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("X-Accel-Buffering", "no")
		w.Header().Set("x-vercel-ai-ui-message-stream", "v1")
		w.WriteHeader(http.StatusOK)
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}
		emit := func(event map[string]any) {
			payload, _ := json.Marshal(event)
			fmt.Fprintf(w, "data: %s\n\n", payload)
			flusher.Flush()
		}
		finish := func() {
			fmt.Fprint(w, "data: [DONE]\n\n")
			flusher.Flush()
		}
		fail := func(message string) {
			emit(map[string]any{"type": "error", "errorText": message})
			finish()
		}

		settings, err := loadAISettings(ctx, db, userID)
		if err != nil {
			fail("Assistant settings could not be loaded.")
			return
		}

		provider, model, err := resolveChatTarget(ctx, db, userID, strings.TrimSpace(req.ModelID))
		if err == sql.ErrNoRows {
			fail("No AI provider is configured yet. Add one under AI › Providers.")
			return
		}
		if err != nil {
			fail("Providers could not be listed.")
			return
		}
		if model == "" {
			fail("No model is enabled for " + provider.Name + ". Save its key and enable a model.")
			return
		}

		apiKey, err := crypt.Decrypt(provider.APIKeyCipher)
		if err != nil || apiKey == "" {
			fail("The provider key could not be decrypted. Save it again.")
			return
		}

		// The SmartLMS MCP server is the assistant's hands: the tools that
		// create real content. They are offered only when this person connected
		// the server in the MCP tab, and only within their own permissions.
		connected, err := mcpServerConnected(ctx, db, userID)
		if err != nil {
			fail("Your MCP connections could not be read.")
			return
		}
		toolDefs := []openai.ChatCompletionToolParam{}
		toolByName := map[string]mcpTool{}
		if connected {
			for _, tool := range visibleMCPTools(scope) {
				toolDefs = append(toolDefs, openai.ChatCompletionToolParam{
					Function: openai.FunctionDefinitionParam{
						Name:        tool.Name,
						Description: openai.String(tool.Description),
						Parameters:  openai.FunctionParameters(tool.InputSchema),
					},
				})
				toolByName[tool.Name] = tool
			}
		}

		systemPrompt := buildAIChatSystemPrompt(req.Context.Page, req.Context.Title, &settings, scope)
		if len(toolDefs) > 0 {
			systemPrompt += "\n\nYou can act in SmartLMS through your MCP tools: " + mcpToolNames(toolByName) +
				". Walkthrough: call list_subjects to learn the subject ids, then create what the user asked for. " +
				"Only say you created, added or posted something after the tool call returned successfully, and " +
				"quote the id it returned. When a tool returns an error, tell the user what the backend refused " +
				"and why — never retry behind their back with different arguments."
		} else {
			systemPrompt += "\n\nSmartLMS tools are not connected for this person, so you cannot create subjects, " +
				"weeks, lectures, assignments, quizzes, flashcards or forum threads. If they ask you to, tell them " +
				"to open AI assistant › MCP and connect SmartLMS, then ask again."
		}

		// Rebuild the model-side conversation from the UIMessage parts.
		messages := []openai.ChatCompletionMessageParamUnion{
			openai.SystemMessage(systemPrompt),
		}
		for _, message := range req.Messages {
			if message.Role != "user" && message.Role != "assistant" {
				continue
			}
			var text strings.Builder
			for _, part := range message.Parts {
				if part.Type == "text" {
					text.WriteString(part.Text)
				}
			}
			if text.Len() == 0 {
				continue
			}
			if message.Role == "user" {
				messages = append(messages, openai.UserMessage(text.String()))
			} else {
				messages = append(messages, openai.AssistantMessage(text.String()))
			}
		}
		if len(messages) < 2 {
			fail("Nothing to send yet.")
			return
		}

		client := openai.NewClient(
			option.WithAPIKey(apiKey),
			option.WithBaseURL(provider.BaseURL),
		)
		params := openai.ChatCompletionNewParams{
			Model:    model,
			Messages: messages,
			StreamOptions: openai.ChatCompletionStreamOptionsParam{
				IncludeUsage: openai.Bool(true),
			},
		}
		if limit := int64(settings.MaxOutputTokens); limit > 0 {
			// OpenAI itself wants max_completion_tokens (its reasoning models
			// reject max_tokens); most compatible servers only know max_tokens.
			if strings.Contains(provider.BaseURL, "api.openai.com") {
				params.MaxCompletionTokens = openai.Int(limit)
			} else {
				params.MaxTokens = openai.Int(limit)
			}
		}
		// The loop: stream a turn, run whatever tools it asked for, feed the
		// results back, stream again — capped so a model that keeps calling
		// tools cannot spin forever.
		const maxToolRounds = 6
		emit(map[string]any{"type": "start", "messageId": util.NewID()})

		// Timing and usage across every round of the turn.
		var firstToken time.Time
		markFirstToken := func() {
			if firstToken.IsZero() {
				firstToken = time.Now()
			}
		}
		var outputTokens int64
		usageReported := false
		var allText strings.Builder

		for round := 0; round < maxToolRounds; round++ {
			params.Messages = messages
			if len(toolDefs) > 0 {
				params.Tools = toolDefs
			}

			stream := client.Chat.Completions.NewStreaming(ctx, params)
			emit(map[string]any{"type": "start-step"})

			textID := fmt.Sprintf("text-%d-%d", time.Now().UnixNano(), round)
			textOpen := false
			reasoningID := fmt.Sprintf("reasoning-%d-%d", time.Now().UnixNano(), round)
			reasoningOpen := false
			closeReasoning := func() {
				if reasoningOpen {
					emit(map[string]any{"type": "reasoning-end", "id": reasoningID})
					reasoningOpen = false
				}
			}
			var text strings.Builder
			openText := func() {
				if textOpen {
					return
				}
				closeReasoning()
				emit(map[string]any{"type": "text-start", "id": textID})
				textOpen = true
			}

			// Tool arguments arrive as fragments, one slot per call index.
			calls := map[int64]*streamedToolCall{}
			order := []int64{}
			for stream.Next() {
				chunk := stream.Current()
				if chunk.Usage.CompletionTokens > 0 {
					outputTokens += chunk.Usage.CompletionTokens
					usageReported = true
				}
				for _, choice := range chunk.Choices {
					if reasoning := reasoningDelta(choice.Delta.RawJSON()); reasoning != "" && !textOpen {
						markFirstToken()
						if !reasoningOpen {
							emit(map[string]any{"type": "reasoning-start", "id": reasoningID})
							reasoningOpen = true
						}
						allText.WriteString(reasoning)
						emit(map[string]any{"type": "reasoning-delta", "id": reasoningID, "delta": reasoning})
					}
					if delta := choice.Delta.Content; delta != "" {
						markFirstToken()
						openText()
						text.WriteString(delta)
						allText.WriteString(delta)
						emit(map[string]any{"type": "text-delta", "id": textID, "delta": delta})
					}
					for _, fragment := range choice.Delta.ToolCalls {
						slot, seen := calls[fragment.Index]
						if !seen {
							slot = &streamedToolCall{}
							calls[fragment.Index] = slot
							order = append(order, fragment.Index)
						}
						if fragment.ID != "" {
							slot.id = fragment.ID
						}
						if fragment.Function.Name != "" {
							slot.name = fragment.Function.Name
						}
						slot.args.WriteString(fragment.Function.Arguments)
					}
				}
			}
			streamErr := stream.Err()
			stream.Close()
			closeReasoning()
			if textOpen {
				emit(map[string]any{"type": "text-end", "id": textID})
			}
			if streamErr != nil {
				fail("Provider error: " + streamErr.Error())
				return
			}
			emit(map[string]any{"type": "finish-step"})

			if len(order) == 0 {
				break
			}

			// The assistant turn that asked for the tools, then one result per call.
			requested := make([]openai.ChatCompletionMessageToolCallParam, 0, len(order))
			for _, index := range order {
				call := calls[index]
				if call.id == "" {
					call.id = fmt.Sprintf("call-%d-%d", round, index)
				}
				requested = append(requested, openai.ChatCompletionMessageToolCallParam{
					ID: call.id,
					Function: openai.ChatCompletionMessageToolCallFunctionParam{
						Name:      call.name,
						Arguments: call.args.String(),
					},
				})
			}
			assistantTurn := openai.ChatCompletionAssistantMessageParam{ToolCalls: requested}
			if text.Len() > 0 {
				assistantTurn.Content = openai.ChatCompletionAssistantMessageParamContentUnion{
					OfString: openai.String(text.String()),
				}
			}
			messages = append(messages, openai.ChatCompletionMessageParamUnion{OfAssistant: &assistantTurn})

			for _, index := range order {
				call := calls[index]
				emit(map[string]any{"type": "tool-input-start", "toolCallId": call.id, "toolName": call.name})

				arguments := map[string]any{}
				if raw := strings.TrimSpace(call.args.String()); raw != "" {
					if err := json.Unmarshal([]byte(raw), &arguments); err != nil {
						message := "the tool arguments were not valid JSON: " + err.Error()
						emit(map[string]any{
							"type": "tool-input-error", "toolCallId": call.id,
							"toolName": call.name, "input": raw, "errorText": message,
						})
						messages = append(messages, openai.ToolMessage(message, call.id))
						continue
					}
				}
				emit(map[string]any{
					"type": "tool-input-available", "toolCallId": call.id,
					"toolName": call.name, "input": arguments,
				})

				tool, known := toolByName[call.name]
				if !known {
					message := "unknown tool " + call.name + "; use one of " + mcpToolNames(toolByName)
					emit(map[string]any{"type": "tool-output-error", "toolCallId": call.id, "errorText": message})
					messages = append(messages, openai.ToolMessage(message, call.id))
					continue
				}

				output, runErr := tool.Run(ctx, db, userID, arguments)
				if runErr != nil {
					message := mcpErrorText(runErr)
					emit(map[string]any{"type": "tool-output-error", "toolCallId": call.id, "errorText": message})
					messages = append(messages, openai.ToolMessage("the tool refused: "+message, call.id))
					continue
				}
				emit(map[string]any{"type": "tool-output-available", "toolCallId": call.id, "output": output})
				messages = append(messages, openai.ToolMessage(jsonText(output), call.id))
			}
		}

		var ttft any
		if !firstToken.IsZero() {
			ttft = firstToken.Sub(started).Milliseconds()
		}
		var tokens any
		estimated := false
		if usageReported {
			tokens = outputTokens
		} else {
			tokens = estimateTokens(allText.String())
			estimated = true
		}
		emit(map[string]any{
			"type":         "finish",
			"finishReason": "stop",
			"messageMetadata": map[string]any{
				"model":         model,
				"provider":      provider.Name,
				"ttft_ms":       ttft,
				"duration_ms":   time.Since(started).Milliseconds(),
				"output_tokens": tokens,
				"estimated":     estimated,
			},
		})
		finish()
	})
}
