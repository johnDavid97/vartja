export type PollDefinition = {
  id: string;
  question: string;
  options: { id: string; label: string }[];
  open: boolean;
};

export type PollResults = {
  canVote?: boolean;
  selectedOption: string | null;
  total: number;
  open: boolean;
  options: { id: string; count: number }[];
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

export function parsePoll(value: unknown): PollDefinition | null {
  const fields = record(value);
  if (!fields || typeof fields.id !== "string" || !fields.id || fields.id.length > 128 ||
      typeof fields.question !== "string" || !fields.question.trim() || fields.question.length > 200 ||
      !Array.isArray(fields.options) || fields.options.length < 2 || fields.options.length > 10) return null;
  const options: PollDefinition["options"] = [];
  for (const value of fields.options) {
    const option = record(value);
    if (!option || typeof option.id !== "string" || !option.id || option.id.length > 128 ||
        typeof option.label !== "string" || !option.label.trim() || option.label.length > 120) return null;
    options.push({ id: option.id, label: option.label.trim() });
  }
  if (new Set(options.map((option) => option.id)).size !== options.length) return null;
  if (new Set(options.map((option) => option.label.toLocaleLowerCase())).size !== options.length) return null;
  return { id: fields.id, question: fields.question.trim(), options, open: fields.open !== false };
}

export function getPollFields(body: unknown): unknown[] {
  const polls: unknown[] = [];
  function visit(value: unknown) {
    const node = record(value);
    if (!node) return;
    const fields = record(node.fields);
    if (node.type === "block" && fields?.blockType === "poll") {
      polls.push(fields);
    }
    if (Array.isArray(node.children)) node.children.forEach(visit);
  }
  visit(record(body)?.root);
  return polls;
}

export function getPolls(body: unknown): PollDefinition[] {
  return getPollFields(body).map(parsePoll).filter((poll): poll is PollDefinition => poll !== null);
}

/** Reordering choices is fine; changing what existing votes mean is not. */
export function samePollChoices(a: PollDefinition, b: PollDefinition): boolean {
  const choices = (poll: PollDefinition) => JSON.stringify([...poll.options].sort((x, y) => x.id.localeCompare(y.id)));
  return a.question === b.question && choices(a) === choices(b);
}
