import { CaretLeft, CaretRight } from "@phosphor-icons/react";

export const PAGE_SIZES = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Shared pagination strip for flat tables and lists: total count and the
 * page-size selector on the left; Previous, the page position and Next on the
 * right. Renders nothing when the list is empty.
 */
export function Pagination({
	page,
	pageSize,
	total,
	itemLabel,
	onPageChange,
	onPageSizeChange,
}: {
	page: number;
	pageSize: number;
	total: number;
	/** Plural noun for the total: "users", "subjects". */
	itemLabel: string;
	onPageChange: (page: number) => void;
	onPageSizeChange?: (size: PageSize) => void;
}) {
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	if (total === 0) return null;

	return (
		<div className="pagination" role="group" aria-label="Pagination">
			<div className="pagination__meta">
				<span className="pagination__total num">
					{total} {itemLabel}
				</span>

				{onPageSizeChange ? (
					<label className="pagination__size">
						<span className="pagination__size-label">Rows per page</span>
						<select
							className="select select--compact"
							value={pageSize}
							onChange={(event) =>
								onPageSizeChange(Number(event.target.value) as PageSize)
							}
						>
							{PAGE_SIZES.map((size) => (
								<option key={size} value={size}>
									{size}
								</option>
							))}
						</select>
					</label>
				) : null}
			</div>

			<div className="pagination__nav">
				<button
					type="button"
					className="btn btn--secondary btn--sm"
					onClick={() => onPageChange(page - 1)}
					disabled={page <= 1}
					aria-label="Previous page"
				>
					<CaretLeft size={13} weight="bold" aria-hidden="true" />
					<span className="pagination__button-text">Previous</span>
				</button>
				<span className="pagination__status num" aria-live="polite">
					Page {Math.min(page, pageCount)} of {pageCount}
				</span>
				<button
					type="button"
					className="btn btn--secondary btn--sm"
					onClick={() => onPageChange(page + 1)}
					disabled={page >= pageCount}
					aria-label="Next page"
				>
					<span className="pagination__button-text">Next</span>
					<CaretRight size={13} weight="bold" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}
