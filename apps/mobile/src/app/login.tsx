import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, colors, styles } from '../components/ui';
import { ApiError } from '../lib/api';
import { useApp } from '../lib/app-state';
import { normalizeCompanyCode } from '../lib/rules';
import { keys, readJson } from '../lib/storage';

export default function LoginScreen() {
  const { login, sessionMessage } = useApp();
  const [companyCode, setCompanyCode] = useState('');
  const [matricula, setMatricula] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const matriculaRef = useRef<TextInputInstance>(null);

  // O celular costuma ser sempre da mesma empresa: já traz o último código usado.
  useEffect(() => {
    readJson<string>(keys.lastCompanyCode).then((code) => {
      if (code) setCompanyCode((current) => current || code);
    });
  }, []);

  async function submit() {
    const code = normalizeCompanyCode(companyCode);
    const mat = matricula.trim();
    if (!code || !mat) {
      setError(!code ? 'Informe o código da empresa.' : 'Informe a sua matrícula.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(code, mat);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente de novo.');
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>✓</Text>
            </View>
            <Text style={[styles.title, { fontSize: 28 }]}>CHECK-ON</Text>
            <Text style={styles.muted}>Inspeção de veículos</Text>
          </View>

          {sessionMessage && !error && <Banner tone="warning" title="Entre de novo">{sessionMessage}</Banner>}

          <View>
            <Text style={styles.label}>Código da empresa</Text>
            <TextInput
              testID="company-code"
              style={[styles.input, { letterSpacing: 1 }]}
              value={companyCode}
              onChangeText={(text) => setCompanyCode(text.toUpperCase())}
              placeholder="Ex.: VISTECSSQV"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
              maxLength={20}
              onSubmitEditing={() => matriculaRef.current?.focus()}
              submitBehavior="submit"
            />
          </View>
          <View>
            <Text style={styles.label}>Matrícula</Text>
            <TextInput
              testID="matricula"
              ref={matriculaRef}
              style={styles.input}
              value={matricula}
              onChangeText={setMatricula}
              placeholder="A sua matrícula na empresa"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="go"
              maxLength={40}
              onSubmitEditing={submit}
            />
          </View>

          {error && <Banner tone="danger" title="Não foi possível entrar">{error}</Banner>}

          <Button title="Entrar" large loading={loading} onPress={submit} testID="login-submit" />
          <Text style={[styles.muted, { textAlign: 'center' }]}>
            O acesso é criado pela sua empresa no portal CHECK-ON. Se não conseguir entrar, fale com o seu gestor.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
