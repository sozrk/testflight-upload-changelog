// Apple only allows the version to be 1, 2 or 3 period-separated integers.
// We also accept something similar to Semantic Versioning 2.0.0-rc.1 (https://semver.org/spec/v2.0.0-rc.1)
// as it is used by Dart. When met with a version containing build metadata (e.g. 1.0.0+85),
// Flutter will use the version without the build metadata (e.g. 1.0.0) for the
// CFBundleShortVersionString value (or preReleaseVersion in App Store Connect)
// and the build number (e.g. 85) for the CFBundleVersion value (or version in
// App Store Connect). That also means the build metadata must be in the format
// of 1, 2 or 3 period-separated integers.
// https://github.com/flutter/flutter/blob/aa934ac119d007ad2e9dac7dbd75e41c1ee17ac8/packages/flutter_tools/lib/src/flutter_manifest.dart#L115-L133
class Version {
  input: string;
  name: string;
  number: string | undefined;

  constructor(version: string) {
    // allow leading zeroes like in semver 2.0.0-rc.1
    const semverRegex =
      /^(?<main>\d+(?:\.\d+)?(?:\.\d+)?)(-[0-9a-zA-Z-]*(?:\.[0-9a-zA-Z-]*)*)?(?:\+(?<build>\d+(?:\.\d+)?(?:\.\d+)?))?$/;
    const match = semverRegex.exec(version.trim());
    if (match == null || match.groups == undefined) {
      throw new Error(`Invalid version: ${version}`);
    }

    this.input = version;
    this.name = match.groups.main;
    this.number = match.groups.build;
  }

  toString(): string {
    return this.input;
  }
}

export { Version };
