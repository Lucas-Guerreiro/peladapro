import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function Index() {
  const router = useRouter();
  const [email, setEmail] = useState('lucas@teste.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) { setSession(data.session); setChecking(false); }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) setSession(newSession);
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) { setError('Preencha e-mail e senha.'); return; }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    router.replace('./');
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); router.replace('./'); };

  if (checking) return <View style={styles.center}><ActivityIndicator size="large" color="#1D9E75" /></View>;

  if (session) return (
    <View style={styles.container}>
      <View style={styles.logoCircle}><Ionicons name="checkmark" size={48} color="#FFF" /></View>
      <Text style={styles.title}>Login realizado com sucesso!</Text>
      <Text style={styles.emailText}>{session.user?.email}</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/tabs/home')}>
        <Text style={styles.primaryBtnText}>Ir para o Dashboard</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.outlineBtn} onPress={handleSignOut}>
        <Text style={styles.outlineBtnText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.logoCircle}><Ionicons name="football" size={48} color="#FFF" /></View>
      <Text style={styles.title}>Pelada Pro</Text>
      <Text style={styles.subtitle}>Entre na sua conta</Text>
      {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={20} color="#E74C3C" /><Text style={styles.errorText}>{error}</Text></View> : null}
      <View style={styles.inputWrap}><Ionicons name="mail" size={20} color="#7F8C8D" style={{ marginRight: 10 }} /><TextInput style={styles.input} placeholder="E-mail" placeholderTextColor="#95A5A6" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></View>
      <View style={styles.inputWrap}><Ionicons name="lock-closed" size={20} color="#7F8C8D" style={{ marginRight: 10 }} /><TextInput style={styles.input} placeholder="Senha" placeholderTextColor="#95A5A6" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} /><TouchableOpacity onPress={() => setShowPassword(v => !v)}><Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#7F8C8D" /></TouchableOpacity></View>
      <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Entrar</Text>}
      </TouchableOpacity>
      <Link href="./signup" style={{ marginTop: 20 }}><Text style={{ fontSize: 14, color: '#7F8C8D' }}>Não tem conta? <Text style={{ color: '#1D9E75', fontWeight: 'bold' }}>Criar agora</Text></Text></Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1D9E75', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2C3E50', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#7F8C8D', marginBottom: 20 },
  emailText: { fontSize: 15, color: '#7F8C8D', marginBottom: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderWidth: 1, borderColor: '#E74C3C', borderRadius: 8, padding: 10, marginBottom: 16, width: '100%' },
  errorText: { color: '#E74C3C', fontSize: 14, marginLeft: 8, flex: 1 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, width: '100%', height: 52 },
  input: { flex: 1, fontSize: 16, color: '#2C3E50', height: '100%' },
  primaryBtn: { backgroundColor: '#1D9E75', borderRadius: 10, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  outlineBtn: { borderWidth: 1.5, borderColor: '#E74C3C', borderRadius: 10, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  outlineBtnText: { color: '#E74C3C', fontSize: 16, fontWeight: 'bold' },
});