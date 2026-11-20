import { PAGE_SIZES, type PageSize } from "./components/ui";

/**
 * Search params shared by every paginated list route. Both stay optional so
 * plain `/users` links need no query string; the pages apply the defaults.
 */
export type ListSearch = { page?: number; page_size?: PageSize };

export const DEFAULT_PAGE_SIZE: PageSize = 10;

/**
 * Route-level validation for `/users` and `/subjects`: the URL is the source of
 * truth for paging, so a refresh or a shared link lands on the same page.
 */
export function parseListSearch(
	search: Record<string, unknown>,
): Partial<ListSearch> {
	const page = Number(search.page);
	const pageSize = Number(search.page_size);
	const parsed: Partial<ListSearch> = {};
	if (Number.isFinite(page) && page >= 1) parsed.page = Math.floor(page);
	if (PAGE_SIZES.includes(pageSize as PageSize)) {
		parsed.page_size = pageSize as PageSize;
	}
	return parsed;
}

/** Search params for `/subjects`: paging plus the academic-year filter. */
export type SubjectSearch = ListSearch & { school_year?: string };

/** The subjects screen keeps its year filter in the URL, next to the page. */
export function parseSubjectSearch(
	search: Record<string, unknown>,
): Partial<SubjectSearch> {
	const parsed: Partial<SubjectSearch> = { ...parseListSearch(search) };
	if (typeof search.school_year === "string" && search.school_year.trim()) {
		parsed.school_year = search.school_year.trim();
	}
	return parsed;
}
