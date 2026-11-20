package ai

import (
	"slices"
	"testing"
)

func TestChatModelsDropsThingsThatCannotChat(t *testing.T) {
	ids := []string{
		"gpt-4o-mini", "text-embedding-3-small", "whisper-1", "tts-1",
		"dall-e-3", "omni-moderation-latest", "gpt-4o-realtime-preview",
		"gpt-4o", "rerank-english-v3.0",
	}
	got := ChatModels(ids)
	want := []string{"gpt-4o-mini", "gpt-4o"}
	if !slices.Equal(got, want) {
		t.Errorf("ChatModels = %v, want %v", got, want)
	}
}

func TestStarterPicksAFastDefaultAndAFlagship(t *testing.T) {
	cases := []struct {
		name       string
		catalogue  []string
		wantEnable []string
		wantDef    string
	}{
		{
			name:       "openai style",
			catalogue:  []string{"gpt-4o", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "whisper-1"},
			wantEnable: []string{"gpt-4o-mini", "gpt-4o"},
			wantDef:    "gpt-4o-mini",
		},
		{
			name:       "anthropic gateway",
			catalogue:  []string{"claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"},
			wantEnable: []string{"claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"},
			wantDef:    "claude-3-5-haiku-20241022",
		},
		{
			name:       "unknown catalogue still gets one model",
			catalogue:  []string{"house-model-a", "house-model-b"},
			wantEnable: []string{"house-model-a"},
			wantDef:    "house-model-a",
		},
		{
			name:       "flagship only",
			catalogue:  []string{"gpt-4o"},
			wantEnable: []string{"gpt-4o"},
			wantDef:    "gpt-4o",
		},
		{
			name:      "nothing chat-capable",
			catalogue: []string{"text-embedding-3-small"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			enable, def := Starter(tc.catalogue)
			if !slices.Equal(enable, tc.wantEnable) {
				t.Errorf("enable = %v, want %v", enable, tc.wantEnable)
			}
			if def != tc.wantDef {
				t.Errorf("default = %q, want %q", def, tc.wantDef)
			}
		})
	}
}
