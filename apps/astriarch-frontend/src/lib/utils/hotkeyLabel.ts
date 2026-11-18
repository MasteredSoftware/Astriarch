export interface HotkeyLabelParts {
	before: string;
	match: string;
	after: string;
}

export function getLabelParts(text: string, key?: string): HotkeyLabelParts {
	if (!key) {
		return { before: text, match: '', after: '' };
	}

	const matchIndex = text.toLowerCase().indexOf(key.toLowerCase());
	if (matchIndex === -1) {
		return { before: text, match: '', after: '' };
	}

	return {
		before: text.slice(0, matchIndex),
		match: text.slice(matchIndex, matchIndex + 1),
		after: text.slice(matchIndex + 1)
	};
}
