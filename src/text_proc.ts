export interface TextEditResult {
  text: string;
  removedCharacters: number;
}

export function removeCharacters(input: string, characters: string[]): TextEditResult {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = [...segmenter.segment(input)];

  const filteredSegments = segments.filter(grapheme => {
    const poisoned = characters.some(char => grapheme.segment.includes(char));
    return !poisoned;
  });

  return {
    text: filteredSegments.map(grapheme => grapheme.segment).join(""),
    removedCharacters: segments.length - filteredSegments.length,
  };
}

// This limits the input string to a given amount of grapheme clusters.
// Keep in mind that some grapheme clusters may be represented by multiple characters (code points).
// E.g. "🤦‍♀️" is represented by:
// - 1 grapheme cluster
// - 4 characters: "🤦", "\u200d", "♀", "\ufe0f"
// - 5 bytes
export function limitLength(input: string, length: number): TextEditResult {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = [...segmenter.segment(input)];

  const slicedSegments = segments.slice(0, length);

  return {
    text: slicedSegments.map(grapheme => grapheme.segment).join(""),
    removedCharacters: segments.length - slicedSegments.length,
  };
}
