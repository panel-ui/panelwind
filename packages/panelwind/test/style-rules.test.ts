import { noInlineStyles } from '../src/rules/no-inline-styles';
import { requireStaticClasses } from '../src/rules/require-static-classes';
import { resetBetweenFiles, screen, tester } from './helpers';

resetBetweenFiles();

const importButton = 'import { Button } from "@/components/ui/button";\n';

tester().run('no-inline-styles', noInlineStyles as never, {
  valid: [
    { code: '<View className="p-4 bg-card" />', filename: screen },
    // An animated style is a value that changes; it has to be an object.
    {
      code: 'const style = useAnimatedStyle(() => ({ opacity: progress.value }));\n<Animated.View style={style} />',
      filename: screen,
    },
    { code: '<Animated.View style={{ opacity: progress.value }} />', filename: screen },
    { code: '<View style={{ height: measured }} />', filename: screen },
    { code: '<View style={{ transform: [{ scale: 1 }] }} />', filename: screen },
    {
      code: '<View style={{ padding: 12 }} />',
      filename: screen,
      options: [{ allow: ['padding'] }],
    },
    {
      code: 'const styles = StyleSheet.create({ row: { gap: 8 } });',
      filename: screen,
      options: [{ stylesheets: false }],
    },
  ],

  invalid: [
    {
      code: '<View style={{ padding: 12, backgroundColor: "#fff" }} />',
      filename: screen,
      errors: [{ message: /sets padding and backgroundColor, which a class can express/ }],
    },
    {
      code: `${importButton}<Button style={{ marginTop: 8 }} />`,
      filename: screen,
      errors: [{ message: /sets marginTop on <Button>/ }],
    },
    {
      code: 'const styles = StyleSheet.create({ row: { flexDirection: "row", gap: 8 } });',
      filename: screen,
      errors: [{ message: /StyleSheet.create sets flexDirection and gap in "row"/ }],
    },
  ],
});

tester().run('require-static-classes', requireStaticClasses as never, {
  valid: [
    {
      code: `${importButton}<Button className={tone === "danger" ? "bg-destructive" : "bg-primary"} />`,
      filename: screen,
    },
    // A className a component was handed is answered for where it was written.
    {
      code: `${importButton}
export function Save({ className }) {
  return <Button className={className} />;
}`,
      filename: screen,
    },
    // Not a design-system component, and the rule was not asked to look wider.
    { code: '<View className={styles} />', filename: screen },
  ],

  invalid: [
    {
      code: `${importButton}<Button className={\`bg-\${tone}\`} />`,
      filename: screen,
      errors: [{ message: /cannot be read, so the bundler never sees the class/ }],
    },
    {
      code: `${importButton}<Button className={props.tone} />`,
      filename: screen,
      errors: [{ message: /on <Button> cannot be read/ }],
    },
    {
      code: '<View className={makeClasses(tone)} />',
      filename: screen,
      options: [{ everywhere: true }],
      errors: [{ message: /cannot be read/ }],
    },
  ],
});
