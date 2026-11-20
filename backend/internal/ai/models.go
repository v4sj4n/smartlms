package ai

import (
	"context"
	"fmt"
	"sort"
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
