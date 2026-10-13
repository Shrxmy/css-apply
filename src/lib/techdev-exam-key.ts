import "server-only";

/** Choice keys are never sent to the applicant browser. */
export const TECHDEV_CHOICE_ANSWERS: Record<string, string> = {
  "git-1": "git switch -c feature",
  "git-2": "git fetch",
  "git-3": "To review and merge proposed changes",
  "js-1": "[2, 4, 6]",
  "js-2": "object",
  "js-3": "filter",
  "ts-1": "string | number",
  "ts-2": "interface",
  "ts-3": "Unsafe null and undefined access",
  "python-1": "[2, 4]",
  "python-2": "set",
  "python-3": "Hello, CSS!",
  "web-2": "404",
  "web-3": "To adapt styles to viewport/device conditions",
};
