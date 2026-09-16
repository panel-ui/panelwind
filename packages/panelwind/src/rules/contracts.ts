/**
 * What a component allows, and what it refuses.
 *
 * A policy is written in two vocabularies at once: categories, which say what
 * kind of change is allowed — "layout, and nothing else" — and class patterns,
 * which name exceptions: `w-full`, `mt-*`. A contract attaches a policy to the
 * components whose name matches a pattern, so one component can be opened up
 * without opening up the rest.
 */
import { classify, CATEGORIES, type Category, type Vocabulary } from '../grammar/categories';
import { parseClass, utilityName } from '../grammar/classes';

export type Message = string | Record<string, string>;

export type Policy = {
  allow?: string[];
  deny?: string[];
  message?: Message;
};

export type Contract = Policy & { pattern: string };

export type Verdict =
  | { kind: 'ok' }
  | {
      kind: 'denied' | 'not-allowed';
      category: Category;
      entries: string[];
      message: string | undefined;
    };

const CATEGORY_NAMES = new Set<string>([...CATEGORIES, 'unclassified']);

class ConfigError extends Error {}

type Compiled = {
  pattern: RegExp | null;
  allow: string[];
  deny: string[];
  message: Message | undefined;
};

export function compileContracts(contracts: Contract[] | undefined, base: Policy) {
  const compiled: Compiled[] = [];

  for (const contract of contracts ?? []) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(contract.pattern);
    } catch {
      throw new ConfigError(`"${contract.pattern}" is not a valid pattern.`);
    }
    compiled.push({
      pattern,
      // A contract that names allowances replaces the rule's, so `layout` has
      // to be repeated to keep it — which is what makes a closed contract
      // possible at all.
      allow: contract.allow ?? base.allow ?? [],
      deny: contract.deny ?? base.deny ?? [],
      message: contract.message ?? base.message,
    });
  }

  const fallback: Compiled = {
    pattern: null,
    allow: base.allow ?? [],
    deny: base.deny ?? [],
    message: base.message,
  };

  const policyFor = (component: string): Compiled => {
    for (const candidate of compiled) {
      if (candidate.pattern?.test(component)) return candidate;
    }
    return fallback;
  };

  return {
    /** Whether this component may carry this class, and if not, why not. */
    decide(component: string, token: string, vocabulary: Vocabulary): Verdict {
      const policy = policyFor(component);
      const category = classify(token, vocabulary);

      if (policy.deny.some((entry) => matches(entry, token, category))) {
        return {
          kind: 'denied',
          category,
          entries: policy.deny,
          message: messageFor(policy.message, category),
        };
      }
      if (policy.allow.some((entry) => matches(entry, token, category))) {
        return { kind: 'ok' };
      }
      return {
        kind: 'not-allowed',
        category,
        entries: policy.allow,
        message: messageFor(policy.message, category),
      };
    },

    /** Whether any component's policy accepts this class — used for guidance. */
    accepts(component: string, token: string, vocabulary: Vocabulary): boolean {
      return this.decide(component, token, vocabulary).kind === 'ok';
    },
  };
}

/** A category name, a class name, or a class pattern with a `*` in it. */
function matches(entry: string, token: string, category: Category): boolean {
  if (CATEGORY_NAMES.has(entry)) return entry === category;
  const { base } = parseClass(token);
  const name = utilityName(base);
  if (entry.includes('*')) {
    const pattern = new RegExp(`^${entry.split('*').map(escape).join('.*')}$`);
    return pattern.test(token) || pattern.test(base) || pattern.test(name);
  }
  return entry === token || entry === base || entry === name;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function messageFor(message: Message | undefined, category: Category): string | undefined {
  if (!message) return undefined;
  if (typeof message === 'string') return message;
  return message[category] ?? message.default;
}

/**
 * A rule whose options do not compile reports that once, on the file being
 * linted, rather than throwing and taking the whole run down.
 */
export function configErrorVisitors(context: any, error: unknown) {
  return {
    Program(node: any) {
      context.report({
        node,
        message: `panelwind: ${(error as Error).message}`,
      });
    },
  };
}
