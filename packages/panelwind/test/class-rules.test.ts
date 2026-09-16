import * as path from 'node:path';

import { noUnknownClasses } from '../src/rules/no-unknown-classes';
import { noWebOnlyClasses } from '../src/rules/no-web-only-classes';
import { fixture, resetBetweenFiles, screen, tester } from './helpers';

resetBetweenFiles();

tester().run('no-unknown-classes', noUnknownClasses as never, {
  valid: [
    { code: '<View className="p-4 gap-2 bg-primary rounded-lg" />', filename: screen },
    { code: '<View className="ios:flex android:hidden pt-safe" />', filename: screen },
    { code: '<View className="md:flex-row dark:bg-card active:opacity-80" />', filename: screen },
    {
      code: '<View className="rounded-huge" />',
      filename: screen,
      options: [{ allow: ['rounded-huge'] }],
    },
  ],
  invalid: [
    {
      code: '<View className="rounded-huge" />',
      filename: screen,
      errors: [{ message: /generates no CSS in this project/ }],
    },
    {
      code: '<View className="bg-highlight p-4" />',
      filename: screen,
      errors: [{ message: /"bg-highlight" generates no CSS/ }],
    },
    {
      code: '<View className="hovr:flex" />',
      filename: screen,
      errors: [{ message: /"hovr" is not a variant it declares/ }],
    },
    {
      code: 'const styles = cn("p-4", "rounded-hug");',
      filename: screen,
      errors: [{ message: /Did you mean "rounded-lg"/ }],
    },
    {
      // The fragments either side of an expression are dropped; the classes
      // written out in full are still checked.
      code: '<View className={`rounded-huge bg-${tone} p-4`} />',
      filename: screen,
      errors: [{ message: /"rounded-huge" generates no CSS/ }],
    },
  ],
});

tester().run('no-web-only-classes', noWebOnlyClasses as never, {
  valid: [
    { code: '<View className="p-4 gap-2 flex-row items-center" />', filename: screen },
    { code: '<View className="active:opacity-80 disabled:opacity-40 focus:border-primary" />', filename: screen },
    { code: '<View className="md:flex-row dark:bg-card ios:pt-safe" />', filename: screen },
    // cursor and userSelect are in React Native's own style types.
    { code: '<View className="cursor-pointer select-none" />', filename: screen },
    // A browser file, and a class marked for the browser, are both deliberate.
    {
      code: '<View className="space-x-2 hover:bg-primary" />',
      filename: path.join(fixture, 'src', 'app', 'screen.web.tsx'),
    },
    { code: '<View className="web:hover:bg-primary" />', filename: screen },
    // Half a class is not a class: `text-` belongs to no-unknown-classes only
    // when somebody actually wrote it.
    { code: '<View className={`text-${size}`} />', filename: screen },
  ],
  invalid: [
    {
      code: '<View className="space-x-2" />',
      filename: screen,
      errors: [{ message: /rule about the elements inside/ }],
    },
    {
      code: '<View className="divide-y" />',
      filename: screen,
      errors: [{ message: /does nothing on a device/ }],
    },
    {
      code: '<View className="float-right" />',
      filename: screen,
      errors: [{ message: /React Native has no float/ }],
    },
    {
      code: '<View className="grid" />',
      filename: screen,
      // React Native has a display; grid is not one of its values, and saying
      // "React Native has no display" would be false.
      errors: [
        {
          message:
            /React Native's display does not take grid — only contents, flex and none\./,
        },
      ],
    },
    {
      code: '<View className="backdrop-blur-sm" />',
      filename: screen,
      errors: [{ message: /does nothing on a device/ }],
    },
    {
      code: '<Pressable className="hover:bg-primary" />',
      filename: screen,
      errors: [{ message: /touch screen has no hover state/ }],
    },
    {
      code: '<View className="group-hover:opacity-100" />',
      filename: screen,
      errors: [{ message: /no selector that reaches from a parent to a child/ }],
    },
    {
      code: '<View className="first:mt-0" />',
      filename: screen,
      errors: [{ message: /position among siblings/ }],
    },
  ],
});
