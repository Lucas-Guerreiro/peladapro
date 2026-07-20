import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './src/hooks/useAuth';
import { supabase } from './src/lib/supabase';

const COLORS = {
  green: '#1D9E75',
  greenDark: '#15795A',
  dark: '#2C3E50',
  gray: '#F5F5F5',
  white: '#FFFFFF',
  error: '#E74C3C',
  muted: '#7F8C8D',
};

const Stack = createNativeStackNavigator();

function LogoTitle() {
  return (
    <View style={styles.logoContainer}>
      <View style={styles.logoBadge}>
        <Text style={styles.logoBadgeText}>PP</Text>
      </View>
      <Text style={styles.logoTitle}>Pelada Pro</Text>
    </View>
  );
}

function AuthButton({ title, onPress, loading, disabled }) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, (disabled || loading) && styles.primaryButtonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.white} />
      ) : (
        <Text style={styles.primaryButtonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function LinkText({ text, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={styles.linkWrap}>
      <Text style={styles.linkText}>{text}</Text>
    </TouchableOpacity>
  );
}

function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) {
        setError(signInError.message || 'Não foi possível entrar.');
      }
    } catch (e) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.gray} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <LogoTitle />
          <Text style={styles.subtitle}>Entre para organizar suas peladas</Text>

          <View style={styles.card}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
n              autoComplete="password"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AuthButton
              title="Entrar"
              onPress={handleSignIn}
              loading={loading}
              disabled={loading}
            />
          </View>

          <LinkText
            text="Não tem conta? Criar agora"
            onPress={() => navigation.navigate('SignUp')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignUpScreen({ navigation }) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSignUp = async () => {
    setError('');
    setSuccess('');
    if (!name.trim() || !email.trim() || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await signUp(email.trim(), password, name.trim());
      if (signUpError) {
        setError(signUpError.message || 'Não foi possível criar a conta.');
      } else {
        setSuccess('Conta criada! Verifique seu e-mail se necessário e entre.');
        setName('');
        setEmail('');
        setPassword('');
      }
    } catch (e) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.gray} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <LogoTitle />
          <Text style={styles.subtitle}>Crie sua conta gratuita</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Text style={styles.label}>Senha</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <AuthButton
              title="Criar Conta"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
            />
          </View>

          <LinkText
            text="Já tem conta? Entrar"
            onPress={() => navigation.navigate('Login')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function HomeScreen() {
  const { user, signOut } = useAuth();
  const [loadingOut, setLoadingOut] = useState(false);

  const handleSignOut = async () => {
    setLoadingOut(true);
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível sair.');
    } finally {
      setLoadingOut(false);
    }
  };

  const email = user?.email || 'usuário';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.gray} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.homeHeader}>
          <LogoTitle />
          <Text style={styles.welcomeTitle}>Bem-vindo!</Text>
          <Text style={styles.welcomeSubtitle}>{email}</Text>
        </View>

        <View style={styles.greenCard}>
          <View style={styles.greenCardHeader}>
            <Text style={styles.greenCardLabel}>PRÓXIMA PELADA</Text>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>Agendada</Text>
            </View>
          </View>
          <Text style={styles.greenCardTitle}>Próxima Pelada</Text>
          <Text style={styles.greenCardInfo}>Nenhuma pelada agendada ainda.</Text>
          <Text style={styles.greenCardHint}>
            Crie uma pelada e convide seus amigos para jogar.
          </Text>
        </View>

        <View style={styles.dashboardRow}>
          <View style={styles.dashboardItem}>
            <Text style={styles.dashboardItemValue}>0</Text>
            <Text style={styles.dashboardItemLabel}>Peladas</Text>
          </View>
          <View style={styles.dashboardDivider} />
          <View style={styles.dashboardItem}>
            <Text style={styles.dashboardItemValue}>0</Text>
            <Text style={styles.dashboardItemLabel}>Jogadores</Text>
          </View>
          <View style={styles.dashboardDivider} />
          <View style={styles.dashboardItem}>
            <Text style={styles.dashboardItemValue}>0</Text>
            <Text style={styles.dashboardItemLabel}>Convidados</Text>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleSignOut}
          disabled={loadingOut}
          activeOpacity={0.85}
        >
          {loadingOut ? (
            <ActivityIndicator color={COLORS.error} />
          ) : (
            <Text style={styles.logoutButtonText}>Sair</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.gray },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.gray },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <NavigationContainer>
      {loading ? (
        <SafeAreaView style={styles.loadingArea}>
          <StatusBar barStyle="dark-content" backgroundColor={COLORS.gray} />
          <ActivityIndicator size="large" color={COLORS.green} />
        </SafeAreaView>
      ) : user ? (
        <AppStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.gray,
  },
  loadingArea: {
    flex: 1,
    backgroundColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  logoBadgeText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.dark,
    letterSpacing: 0.5,
  },
  subtitle: {
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 15,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E1E4E8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.dark,
    backgroundColor: COLORS.gray,
  },
  primaryButton: {
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: COLORS.green,
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  successText: {
    color: COLORS.green,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  homeHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.dark,
    marginTop: 12,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: COLORS.muted,
    marginTop: 4,
  },
  greenCard: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  greenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  greenCardLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  liveBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  greenCardTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  greenCardInfo: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  greenCardHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 4,
  },
  dashboardRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  dashboardItem: {
    flex: 1,
    alignItems: 'center',
  },
  dashboardItemValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.dark,
  },
  dashboardItemLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
  },
  dashboardDivider: {
    width: 1,
    backgroundColor: '#E1E4E8',
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: COLORS.error,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
});