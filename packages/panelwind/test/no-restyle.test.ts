import { noRestyle } from '../src/rules/no-restyle';
import { resetBetweenFiles, screen, tester } from './helpers';

resetBetweenFiles();

const LAYOUT = [{ allow: ['layout'] }];

const importButton = 'import { Button } from "@/components/ui/button";\n';
const importCard = 'import { Card, CardTitle, CardContent } from "@/components/ui/card";\n';

tester().run('no-restyle', noRestyle as never, {
  valid: [
    // A component that is not the design system's is not this rule's business.
    { code: '<View className="bg-primary p-4" />', filename: screen, options: LAYOUT },
    {
      code: `${importButton}<Button className="w-full" />`,
      filename: screen,
      options: LAYOUT,
    },
    {
      code: `${importButton}<Button variant="destructive" size="lg" />`,
      filename: screen,
      options: LAYOUT,
    },
    {
      code: `${importButton}<Button className="mt-4" />`,
      filename: screen,
      options: [{ allow: ['layout'], contracts: [{ pattern: '^Button$', allow: ['layout', 'mt-*'] }] }],
    },
    {
      code: `${importCard}<CardTitle className="text-lg" />`,
      filename: screen,
      options: [
        { allow: ['layout'], contracts: [{ pattern: '^CardTitle$', allow: ['layout', 'typography'] }] },
      ],
    },
  ],

  invalid: [
    {
      code: `${importButton}<Button className="bg-destructive" />`,
      filename: screen,
      options: LAYOUT,
      errors: [
        {
          message:
            /"bg-destructive" is not allowed on <Button>: <Button> owns its color\. Use a variant: primary, secondary, destructive\./,
        },
      ],
    },
    {
      code: `${importButton}<Button className="p-6" />`,
      filename: screen,
      options: LAYOUT,
      errors: [{ message: /Use a size \(sm, md, lg\), or gap on the view around it for room around it\./ }],
    },
    {
      code: `${importButton}<Button className="rounded-full" />`,
      filename: screen,
      options: LAYOUT,
      errors: [{ message: /owns its shape/ }],
    },
    {
      code: `${importButton}<Button className="mt-4" />`,
      filename: screen,
      options: LAYOUT,
      errors: [{ message: /owns its spacing/ }],
    },
    {
      code: `${importButton}<Button className="w-full" />`,
      filename: screen,
      options: [{ allow: ['layout'], deny: ['w-full'] }],
      errors: [{ message: /its contract denies w-full/ }],
    },
    {
      code: `${importButton}<Button className="w-full" />`,
      filename: screen,
      options: [{ allow: [], contracts: [{ pattern: '^Button$', allow: [] }] }],
      errors: [{ message: /its contract allows no classes/ }],
    },
    // A wrapper that passes className through is the component it wraps.
    {
      code: `${importButton}
function SaveButton({ className, ...props }) {
  return <Button className={cn("w-full", className)} {...props} />;
}
export function Screen() {
  return <SaveButton className="bg-destructive" />;
}`,
      filename: screen,
      options: LAYOUT,
      errors: [
        { message: /"bg-destructive" is not allowed on <SaveButton>: <SaveButton> passes className to <Button>/ },
      ],
    },
    // A project's own words, with the component's real sizes in them.
    {
      code: `${importButton}<Button className="px-8" />`,
      filename: screen,
      options: [
        {
          allow: ['layout'],
          message: { spacing: 'Use a {{component}} size: {{sizes}}.' },
        },
      ],
      errors: [{ message: 'Use a Button size: sm, md, lg.' }],
    },
    {
      code: `${importCard}<CardTitle className="text-destructive" />`,
      filename: screen,
      options: [
        { allow: ['layout'], contracts: [{ pattern: '^CardTitle$', allow: ['layout', 'typography'] }] },
      ],
      errors: [{ message: /owns its color/ }],
    },
  ],
});

tester({ panelwind: { note: 'See DESIGN.md for the exceptions we have agreed.' } }).run(
  'no-restyle (with a project note)',
  noRestyle as never,
  {
    valid: [],
    invalid: [
      {
        code: `${importButton}<Button className="bg-destructive" />`,
        filename: screen,
        options: LAYOUT,
        errors: [{ message: /See DESIGN\.md for the exceptions we have agreed\.$/ }],
      },
    ],
  }
);
