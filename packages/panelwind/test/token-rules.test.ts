import { noArbitraryValues } from '../src/rules/no-arbitrary-values';
import { noRawColors } from '../src/rules/no-raw-colors';
import { resetBetweenFiles, screen, tester } from './helpers';

resetBetweenFiles();

tester().run('no-raw-colors', noRawColors as never, {
  valid: [
    { code: '<View className="bg-primary text-foreground border-border" />', filename: screen },
    { code: '<View className="bg-transparent" />', filename: screen },
    { code: '<View className="bg-card/60 text-muted-foreground" />', filename: screen },
    // A colour that comes from the theme at runtime is the supported way out.
    {
      code: 'const tint = useCSSVariable("--color-primary");\n<Icon color={tint} />',
      filename: screen,
    },
    { code: '<View className="bg-[#2563eb]" />', filename: screen, options: [{ allow: ['bg-[#2563eb]'] }] },
  ],

  invalid: [
    {
      code: '<View className="bg-zinc-500" />',
      filename: screen,
      errors: [{ message: /"bg-zinc-500" is not a theme colour\. Use one from .*theme\.css: background/ }],
    },
    {
      code: '<View className="bg-[#2564eb]" />',
      filename: screen,
      errors: [{ message: /Use "bg-primary", which is the token this colour is nearest to/ }],
    },
    {
      code: '<Icon color="#2563eb" />',
      filename: screen,
      errors: [{ message: /color is set to "#2563eb", which is the token "primary"/ }],
    },
    {
      code: '<View style={{ backgroundColor: "#ff0000" }} />',
      filename: screen,
      errors: [{ message: /not a theme colour\. Use a class, or read the token with useCSSVariable/ }],
    },
    {
      code: '<TextInput placeholderTextColor="rgba(255,255,255,0.4)" />',
      filename: screen,
      errors: [{ message: /placeholderTextColor is set to/ }],
    },
    {
      code: 'const palette = { brand: "#2563eb" };',
      filename: screen,
      options: [{ scanAllStrings: true }],
      errors: [{ message: /is the token "primary"/ }],
    },
  ],
});

tester().run('no-arbitrary-values', noArbitraryValues as never, {
  valid: [
    { code: '<View className="p-4 rounded-lg text-base" />', filename: screen },
    { code: '<View className="h-[330px]" />', filename: screen, options: [{ allow: ['h-[330px]'] }] },
  ],

  invalid: [
    {
      code: '<View className="p-[13px]" />',
      filename: screen,
      errors: [{ message: /"p-\[13px\]" is an arbitrary value\..*restarted\./ }],
    },
    {
      code: '<View className="rounded-[10px]" />',
      filename: screen,
      errors: [{ message: /"rounded-lg" is the same size/ }],
    },
    {
      code: '<View className="[padding:12px]" />',
      filename: screen,
      errors: [{ message: /sets a property directly/ }],
    },
  ],
});
