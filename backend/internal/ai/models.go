package ai

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

// ListModels queries any OpenAI-compatible endpoint for its model catalogue.
// baseURL may be the bare origin ("https://api.openai.com/v1") — the OpenAI
// SDK appends the models path.
func ListModels(ctx context.Context, baseURL, apiKey string) ([]string, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	client := openai.NewClient(
		option.WithAPIKey(apiKey),
		option.WithBaseURL(baseURL),
	)
	page, err := client.Models.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("list models: %w", err)
	}
	ids := make([]string, 0, len(page.Data))
	for _, model := range page.Data {
		if model.ID != "" {
			ids = append(ids, model.ID)
		}
	}
	sort.Strings(ids)
	return ids, nil
}

// nonChatMarkers are the catalogue entries that cannot hold a conversation:
// embeddings, speech, image, moderation and rerank models all sit in the same
// /models list as the chat models.
var nonChatMarkers = []string{
	"embed", "whisper", "tts", "dall-e", "moderation", "rerank",
	"transcribe", "realtime", "audio", "image", "sora", "guard",
}

// ChatModels keeps only the entries a chat request can target.
func ChatModels(ids []string) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if isChatModel(id) {
			out = append(out, id)
		}
	}
	return out
}

func isChatModel(id string) bool {
	lower := strings.ToLower(id)
	for _, marker := range nonChatMarkers {
		if strings.Contains(lower, marker) {
			return false
		}
	}
	return true
}

// Fast and flagship preferences, cheapest first. A provider's catalogue carries
// dated variants ("gpt-4o-mini-2024-07-18"), so matching is by substring and the
// shortest match wins.
var (
	fastModels = []string{
		"gpt-4o-mini", "gpt-4.1-mini", "gpt-5-mini", "o4-mini", "o3-mini",
		"claude-3-5-haiku", "claude-3-haiku", "claude-haiku-4",
		"gemini-2.0-flash", "gemini-1.5-flash", "flash",
		"llama-3.3-70b", "llama-3.1-70b", "mistral-small", "deepseek-chat",
		"qwen", "phi",
	}
	flagshipModels = []string{
		"gpt-4o", "gpt-4.1", "gpt-5", "o3",
		"claude-sonnet-4", "claude-3-7-sonnet", "claude-3-5-sonnet",
		"gemini-2.5-pro", "gemini-2.0-pro", "gemini-1.5-pro",
		"llama-3.1-405b", "mistral-large", "deepseek-reasoner",
	}
)

// Starter picks what to switch on for a freshly connected provider: one
// fast/cheap model as the default and, when the catalogue has one, one flagship
// model beside it. A catalogue matching neither preference gets its first model,
// so connecting never leaves a provider with zero enabled models.
func Starter(ids []string) (enable []string, defaultModel string) {
	models := ChatModels(ids)
	if len(models) == 0 {
		return nil, ""
	}
	fast := pickModel(models, fastModels)
	flagship := pickModel(models, flagshipModels)
	if fast == "" && flagship == "" {
		return []string{models[0]}, models[0]
	}
	if fast == "" {
		fast, flagship = flagship, ""
	}
	enable = []string{fast}
	if flagship != "" && flagship != fast {
		enable = append(enable, flagship)
	}
	return enable, fast
}

func pickModel(models []string, preferences []string) string {
	for _, want := range preferences {
		best := ""
		for _, id := range models {
			if !strings.Contains(strings.ToLower(id), want) {
				continue
			}
			if best == "" || len(id) < len(best) {
				best = id
			}
		}
		if best != "" {
			return best
		}
	}
	return ""
}
