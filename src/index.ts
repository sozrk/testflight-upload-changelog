import * as core from "@actions/core";
import { HttpClient, type HttpClientError } from "@actions/http-client";
import { BearerCredentialHandler } from "@actions/http-client/lib/auth.js";
import * as jose from "jose";
import type {
  BetaBuildLocalizationResponse,
  BetaBuildLocalizationUpdateRequest,
  ErrorData,
  ErrorResponse,
  GenericResponse,
} from "./api_types.js";
import { limitLength, removeCharacters } from "./text_proc.js";
import { Version } from "./version.js";

const API_URL = "https://api.appstoreconnect.apple.com/v1";
const TOKEN_REFRESH_MINUTES = 15;

let client: HttpClient;
main().catch(error => {
  core.setFailed(error);
  core.debug("Disposing client");
  client?.dispose();
  process.exit(1);
});

async function main() {
  const apiIssuerId = core.getInput("api_issuer_id", { required: true });
  const apiKeyId = core.getInput("api_key_id", { required: true });
  const apiPrivateKey = core.getInput("api_private_key", { required: true });
  const bundleId = core.getInput("bundle_id", { required: true });
  const appVersion = core.getInput("app_version", { required: true });
  const whatsNew = core.getInput("whats_new", { required: true });
  const disableDefaultTimeout = core.getBooleanInput("disable_default_timeout");
  const autoFixContent = core.getBooleanInput("auto_fix_content");

  if (!disableDefaultTimeout) {
    core.info("Setting the default timeout to 25 minutes.");
    setTimeout(
      () => {
        core.setFailed("Timeout reached");
        process.exit(1);
      },
      25 * 60 * 1000
    );
  }

  const token = await generateToken(apiIssuerId, apiKeyId, apiPrivateKey);
  const auth = new BearerCredentialHandler(token);
  client = new HttpClient("appstore-connect-release-notes-action", [auth]);

  // Refresh the token every `TOKEN_REFRESH_MINUTES` minutes
  setInterval(
    async () => {
      core.info("Refreshing token");
      const newToken = await generateToken(apiIssuerId, apiKeyId, apiPrivateKey);
      auth.token = newToken;
    },
    TOKEN_REFRESH_MINUTES * 60 * 1000
  );

  // https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps
  const apps = await client.getJson<GenericResponse>(`${API_URL}/apps?filter[bundleId]=${bundleId}`);
  if (apps.result?.data[0] == null) {
    throw new Error("App not found");
  }
  const appId = apps.result.data[0].id;
  core.debug(`App ID: ${appId}`);

  const parsedVersion = new Version(appVersion);
  const version = parsedVersion.number ?? parsedVersion.name;
  const preReleaseVersion = parsedVersion.name;
  core.info(`Version ${appVersion} -> Version ${version} (Pre-release ${preReleaseVersion})`);

  core.info("Waiting for the build to appear in App Store Connect");
  const start = performance.now();
  let buildId: string | undefined;
  while (buildId == null) {
    // https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds
    const builds = await client.getJson<GenericResponse>(
      `${API_URL}/builds?filter[app]=${appId}&filter[version]=${version}&filter[preReleaseVersion.version]=${preReleaseVersion}&sort=-uploadedDate&limit=1&fields[builds]=`
    );
    core.debug(JSON.stringify(builds.result?.data, null, 2));
    buildId = builds.result?.data[0]?.id;
    if (buildId != null) {
      break;
    }
    await sleep(30 * 1000);
  }
  core.info(`Waiting for build took ${((performance.now() - start) / 1000).toFixed(2)}s`);
  core.debug(`Build ID: ${buildId}`);

  // https://developer.apple.com/documentation/appstoreconnectapi/get-v1-builds-_id_-betabuildlocalizations
  const localizations = await client.getJson<GenericResponse>(
    `${API_URL}/builds/${buildId}/betaBuildLocalizations`
  );
  if ((localizations.result?.data ?? []).length === 0) {
    core.warning("No localizations found");
  }
  for (const localization of localizations.result?.data ?? []) {
    const id = localization.id;
    const sendChangelog = (changelog: string) =>
      // https://developer.apple.com/documentation/appstoreconnectapi/patch-v1-betaBuildLocalizations-_id_
      client.patchJson<BetaBuildLocalizationResponse>(`${API_URL}/betaBuildLocalizations/${id}`, {
        data: {
          id,
          type: "betaBuildLocalizations",
          attributes: {
            whatsNew: changelog,
          },
        },
      } satisfies BetaBuildLocalizationUpdateRequest);

    // const newLocalization = await sendChangelog();
    const newLocalization = await sendChangelog(whatsNew).catch(async (errorResponse: HttpClientError) => {
      if (!autoFixContent) {
        throw errorResponse;
      }

      const errors = (errorResponse.result as ErrorResponse | undefined)?.errors ?? [];
      core.info(
        `Uploading the changelog yielded ${errors.length} error${errors.length === 1 ? "" : "s"}, attempting to fix ${errors.length > 1 ? "them" : "it"} automatically.`
      );

      // sort so that the TOO_LONG error comes last
      // this may need to be adjusted in the future if more errors are added
      errors.sort((a, b) => a.code.localeCompare(b.code));

      // apply fixes from all errors
      const newWhatsNew = errors.reduce(
        (currentWhatsNew, error) => autoFixPatchError(currentWhatsNew, error),
        whatsNew
      );

      if (newWhatsNew === whatsNew) {
        // hasn't changed, no errors were fixed
        throw errorResponse;
      }

      core.notice(`Uploading the modified changelog: \"${newWhatsNew}\"`);
      return sendChangelog(newWhatsNew);
    });

    core.info(`Updated localization for locale ${newLocalization.result?.data.attributes?.locale}`);
  }

  client.dispose();
  process.exit(0); // to kill the timeout and any other pending promises
}

