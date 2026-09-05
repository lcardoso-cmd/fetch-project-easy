declare const __JURISMIND_BUILD_SHA__: string;
declare const __JURISMIND_BUILD_TIME__: string;

const sha = __JURISMIND_BUILD_SHA__;

export const BUILD_INFO = Object.freeze({
  service: "jurismind",
  commit: sha,
  shortCommit: sha === "unknown" ? "unknown" : sha.slice(0, 8),
  builtAt: __JURISMIND_BUILD_TIME__,
  identifiable: sha !== "unknown",
});
