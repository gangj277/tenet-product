const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { notarize } = require("@electron/notarize");

function getNotarizeAuth(env) {
  if (env.APPLE_KEYCHAIN_PROFILE) {
    return {
      keychainProfile: env.APPLE_KEYCHAIN_PROFILE,
    };
  }

  if (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) {
    return {
      appleApiKey: env.APPLE_API_KEY,
      appleApiKeyId: env.APPLE_API_KEY_ID,
      appleApiIssuer: env.APPLE_API_ISSUER,
    };
  }

  if (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) {
    return {
      appleId: env.APPLE_ID,
      appleIdPassword: env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: env.APPLE_TEAM_ID,
    };
  }

  return null;
}

module.exports = async function notarizeApp(context) {
  if (process.platform !== "darwin" || context.electronPlatformName !== "darwin") {
    return;
  }

  const auth = getNotarizeAuth(process.env);
  if (!auth) {
    throw new Error(
      "Missing Apple notarization credentials. Set APPLE_KEYCHAIN_PROFILE, or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, or APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID."
    );
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  await notarize({
    appPath,
    ...auth,
  });

  execFileSync("xcrun", ["stapler", "staple", appPath], {
    stdio: "inherit",
  });
};
