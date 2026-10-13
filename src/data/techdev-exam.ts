export type TechDevExamQuestion = {
  id: string;
  section: "Git" | "JavaScript" | "TypeScript" | "Python" | "Web fundamentals";
  prompt: string;
  kind: "choice" | "code";
  code?: string;
  options?: string[];
};

/** Public exam content. Answer keys stay on the server. */
export const TECHDEV_EXAM_VERSION = "techdev-v1";
export const TECHDEV_EXAM_DURATION_MINUTES = 45;

export const TECHDEV_EXAM_QUESTIONS: TechDevExamQuestion[] = [
  { id: "git-1", section: "Git", prompt: "Which command creates a new branch and switches to it immediately?", kind: "choice", options: ["git branch -c feature", "git switch -c feature", "git checkout --new feature", "git merge feature"] },
  { id: "git-2", section: "Git", prompt: "Which command downloads remote changes without merging them into the current branch?", kind: "choice", options: ["git fetch", "git pull", "git sync", "git clone"] },
  { id: "git-3", section: "Git", prompt: "What is the main purpose of a pull request?", kind: "choice", options: ["To delete a branch", "To review and merge proposed changes", "To create a local repository", "To reset a commit"] },
  { id: "git-4", section: "Git", prompt: "Resolve this merge conflict and explain which line should remain.", kind: "code", code: "<<<<<<< HEAD\nconst port = 3000;\n=======\nconst port = 8080;\n>>>>>>> feature/config" },
  { id: "js-1", section: "JavaScript", prompt: "What does this print?", kind: "choice", code: "const values = [1, 2, 3];\nconsole.log(values.map((value) => value * 2));", options: ["[1, 2, 3]", "[2, 4, 6]", "6", "undefined"] },
  { id: "js-2", section: "JavaScript", prompt: "What does this print?", kind: "choice", code: "console.log(typeof null);", options: ["null", "object", "undefined", "Error"] },
  { id: "js-3", section: "JavaScript", prompt: "Which array method creates a new array containing only values that pass a condition?", kind: "choice", options: ["map", "filter", "reduce", "forEach"] },
  { id: "js-4", section: "JavaScript", prompt: "Explain one practical difference between let and const.", kind: "code" },
  { id: "ts-1", section: "TypeScript", prompt: "Which type safely represents a value that can be either a string or a number?", kind: "choice", options: ["string & number", "string | number", "any", "unknown[]"] },
  { id: "ts-2", section: "TypeScript", prompt: "Which keyword defines a named object shape that can be extended?", kind: "choice", options: ["interface", "package", "module", "namespace-only"] },
  { id: "ts-3", section: "TypeScript", prompt: "What problem does strictNullChecks help detect?", kind: "choice", options: ["Unused CSS", "Unsafe null and undefined access", "Slow network requests", "Duplicate imports"] },
  { id: "ts-4", section: "TypeScript", prompt: "Write a type for a function that accepts two numbers and returns a number.", kind: "code" },
  { id: "python-1", section: "Python", prompt: "What is the value of result after this code runs?", kind: "choice", code: "items = [1, 2, 3, 4]\nresult = [item for item in items if item % 2 == 0]", options: ["[1, 3]", "[2, 4]", "[0, 2, 4]", "4"] },
  { id: "python-2", section: "Python", prompt: "Which data structure stores unique values without preserving duplicates?", kind: "choice", options: ["list", "tuple", "set", "dict values"] },
  { id: "python-3", section: "Python", prompt: "What does this print?", kind: "choice", code: "name = \"CSS\"\nprint(f\"Hello, {name}!\")", options: ["Hello, name!", "Hello, CSS!", "fHello, CSS!", "SyntaxError"] },
  { id: "python-4", section: "Python", prompt: "Write a function that returns the largest number in a list without using max().", kind: "code" },
  { id: "web-1", section: "Web fundamentals", prompt: "Write a semantic HTML structure for a page header containing the site name and primary navigation.", kind: "code" },
  { id: "web-2", section: "Web fundamentals", prompt: "Which HTTP status code commonly indicates that a resource was not found?", kind: "choice", options: ["200", "301", "404", "500"] },
  { id: "web-3", section: "Web fundamentals", prompt: "What is the main purpose of responsive CSS media queries?", kind: "choice", options: ["To query a database", "To adapt styles to viewport/device conditions", "To encrypt requests", "To compile TypeScript"] },
  { id: "web-4", section: "Web fundamentals", prompt: "Describe two accessibility improvements you would make to a form.", kind: "code" },
];
