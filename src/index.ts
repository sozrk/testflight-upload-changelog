import * as core from "@actions/core";
import { HttpClient } from "@actions/http-client";
import { BearerCredentialHandler } from "@actions/http-client/lib/auth";
import * as jose from "jose";
import * as util from "util";
import { Version } from "./version";

const API_URL = "https://api.appstoreconnect.apple.com/v1";

let client: HttpClient;
main().catch(error => {
  core.setFailed(error);
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

  if (!disableDefaultTimeout) {
    core.info("Setting default timeout to 25 minutes");
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

  const apps = await client.getJson<GenericResponse>(`${API_URL}/apps?filter[bundleId]=${bundleId}`);
  if (apps.result?.data[0] == undefined) {
    throw new Error("App not found");
  }
  const appId = apps.result.data[0].id;
  core.debug(`App ID: ${appId}`);

  const parsedVersion = new Version(appVersion);
  const version = parsedVersion.number ?? parsedVersion.name;
  const preReleaseVersion = parsedVersion.name;
  core.info(`${appVersion} -> ${version} (${preReleaseVersion})`);

  const start = performance.now();
  let buildId: string | undefined;
  while (buildId == undefined) {
    const builds = await client.getJson<GenericResponse>(
      `${API_URL}/builds?filter[app]=${appId}&filter[version]=${version}&filter[preReleaseVersion.version]=${preReleaseVersion}&sort=-uploadedDate&limit=1&fields[builds]=`
    );
    core.debug(JSON.stringify(builds.result?.data, null, 2));
    buildId = builds.result?.data[0]?.id;
    if (buildId != undefined) {
      break;
    }
    await sleep(60 * 1000);
  }
  core.info(`Build found in ${((performance.now() - start) / 1000).toFixed(2)}s`);
  core.debug(`Build ID: ${buildId}`);

  const localizations = await client.getJson<GenericResponse>(
    `${API_URL}/builds/${buildId}/betaBuildLocalizations`
  );
  if ((localizations.result?.data ?? []).length === 0) {
    core.warning("No localizations found");
  }
  for (const localization of localizations.result?.data ?? []) {
    const id = localization.id;
    const newLocalization = await client.patchJson<BetaBuildLocalizationResponse>(
      `${API_URL}/betaBuildLocalizations/${id}`,
      {
        data: {
          id,
          type: "betaBuildLocalizations",
          attributes: {
            whatsNew,
          },
        },
      } satisfies BetaBuildLocalizationUpdateRequest
    );

    core.info(`Updated localization for locale ${newLocalization.result?.data.attributes?.locale}`);
  }

  client.dispose();
  process.exit(0); // to kill the timeout and any other pending promises
}

async function generateToken(issuerId: string, keyId: string, privateKey: string): Promise<string> {
  const alg = "ES256";
  const signingKey = await jose.importPKCS8(privateKey, alg);

  const jwt = await new jose.SignJWT()
    .setProtectedHeader({ alg, kid: keyId })
    .setIssuer(issuerId)
    .setIssuedAt()
    .setExpirationTime("18 minutes")
    .setAudience("appstoreconnect-v1")
    .sign(signingKey);

  return jwt;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type GenericResponse = Paginated<{ id: string }>;

interface Paginated<T> {
  data: T[];
  meta: {
    paging: {
      total: number;
      limit: number;
    };
  };
}

interface BetaBuildLocalizationUpdateRequest {
  data: {
    id: string;
    type: "betaBuildLocalizations";
    attributes: {
      whatsNew: string;
    };
  };
}

interface BetaBuildLocalizationResponse {
  data: {
    attributes?: {
      locale?: string;
    };
  };
}
