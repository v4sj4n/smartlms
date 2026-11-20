import { CaretRight, GraduationCap } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "../../api";
import { initials } from "../../format";
import { useUsers } from "../../queries";
import {
	Card,
	EmptyState,
	ErrorState,
	type PageSize,
	Pagination,
	SearchField,
	SkeletonStack,
} from "../ui";

/**
 * Searchable, paginated list of student accounts. Each row opens that
 * student's study record, which is where staff read and override results.
 */
export function StudentDirectory() {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<PageSize>(10);
	const students = useUsers({
		page,
		page_size: pageSize,
		role: "STUDENT",
		search,
	});

	return (
		<Card className="card--flush">
			<div className="list-toolbar">
				<SearchField
					label="Search students"
					placeholder="Search by name or email"
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
				/>
			</div>

			{students.isPending ? (
				<SkeletonStack rows={6} />
			) : students.isError ? (
				<ErrorState
					title="Students could not be loaded"
					message={errorMessage(students.error)}
					onRetry={() => void students.refetch()}
				/>
			) : students.data.items.length === 0 ? (
				<EmptyState
					icon={GraduationCap}
					title={search ? `No students match “${search}”` : "No students yet"}
					description={
						search
							? "Try part of the name or the email address."
							: "Student accounts appear here once they are created."
					}
				/>
			) : (
				<>
					<ul className="people-list" aria-label="Students">
						{students.data.items.map((student) => (
							<li key={student.id}>
								<Link
									to="/record"
									search={{ student: student.id, name: student.name }}
									className="people-list__row"
								>
									<span className="avatar" aria-hidden="true">
										{initials(student.name)}
									</span>
									<span className="people-list__text">
										<span className="people-list__name">{student.name}</span>
										<span className="people-list__email">{student.email}</span>
									</span>
									<span className="people-list__action">Study record</span>
									<CaretRight size={14} weight="bold" aria-hidden="true" />
								</Link>
							</li>
						))}
					</ul>
					<div className="card__footer">
						<Pagination
							page={page}
							pageSize={pageSize}
							total={students.data.total}
							itemLabel={students.data.total === 1 ? "student" : "students"}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					</div>
				</>
			)}
		</Card>
	);
}
