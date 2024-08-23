import assert from "node:assert";
import test, { describe } from "node:test";
import { Version } from "./version";

describe("Vesion constructor", () => {
  test("valid versions", () => {
    // version -> [preReleaseVersion, version]
    // preReleaseVersion and version refer to fields returned in the App Store Connect API
    const versions = {
      "2.0.0": ["2.0.0", undefined],
      "1.0.0+0.3.7": ["1.0.0", "0.3.7"],
      "1.3.7+11": ["1.3.7", "11"],
      "1.3.7+11.22": ["1.3.7", "11.22"],
      "1.3.7+11.22.33": ["1.3.7", "11.22.33"],
      "1.0.0-rc.1+1": ["1.0.0", "1"],
      "1.0.0-rc.1+1.2": ["1.0.0", "1.2"],
      "1.0.0-rc.1+1.2.3": ["1.0.0", "1.2.3"],
      "1.0.0-rc.1": ["1.0.0", undefined],
      "1.0.0-beta.11": ["1.0.0", undefined],
      "1.0.0-beta.2": ["1.0.0", undefined],
      "1.0.0-alpha.1": ["1.0.0", undefined],
      "1.0.0-alpha": ["1.0.0", undefined],
      "0": ["0", undefined],
      "1": ["1", undefined],
      "1.2": ["1.2", undefined],
      "1.2.3": ["1.2.3", undefined],
      "001": ["001", undefined],
      "001.02": ["001.02", undefined],
      "01.002.03": ["01.002.03", undefined],
    };

    for (const [version, [buildName, buildNumber]] of Object.entries(versions)) {
      const parsedVersion = new Version(version);
      assert.strictEqual(parsedVersion.name, buildName);
      assert.strictEqual(parsedVersion.number, buildNumber);
    }
  });
  test("invalid versions", () => {
    const invalid = [
      "1.2.3.4",
      "1,2",
      "1.1.1a1", // archived docs say this is valid, but in reality it is not
      "mega",
      ":3".repeat(1000),
      "1.3.7+1.2.3.4",
      "1.3.7+build.11.e0f985a",
      "1.3.7+build.2.b8f12d7",
      "1.3.7+build",
      "1.0.0-rc.1+build.1",
    ];

    for (const version of invalid) {
      assert.throws(() => new Version(version));
    }
  });
});
