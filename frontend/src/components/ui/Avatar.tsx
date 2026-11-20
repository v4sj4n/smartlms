import {
	AvatarFallback,
	AvatarImage,
	Avatar as AvatarRoot,
} from "@ui-sdk/react/avatar";

function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

/** Round avatar: image when it loads, initials otherwise. */
export function Avatar({
	name,
	src,
	size = 32,
}: {
	name: string;
	src?: string | null;
	size?: number;
}) {
	return (
		<AvatarRoot
			className="avatar"
			style={{ width: size, height: size, fontSize: size * 0.4 }}
		>
			{src ? (
				<AvatarImage className="avatar__image" src={src} alt={name} />
			) : null}
			<AvatarFallback className="avatar__fallback">
				<span aria-hidden="true">{initials(name)}</span>
				<span className="visually-hidden">{name}</span>
			</AvatarFallback>
		</AvatarRoot>
	);
}
