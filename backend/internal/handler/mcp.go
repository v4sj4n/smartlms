package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"sort"
	"strings"
)

/*
The OptimoLMS MCP server, over the Streamable HTTP transport (JSON responses, no
SSE stream): a client POSTs JSON-RPC 2.0 to /api/mcp and gets JSON-RPC back.

The tools are the ones in mcp_tools.go — the backend's own content actions. The
same registry feeds the assistant's chat loop, so an MCP client and the in-app
assistant can do exactly the same things, with exactly the same permissions.

Identity comes from the session (`withSessions` in session.go), never from the
request body, the query string or a header: an MCP client signs in like anyone
else and carries the cookie, or sends the token from sign-in as
`Authorization: Bearer <token>`.
*/

const mcpProtocolVersion = "2025-06-18"

const mcpInstructions = "OptimoLMS tools create and read the school's content: subjects, course weeks, " +
	"lectures, assignments, quizzes, flashcards and course forum threads. Call list_subjects first to " +
	"learn the subject ids. Every call runs as the signed-in user and is refused when their permissions " +
	"do not cover the action."

type mcpJSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpJSONRPCResponse struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      json.RawMessage  `json:"id,omitempty"`
	Result  any              `json:"result,omitempty"`
	Error   *mcpJSONRPCError `json:"error,omitempty"`
}

type mcpJSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// A request without an id is a notification: it is handled, never answered.
func (request mcpJSONRPCRequest) isNotification() bool {
	return len(request.ID) == 0 || string(request.ID) == "null"
}

func mcpContent(text string, isError bool) map[string]any {
	return map[string]any{
		"content": []map[string]any{{"type": "text", "text": text}},
		"isError": isError,
	}
}

// jsonText renders a tool's result as the text an MCP client reads, and keeps
// the structured form beside it so a client can parse instead of guess.
func jsonText(value any) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprintf("%v", value)
	}
	return string(encoded)
}

func mcpInitializeResult() map[string]any {
	return map[string]any{
		"protocolVersion": mcpProtocolVersion,
		"capabilities": map[string]any{
			"tools": map[string]any{"listChanged": false},
		},
		"serverInfo": map[string]any{
			"name":    mcpServerKey,
			"title":   "OptimoLMS",
			"version": "1.0.0",
		},
		"instructions": mcpInstructions,
	}
}

// mcpToolDescriptor is one tool as MCP clients expect it.
func mcpToolDescriptor(tool mcpTool) map[string]any {
	return map[string]any{
		"name":        tool.Name,
		"title":       tool.Title,
		"description": tool.Description,
		"inputSchema": tool.InputSchema,
	}
}

// runMCPToolCall executes one tools/call: permission first, then the action.
func runMCPToolCall(r *http.Request, db *sql.DB, userID string, scope accessScope, params json.RawMessage) map[string]any {
	var call struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return mcpContent("invalid tools/call params: "+err.Error(), true)
	}

	tool, ok := findMCPTool(strings.TrimSpace(call.Name))
	if !ok {
		return mcpContent("unknown tool: "+call.Name+". Call tools/list to see what this server offers.", true)
	}
	if !slices.Contains(scope.Permissions, tool.Permission) {
		return mcpContent(fmt.Sprintf(
			"your account does not hold the %s permission, so %s is unavailable. Ask an administrator for access.",
			tool.Permission, tool.Name), true)
	}

	args := map[string]any{}
	if len(call.Arguments) > 0 {
		if err := json.Unmarshal(call.Arguments, &args); err != nil {
			return mcpContent("arguments must be a JSON object: "+err.Error(), true)
		}
	}

	result, err := tool.Run(r.Context(), db, userID, args)
	if err != nil {
		return mcpContent(err.Error(), true)
	}
	return map[string]any{
		"content":           []map[string]any{{"type": "text", "text": jsonText(result)}},
		"structuredContent": result,
		"isError":           false,
	}
}

// dispatchMCPMessage answers one JSON-RPC message; a nil return means "no
// response", which is what notifications and cancellations get.
func dispatchMCPMessage(r *http.Request, db *sql.DB, userID string, scope accessScope, request mcpJSONRPCRequest) *mcpJSONRPCResponse {
	reply := func(result any) *mcpJSONRPCResponse {
		if request.isNotification() {
			return nil
		}
		return &mcpJSONRPCResponse{JSONRPC: "2.0", ID: request.ID, Result: result}
	}
	fail := func(code int, message string) *mcpJSONRPCResponse {
		if request.isNotification() {
			return nil
		}
		return &mcpJSONRPCResponse{JSONRPC: "2.0", ID: request.ID, Error: &mcpJSONRPCError{Code: code, Message: message}}
	}

	switch request.Method {
	case "initialize":
		return reply(mcpInitializeResult())
	case "ping":
		return reply(map[string]any{})
	case "notifications/initialized", "notifications/cancelled", "notifications/progress":
		return nil
	case "tools/list":
		tools := []map[string]any{}
		for _, tool := range visibleMCPTools(scope) {
			tools = append(tools, mcpToolDescriptor(tool))
		}
		return reply(map[string]any{"tools": tools})
	case "tools/call":
		return reply(runMCPToolCall(r, db, userID, scope, request.Params))
	default:
		return fail(-32601, "method not found: "+request.Method)
	}
}

