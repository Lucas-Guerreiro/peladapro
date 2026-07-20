import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const COLORS = {
  primary: '#1D9E75',
  darkText: '#2C3E50',
  lightGray: '#F5F5F5',
  muted: '#7F8C8D',
  error: '#E74C3C',
  success: '#1D9E75',
  white: '#FFFFFF',
};

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const hasMinLength = senha.length >= 8;
  const hasNumber = /\d/.test(senha);
  const hasSymbol = /[^A-Za-z0-9]/.test(senha);

  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      return digits.length ? `(${digits}` : '';
    }
    if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSignUp = async () => {
    setError('');
    setSuccess('');

    if (!nome.trim()) {
      setError('Informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setError('Informe seu email.');
      return;
    }
    if (!senha) {
      setError('Crie uma senha.');
      return;
    }
    if (!hasMinLength || !hasNumber || !hasSymbol) {
      setError('A senha não atende aos requisitos.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await signUp(email.trim(), senha, nome.trim());

      if (signUpError) {
        setError(signUpError.message || 'Não foi possível criar a conta.');
        setLoading(false);
        return;
      }

      if (telefone.trim()) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (userId) {
            await supabase
              .from('profiles')
              .update({ telefone: telefone.trim() })
              .eq('id', userId);
          }
        } catch (e) {
          // telefone é opcional, ignoramos falhas silenciosamente
        }
      }

      setSuccess('Conta criada com sucesso!');
      setLoading(false);
      setTimeout(() => {
        router.replace('..');
      }, 600);
    } catch (err) {
      setError(err?.message || 'Ocorreu um erro inesperado.');
      setLoading(false);
    }
  };

  const Requirement = ({ met, label }) => (
    <View style={styles.reqItem}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'close-circle'}
        size={14}
        color={met ? COLORS.success : COLORS.error}
      />
      <Text style={[styles.reqText, { color: met ? COLORS.success : COLORS.muted }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.darkText} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Cadastro</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="football" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.heading}>Crie sua conta</Text>
          <Text style={styles.subtitle}>Preencha os dados para começar</Text>
        </View>

        {error ? (
          <View style={styles.messageBoxError}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.messageTextError}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.messageBoxSuccess}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            <Text style={styles.messageTextSuccess}>{success}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>Nome completo</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Seu nome completo"
              placeholderTextColor={COLORS.muted}
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="voce@email.com"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Telefone</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="call-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="(11) 99999-9999"
              placeholderTextColor={COLORS.muted}
              value={telefone}
              onChangeText={(text) => setTelefone(formatPhone(text))}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.muted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Crie uma senha segura"
              placeholderTextColor={COLORS.muted}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={COLORS.muted}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.requirementsRow}>
            <Requirement met={hasMinLength} label="8+ caracteres" />
            <Requirement met={hasNumber} label="Número" />
            <Requirement met={hasSymbol} label="Símbolo" />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Criar Conta</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <Link href="../login" style={styles.footerLink}>
            Fazer login
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(29, 158, 117, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.darkText,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  messageBoxError: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 76, 60, 0.10)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  messageTextError: {
    marginLeft: 8,
    color: COLORS.error,
    fontSize: 13,
    flex: 1,
  },
  messageBoxSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 158, 117, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  messageTextSuccess: {
    marginLeft: 8,
    color: COLORS.success,
    fontSize: 13,
    flex: 1,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.darkText,
    height: '100%',
  },
  requirementsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 12,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reqText: {
    marginLeft: 4,
    fontSize: 12,
  },
  button: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  footerLink: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
  },
});