async function generateToken(issuerId: string, keyId: string, privateKey: string): Promise<string> {
  const alg = "ES256";
  const cleanedKey = privateKey.includes("BEGIN PRIVATE KEY")
    ? privateKey
    : Buffer.from(privateKey, "base64").toString("utf8");
  const signingKey = await jose.importPKCS8(cleanedKey, alg);

  const jwt = await new jose.SignJWT()
    .setProtectedHeader({ alg, kid: keyId })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_REFRESH_MINUTES + 3} minutes`)
    .setAudience("appstoreconnect-v1")
    .sign(signingKey);

  return jwt;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// "Patch" in the name used a noun referring to the HTTP method used in the request
// It is kind of dumb that this function's name requires a comment to explain it.
function autoFixPatchError(whatsNew: string, error: ErrorData): string {
  const logUnableToFix = () => core.info(`Unable to auto fix error ${error.code}: "${error.detail}"`);

  const codePrefix = "ENTITY_ERROR.ATTRIBUTE.INVALID.";
  if (!error.code.startsWith(codePrefix) || error.source.pointer !== "whatsNew") {
    logUnableToFix();
    return whatsNew;
  }

  const code = error.code.substring(codePrefix.length);
  switch (code) {
    case "INVALID_TEXT": {
      const match = error.detail.match(/invalid characters:'\[(.*?)\]'\./);
      const characters = match ? match[1].split(", ") : [];
      if (match == null || characters.length === 0) {
        return whatsNew;
      }

      const res = removeCharacters(whatsNew, characters);
      core.warning(
        `Removing ${res.removedCharacters} invalid character${res.removedCharacters === 1 ? "" : "s"} from the changelog based on ${characters.length === 1 ? "this" : ""} ${characters.length} pattern${characters.length === 1 ? "" : "s"}: [${match[1]}] or [${escapeUnicode(match[1])}].`
      );
      return res.text;
    }
    case "TOO_LONG": {
      const characterLimit = 4000;
      const res = limitLength(whatsNew, characterLimit);
      core.warning(
        `Trimming the changelog to ${characterLimit} characters (removed ${res.removedCharacters}).`
      );
      return res.text;
    }
    case "INVALID_TEXT.TOO_SHORT": {
      // minimum length seems to be 4
      core.warning("Changelog is too short, adding invisible characters.");
      return `${whatsNew}   \u{200b}`;
    }
    default:
      break;
  }

  logUnableToFix();
  return whatsNew;
}

function escapeUnicode(str: string): string {
  const chars = [...str];
  const escaped = chars.map(char => {
    if (/^[\0-\x7F]$/.test(char)) {
      // char is ASCII
      return char;
    }

    return char
      .split("")
      .map(byte => {
        const hex = byte.charCodeAt(0).toString(16).padStart(4, "0");
        return `\\u${hex}`;
      })
      .join("");
  });
  return escaped.join("");
}