// registerMCP wires the JSON-RPC endpoint and the catalogue the MCP tab reads.
func registerMCP(mux *http.ServeMux, db *sql.DB) {
	// POST /api/mcp — the MCP endpoint itself.
	mux.HandleFunc("POST /api/mcp", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
		scope, err := loadAccessScope(r.Context(), db, userID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusUnauthorized, mcpJSONRPCResponse{
				JSONRPC: "2.0",
				Error:   &mcpJSONRPCError{Code: -32001, Message: "unknown user"},
			})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, mcpJSONRPCResponse{
				JSONRPC: "2.0",
				Error:   &mcpJSONRPCError{Code: -32603, Message: err.Error()},
			})
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			writeJSON(w, http.StatusBadRequest, mcpJSONRPCResponse{
				JSONRPC: "2.0",
				Error:   &mcpJSONRPCError{Code: -32700, Message: "unreadable body"},
			})
			return
		}
		trimmed := strings.TrimSpace(string(body))
		if trimmed == "" {
			writeJSON(w, http.StatusBadRequest, mcpJSONRPCResponse{
				JSONRPC: "2.0",
				Error:   &mcpJSONRPCError{Code: -32700, Message: "empty body"},
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")

		// A batch is an array of messages; a single message is the common case.
		if strings.HasPrefix(trimmed, "[") {
			var batch []mcpJSONRPCRequest
			if err := json.Unmarshal(body, &batch); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(mcpJSONRPCResponse{
					JSONRPC: "2.0",
					Error:   &mcpJSONRPCError{Code: -32700, Message: "invalid JSON-RPC batch"},
				})
				return
			}
			answers := []mcpJSONRPCResponse{}
			for _, request := range batch {
				if response := dispatchMCPMessage(r, db, userID, scope, request); response != nil {
					answers = append(answers, *response)
				}
			}
			if len(answers) == 0 {
				w.WriteHeader(http.StatusAccepted)
				return
			}
			_ = json.NewEncoder(w).Encode(answers)
			return
		}

		var request mcpJSONRPCRequest
		if err := json.Unmarshal(body, &request); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(mcpJSONRPCResponse{
				JSONRPC: "2.0",
				Error:   &mcpJSONRPCError{Code: -32700, Message: "invalid JSON-RPC message"},
			})
			return
		}
		response := dispatchMCPMessage(r, db, userID, scope, request)
		if response == nil {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		_ = json.NewEncoder(w).Encode(response)
	})

	// GET /api/mcp is the optional server-sent stream. This server answers
	// requests with JSON, so it says so instead of holding a socket open.
	mux.HandleFunc("GET /api/mcp", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", "POST")
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
			"error": "this MCP endpoint answers JSON-RPC over POST; no SSE stream is offered",
		})
	})

	// GET /api/mcp/tools — the catalogue the MCP tab draws: what the server can
	// do, which permissions each tool needs, and what this person is allowed.
	mux.HandleFunc("GET /api/mcp/tools", func(w http.ResponseWriter, r *http.Request) {
		userID := callerFrom(r).ID
		scope, err := loadAccessScope(r.Context(), db, userID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		connected, err := mcpServerConnected(r.Context(), db, userID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		tools := []map[string]any{}
		allowed := 0
		for _, tool := range mcpTools() {
			available := slices.Contains(scope.Permissions, tool.Permission)
			if available {
				allowed++
			}
			tools = append(tools, map[string]any{
				"name":         tool.Name,
				"title":        tool.Title,
				"description":  tool.Description,
				"module":       tool.Module,
				"permission":   tool.Permission,
				"input_schema": tool.InputSchema,
				"available":    available,
			})
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"server":       mcpServerKey,
			"name":         "OptimoLMS",
			"endpoint":     "/api/mcp",
			"protocol":     mcpProtocolVersion,
			"connected":    connected,
			"instructions": mcpInstructions,
			"tools":        tools,
			"allowed":      allowed,
			"total":        len(tools),
		})
	})
}

// mcpToolNames lists the tools a person may call, for the system prompt.
func mcpToolNames(tools map[string]mcpTool) string {
	names := make([]string, 0, len(tools))
	for name := range tools {
		names = append(names, name)
	}
	sort.Strings(names)
	return strings.Join(names, ", ")
}

// mcpErrorText flattens an error for the chat stream's tool-output-error event.
func mcpErrorText(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, sql.ErrNoRows) {
		return "not found"
	}
	return err.Error()
}
