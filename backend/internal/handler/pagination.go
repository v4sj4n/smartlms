package handler

import (
	"net/http"
	"strconv"
)

// pagination reads ?page (1-based) and ?page_size (default 10, max 100).
func pagination(r *http.Request) (page, size int) {
	page, size = 1, 10
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := r.URL.Query().Get("page_size"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			if n > 100 {
				n = 100
			}
			size = n
		}
	}
	return page, size
}

func offset(page, size int) int { return (page - 1) * size }
