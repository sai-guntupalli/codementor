/** Editor stubs — never pre-fill the solution body. */

type ExampleLike = { input: string };

const LANGUAGE_STUBS: Record<string, string> = {
  python: "# Write your solution below\n\n",
  sql: "-- Write your query below\n\n",
};

const DEFAULT_PYTHON_PARAMS: Record<number, string[]> = {
  0: [],
  1: ["input_list"],
  2: ["input_list", "person"],
  3: ["input_list", "person", "arg3"],
};

export function parseFunctionCallExample(
  input: string
): { name: string; argCount: number } | null {
  const trimmed = input.trim();
  const match = /^([a-z_]\w*)\s*\(([\s\S]*)\)\s*$/i.exec(trimmed);
  if (!match) return null;

  const name = match[1];
  const argsInner = match[2].trim();
  if (!argsInner) return { name, argCount: 0 };

  let argCount = 1;
  let depth = 0;
  for (const ch of argsInner) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    else if (ch === "," && depth === 0) argCount += 1;
  }
  return { name, argCount };
}

function extractDefSignature(
  text: string,
  functionName: string
): { name: string; params: string } | null {
  const defRe = new RegExp(
    `def\\s+(${functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*\\(([^)]*)\\)`,
    "i"
  );
  const defMatch = defRe.exec(text);
  if (defMatch) {
    return { name: defMatch[1], params: defMatch[2].trim() };
  }

  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const backtickRe = new RegExp("`" + escaped + "\\s*\\(([^)]*)\\)`", "i");
  const tickMatch = backtickRe.exec(text);
  if (tickMatch) {
    return { name: functionName, params: tickMatch[1].trim() };
  }

  return null;
}

function defaultParamNames(argCount: number): string {
  const names = DEFAULT_PYTHON_PARAMS[argCount] ?? Array.from({ length: argCount }, (_, i) => `arg${i + 1}`);
  return names.slice(0, argCount).join(", ");
}

export function inferPythonFunctionStarter(
  examples: ExampleLike[],
  description?: string,
  constraints?: string | null
): string | null {
  const callExample = examples
    .map((ex) => parseFunctionCallExample(ex.input))
    .find(Boolean);
  if (!callExample) return null;

  const corpus = [description ?? "", constraints ?? ""].filter(Boolean).join("\n");
  const fromText = extractDefSignature(corpus, callExample.name);

  const params = fromText?.params ?? defaultParamNames(callExample.argCount);
  const fnName = fromText?.name ?? callExample.name;

  return `# Write your solution below\n\ndef ${fnName}(${params}):\n    pass\n`;
}

export function getStarterCode(
  language: string,
  options?: {
    examples?: ExampleLike[];
    description?: string;
    constraints?: string | null;
  }
): string {
  const lang = language.toLowerCase();
  if (lang === "python" && options?.examples?.length) {
    const fnStub = inferPythonFunctionStarter(
      options.examples,
      options.description,
      options.constraints
    );
    if (fnStub) return fnStub;
  }
  return LANGUAGE_STUBS[lang] ?? "# Write your code below\n\n";
}
