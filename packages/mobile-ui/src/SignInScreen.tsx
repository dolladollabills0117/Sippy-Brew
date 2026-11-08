import { useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { Button, Card, ErrorNote, Screen, Text } from "./components";
import { Logo } from "./Logo";
import { supabase } from "./session";
import { colors, radii, spacing, type } from "./theme";

function Input(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text variant="bodyBold" nativeID={`${props.label}-label`}>
        {props.label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={props.label}
        accessibilityLabelledBy={`${props.label}-label`}
        allowFontScaling
        placeholderTextColor={colors.pecan}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          minHeight: 52,
          borderRadius: radii.sm,
          borderWidth: focused ? 3 : 2,
          // Focus indicator: Sky Blue ring on an Espresso edge reads on light surfaces.
          borderColor: focused ? colors.skyBlue : colors.pecan,
          backgroundColor: colors.creamSwirl,
          paddingHorizontal: spacing.lg,
          color: colors.espresso,
          fontFamily: type.body.fontFamily,
          fontSize: type.body.fontSize,
        }}
      />
    </View>
  );
}

/** Email + password sign in / sign up, shared by both apps. Shows the logo only, no app name as text. */
export function SignInScreen({ subtitle, role }: { subtitle: string; role: "member" | "shop_owner" }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim(), role } } });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    if (mode === "up" && !res.data.session) setInfo("Check your email to confirm your account, then sign in.");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <View style={{ paddingTop: spacing.xxl, gap: spacing.sm }}>
          <Logo size={96} />
          <Text variant="h2" accessibilityRole="header">
            {subtitle}
          </Text>
        </View>
        <Card style={{ gap: spacing.lg }}>
          {mode === "up" && <Input label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "in" ? "password" : "new-password"} textContentType={mode === "in" ? "password" : "newPassword"} />
          {error && <ErrorNote message={error} />}
          {info && <Text variant="bodyBold" color={colors.success}>{info}</Text>}
          <Button label={mode === "in" ? "Sign in" : "Create account"} onPress={submit} loading={busy} disabled={!email || password.length < 8} />
          <Button
            variant="ghost"
            label={mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
            onPress={() => setMode(mode === "in" ? "up" : "in")}
          />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}
