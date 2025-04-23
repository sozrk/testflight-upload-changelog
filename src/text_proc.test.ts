import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { type TextEditResult, limitLength, removeCharacters } from "./text_proc.js";

interface TestCase<I> {
  args: I;
  expected: TextEditResult;
  path: string;
}

function testCase<I extends unknown[]>(args: [...I], expected: [string, number]): TestCase<I> {
  const error = new Error();
  const stack = error.stack?.split("\n")[2].trim();
  const path = stack?.split("/").pop()?.replace(")", "") ?? "unknown";

  return { args, expected: { text: expected[0], removedCharacters: expected[1] }, path };
}

function testTextProcessing<Func extends (...args: I) => TextEditResult, I extends unknown[]>(
  func: Func,
  testCases: TestCase<I>[]
) {
  test(func.name, () => {
    for (const { args, expected, path } of testCases) {
      try {
        assert.deepStrictEqual(func(...args), expected);
      } catch (error: unknown) {
        if (error instanceof Error) {
          error.stack = `\x1b[33mcase defined at ${path}\x1b[0m\n${error.stack}`;
        }
        throw error;
      }
    }
  });
}

describe("Text processing", () => {
  testTextProcessing(removeCharacters, [
    // basic ASCII
    testCase(["hello", ["h"]], ["ello", 1]),
    testCase(["hello", ["l"]], ["heo", 2]),
    testCase(["hello", ["h", "o"]], ["ell", 2]),
    testCase(["hello world", [" "]], ["helloworld", 1]),

    // empty inputs
    testCase(["", ["a"]], ["", 0]),
    testCase(["hello", []], ["hello", 0]),
    testCase(["", []], ["", 0]),

    // No matching characters
    testCase(["hello", ["x"]], ["hello", 0]),
    testCase(["hello", ["x", "y", "z"]], ["hello", 0]),

    // unicode characters
    testCase(["café", ["é"]], ["caf", 1]),
    testCase(["café", ["e"]], ["café", 0]), // 'é' is not 'e'
    testCase(["café", ["é", "c"]], ["af", 2]),

    // combining marks
    testCase(["e\u0301", ["é"]], ["", 1]), // e + combining acute accent
    testCase(["e\u0301", ["e"]], ["", 1]), // removing base char removes cluster
    testCase(["n\u0303", ["ñ"]], ["", 1]), // n + combining tilde
    testCase(["a\u0308", ["ä"]], ["", 1]), // a + combining diaeresis

    // different scripts
    testCase(["привет", ["п"]], ["ривет", 1]), // cyrillic
    testCase(["こんにちは", ["に"]], ["こんちは", 1]), // japanese
    testCase(["안녕하세요", ["세"]], ["안녕하요", 1]), // korean
    testCase(["مرحبا", ["ح"]], ["مربا", 1]), // arabic
    testCase(["你好", ["你"]], ["好", 1]), // chinese

    // emojis
    testCase(["Hello 👋", ["👋"]], ["Hello ", 1]),
    testCase(["👨‍👩‍👧‍👦", ["👨"]], ["", 1]), // family emoji
    testCase(["👩🏽‍🚀", ["👩"]], ["", 1]), // astronaut with skin tone
    testCase(["🇺🇸", ["🇺"]], ["", 1]), // flag
    testCase(["Hello 👨‍💻 World", ["👨‍💻"]], ["Hello  World", 1]),

    // zalgo text
    testCase(["H̷̪̙̮̭̏͊̋̓͂̎e̷̩̘̬̩̗̓̈́l̷̠̘̮̲̖̗̑l̶̬̦̣͖̎̅̿͊͝͝o̴̢̭̱̮̓̃̀̂", ["H"]], ["e̷̩̘̬̩̗̓̈́l̷̠̘̮̲̖̗̑l̶̬̦̣͖̎̅̿͊͝͝o̴̢̭̱̮̓̃̀̂", 1]),
    testCase(["H̷̪̙̮̭̏͊̋̓͂̎e̷̩̘̬̩̗̓̈́l̷̠̘̮̲̖̗̑l̶̬̦̣͖̎̅̿͊͝͝o̴̢̭̱̮̓̃̀̂", ["e"]], ["H̷̪̙̮̭̏͊̋̓͂̎l̷̠̘̮̲̖̗̑l̶̬̦̣͖̎̅̿͊͝͝o̴̢̭̱̮̓̃̀̂", 1]),

    // special characters
    testCase(["\u200B\u200Bhello", ["\u200B"]], ["hello", 2]), // zero-width space
    testCase(["\u00A0hello\u00A0world", ["\u00A0"]], ["helloworld", 2]), // non-breaking space
    testCase(["hello\r\nworld", ["\r\n"]], ["helloworld", 1]), // line break
    testCase(["hello\tworld", ["\t"]], ["helloworld", 1]), // tab

    // multiple removals
    testCase(["hello", ["l", "l"]], ["heo", 2]),
    testCase(["hello", ["l", "l", "l"]], ["heo", 2]),

    // edge cases maybe
    testCase(["a", ["a"]], ["", 1]),
    testCase(["aaa", ["a"]], ["", 3]),
    testCase(["\u0000test", ["\u0000"]], ["test", 1]), // null character
    testCase(["test\u0000", ["\u0000"]], ["test", 1]), // null at end

    // mixed cases
    testCase(["Hello 123 World!", ["1", "o", "!"]], ["Hell 23 Wrld", 4]),
    testCase(["Hello 👋 World!", ["o", "👋", "!"]], ["Hell  Wrld", 4]),

    // RTL text
    testCase(["Hello שלום", ["ל"]], ["Hello שום", 1]),
    testCase(["Hello שלום", ["ל", "o"]], ["Hell שום", 2]),

    // complex examples
    testCase(["👨‍👩‍👧‍👦👨‍👩‍👧‍👦", ["👨‍👩‍👧‍👦"]], ["", 2]),
    testCase(["🏳️‍🌈🏳️‍⚧️", ["🏳️‍🌈"]], ["🏳️‍⚧️", 1]),
    testCase(["é", ["e"]], ["é", 0]), // 'é' as single code point
    testCase(["e\u0301", ["e"]], ["", 1]), // 'e' with combining character

    // long strings
    testCase(
      ["The quick brown fox jumps over the lazy dog", ["a", "e", "i", "o", "u"]],
      ["Th qck brwn fx jmps vr th lzy dg", 1 + 3 + 1 + 4 + 2]
    ),
    testCase(["a".repeat(1000), ["a"]], ["", 1000]),
    testCase(["abc".repeat(1000), ["b"]], ["ac".repeat(1000), 1000]),

    // mixed characters from different charsets
    testCase(["Hello Привет 你好 שלום", ["H", "П", "你", "ש"]], ["ello ривет 好 לום", 4]),

    // combining characters in the array
    testCase(["hello", ["e\u0301"]], ["hello", 0]), // shouldn't match
    testCase(["he\u0301llo", ["e\u0301"]], ["hllo", 1]), // should match 'é'

    // surrogate pairs (characters outside BMP)
    testCase(["𐐷𐐷𐐷", ["𐐷"]], ["", 3]), // deseret letter yee
    testCase(["a𐐷b𐐷c", ["𐐷"]], ["abc", 2]),

    // variation selectors
    testCase(["️⃣", ["⃣"]], ["", 1]), // keycap
    testCase(["☹️", ["☹"]], ["", 1]), // frowning face with variation

    // multi-code point emojis with modifiers
    testCase(["👩‍🔬👨‍🔬", ["👩"]], ["👨‍🔬", 1]),
    testCase(["👩‍🔬👨‍🔬", ["👩‍🔬"]], ["👨‍🔬", 1]),

    // multiple emoji with ZWJ sequences
    testCase(["👨‍👩‍👧👨‍👨‍👧👩‍👩‍👧", ["👨‍👩‍👧"]], ["👨‍👨‍👧👩‍👩‍👧", 1]),

    // extended grapheme clusters
    testCase(["a\u0300\u0301\u0302", ["a"]], ["", 1]), // 'a' with multiple marks

    // regional indicators
    testCase(["🇺🇸🇬🇧🇯🇵", ["🇺🇸"]], ["🇬🇧🇯🇵", 1]),
    testCase(["🇺🇸🇬🇧🇯🇵", ["🇺"]], ["🇬🇧🇯🇵", 1]), // part of flag removes whole flag

    // tags (e.g., for regional flags)
    testCase(["🏴󠁧󠁢󠁥󠁮󠁧󠁿🏴󠁧󠁢󠁳󠁣󠁴󠁿", ["🏴󠁧󠁢󠁥󠁮󠁧󠁿"]], ["🏴󠁧󠁢󠁳󠁣󠁴󠁿", 1]),

    // various scripts
    testCase(["ᠠᠡᠢᠣᠤᠥ", ["ᠡ"]], ["ᠠᠢᠣᠤᠥ", 1]), // mongolian
    testCase(["ꪀꪁꪂꪃ", ["ꪁ"]], ["ꪀꪂꪃ", 1]), // tai Viet
    testCase(["ᮊᮋᮌᮍ", ["ᮋ"]], ["ᮊᮌᮍ", 1]), // sundanese

    // mathematical notation
    testCase(["∀∁∂∃∄∅∆∇", ["∃", "∅"]], ["∀∁∂∄∆∇", 2]),

    // musical notation
    testCase(["♩♪♫♬", ["♪"]], ["♩♫♬", 1]),

    // control characters
    testCase(["Hello\u0007World", ["\u0007"]], ["HelloWorld", 1]), // bell
    testCase(["Hello\u001BWorld", ["\u001B"]], ["HelloWorld", 1]), // escape

    // unusual Unicode
    testCase(["Hello\u0378World", ["\u0378"]], ["HelloWorld", 1]), // undefined
    testCase(["\uFFFDTest", ["\uFFFD"]], ["Test", 1]), // replacement

    // emoji with color modifiers
    testCase(["👋🏻👋🏼👋🏽👋🏾👋🏿", ["👋🏽"]], ["👋🏻👋🏼👋🏾👋🏿", 1]),
    testCase(["👋🏻👋🏼👋🏽👋🏾👋🏿", ["👋"]], ["", 5]),

    // private use characters
    testCase(["\uE000\uE001\uE002", ["\uE001"]], ["\uE000\uE002", 1]),

    // mix of different category characters
    testCase(["a1@Ωж", ["@", "Ω"]], ["a1ж", 2]),

    // special whitespace
    testCase(["a\u2000b\u2001c\u2002d", ["\u2000", "\u2002"]], ["ab\u2001cd", 2]),

    // characters with ligatures
    testCase(["ﬁﬂ", ["ﬁ"]], ["ﬂ", 1]), // 'fi' and 'fl' ligatures

    // highly decomposable characters
    testCase(["가나다", ["나"]], ["가다", 1]), // korean Hangul

    // ancient scripts
    testCase(["𐌰𐌱𐌲𐌳", ["𐌲"]], ["𐌰𐌱𐌳", 1]), // gothic
    testCase(["𐎠𐎡𐎢𐎣", ["𐎡"]], ["𐎠𐎢𐎣", 1]), // old Persian

    // invisible characters
    testCase(["a\u200Db\u200Ec\u200Fd", ["\u200D"]], ["b\u200Ec\u200Fd", 1]), // ZWJ
    testCase(["a\u200Db\u200Ec\u200Fd", ["\u200E"]], ["a\u200Dbc\u200Fd", 1]), // LTR mark

    // bidirectional text
    testCase(["Hello \u202E world!", ["\u202E"]], ["Hello  world!", 1]),

    // mixed sequences
    testCase(["👨‍🦰👩‍🦱", ["👨"]], ["👩‍🦱", 1]),
    testCase(["👨‍🦰👩‍🦱", ["🦰"]], ["👩‍🦱", 1]),

    // character order shouldn't matter
    testCase(["abcde", ["a", "c", "e"]], ["bd", 3]),
    testCase(["abcde", ["e", "c", "a"]], ["bd", 3]),
  ]);

  testTextProcessing(limitLength, [
    // basic ASCII
    testCase(["Hello world", 5], ["Hello", 6]),
    testCase(["Hello world", 6], ["Hello ", 5]),
    testCase(["Hello world", 10], ["Hello worl", 1]),
    testCase(["Hello world", 11], ["Hello world", 0]),
    testCase(["Hello world", 12], ["Hello world", 0]),

    // combining characters
    testCase(["café", 3], ["caf", 1]),
    testCase(["café", 4], ["café", 0]),
    testCase(["café", 5], ["café", 0]),

    // emojis
    testCase(["Hello 👋🏽", 7], ["Hello 👋🏽", 0]),
    testCase(["👨‍👩‍👧‍👦👨‍👩‍👧‍👦", 1], ["👨‍👩‍👧‍👦", 1]),

    // mixed scripts
    testCase(["こんにちは世界", 4], ["こんにち", 3]),
    testCase(["नमस्ते दुनिया", 5], ["नमस्ते दु", 2]),

    // zero-width joiners
    testCase(["👩‍💻👨‍🔬🤦‍♀️", 1], ["👩‍💻", 2]),
    testCase(["👩‍💻👨‍🔬🤦‍♀️", 2], ["👩‍💻👨‍🔬", 1]),
    testCase(["👩‍💻👨‍🔬🤦‍♀️", 3], ["👩‍💻👨‍🔬🤦‍♀️", 0]),
    testCase(["👩‍💻👨‍🔬🤦‍♀️", 4], ["👩‍💻👨‍🔬🤦‍♀️", 0]),

    // edge cases maybe
    testCase(["", 5], ["", 0]),
    testCase([" ", 5], [" ", 0]),
    testCase(["👨‍👩‍👧‍👦", 0], ["", 1]),

    // long strings
    testCase(["abc".repeat(1000), 900], ["abc".repeat(300), 2100]),
    testCase(["💀🤦‍♀️".repeat(1000), 1000], ["💀🤦‍♀️".repeat(500), 1000]),
  ]);
});
