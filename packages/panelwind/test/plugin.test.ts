/**
 * The plugin as somebody installs it: a flat config, the recommended preset,
 * and a real file in a real project.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import panelwind, { configs, rules } from '../src/index';
import { screen } from './helpers';

const linter = new Linter({ configType: 'flat' });

function lint(code: string, filename = screen) {
  return linter.verify(code, configs.recommended as never, filename);
}

describe('the plugin', () => {
  it('names its rules under one namespace', () => {
    expect(panelwind.meta.name).toBe('panelwind');
    expect(Object.keys(rules).sort()).toEqual([
      'no-arbitrary-values',
      'no-inline-styles',
      'no-raw-colors',
      'no-restyle',
      'no-unknown-classes',
      'no-web-only-classes',
      'require-static-classes',
    ]);
  });

  it('is the same object by name and by default, so the presets find it', () => {
    expect(panelwind.configs).toBe(configs);
  });

  it('gives every rule a description and a documentation link', () => {
    for (const [name, rule] of Object.entries(rules)) {
      expect(rule.meta.docs.description, name).toBeTruthy();
      expect(rule.meta.docs.url, name).toContain(`docs/rules/${name}.md`);
    }
  });
});

describe('the recommended preset', () => {
  it('parses TSX without any other configuration', () => {
    const messages = lint('export const Screen = () => <View className="p-4 gap-2" />;');
    expect(messages).toEqual([]);
  });

  it('errors on what the compiler can prove, and warns on what is policy', () => {
    const messages = lint(
      'import { Button } from "@/components/ui/button";\n' +
        'export const Screen = () => <Button className="space-x-2 bg-zinc-500" />;'
    );
    const bySeverity = Object.fromEntries(
      messages.map((message) => [message.ruleId, message.severity])
    );
    expect(bySeverity['panelwind/no-web-only-classes']).toBe(2);
    expect(bySeverity['panelwind/no-raw-colors']).toBe(1);
    expect(bySeverity['panelwind/no-restyle']).toBe(1);
  });

  it('reads a component out of the project it is linting', () => {
    const [message] = lint(
      'import { Button } from "@/components/ui/button";\n' +
        'export const Screen = () => <Button className="bg-destructive" />;'
    ).filter((entry) => entry.ruleId === 'panelwind/no-restyle');
    expect(message?.message).toContain('Use a variant: primary, secondary, destructive');
  });

  it('stands down on a file that belongs to no project it can read', () => {
    // No panelui.json, no package.json, no stylesheet: there is nothing to
    // check a class against, and a linter with no theme must not invent one.
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'panelwind-'));
    const messages = lint(
      'export const Screen = () => <View className="rounded-huge" />;',
      path.join(elsewhere, 'loose.tsx')
    );
    fs.rmSync(elsewhere, { recursive: true, force: true });
    expect(messages.map((message) => message.ruleId)).not.toContain(
      'panelwind/no-unknown-classes'
    );
  });
});
