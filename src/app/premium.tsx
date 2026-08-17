/**
 * Tela: Card Premium do Atleta
 * Rota: /premium (src/app/premium.tsx)
 * Modo teste: sem cobrança real — aquisição simulada com Alert + AsyncStorage
 */

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import tokens from '../theme/tokens';

// ─── CONSTANTES ────────────────────────────────────────────────────────────────
const GOLD = '#D4AF37';
const GOLD_LIGHT = '#F5D270';
const CARD_BG_START = '#1D9E75';
const CARD_BG_END = '#0A1F16';
const ASYNC_KEY = 'peladapro_premium_adquirido';
const MODO_TESTE = true; // Desativar para ativar pagamento real no futuro

// ─── LISTA DE BENEFÍCIOS ───────────────────────────────────────────────────────
const BENEFICIOS = [
  { icon: 'trophy', label: 'Craque da Partida (MVP) destacado' },
  { icon: 'medal', label: 'Medalha de ouro no ranking' },
  { icon: 'star', label: 'Destaque no perfil do grupo' },
  { icon: 'bar-chart', label: 'Estatísticas avançadas exclusivas' },
];

// ─── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function CardPremiumScreen() {
  const [adquirido, setAdquirido] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('Atleta');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Animações: rotação 3D do card hero e pulso do botão
  const cardRotateAnim = useRef(new Animated.Value(0)).current;
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  // ── Carregar dados do usuário e status do Supabase (Fonte da Verdade) ─────────
  const carregarDadosDoBanco = useCallback(async () => {
    try {
      // 1. Tenta carregar cache local (resposta rápida)
      const cached = await AsyncStorage.getItem(ASYNC_KEY);
      if (cached === 'true') setAdquirido(true);

      // 2. Consulta a fonte da verdade: Supabase Database
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('usuarios')
          .select('nome, apelido, foto, premium_status, vip, premium, card_ultimate, plano')
          .eq('email', session.user.email)
          .single();

        if (data) {
          setUserName(data.apelido || data.nome || 'Atleta');
          setUserAvatar(data.foto ?? null);

          // Verifica se possui o status premium ativado no banco de dados
          const statusNoBanco = !!(
            data.premium_status ||
            data.vip ||
            data.premium ||
            data.card_ultimate ||
            data.plano === 'vip' ||
            data.plano === 'ultimate'
          );

          if (statusNoBanco) {
            setAdquirido(true);
            await AsyncStorage.setItem(ASYNC_KEY, 'true').catch(() => {});
          } else {
            setAdquirido(false);
            await AsyncStorage.removeItem(ASYNC_KEY).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.warn('[Premium] Erro ao carregar do Supabase:', e);
    }
  }, []);

  // Inicialização na montagem da tela
  useEffect(() => {
    carregarDadosDoBanco();

    // Animação suave de inclinação do card ao entrar na tela
    Animated.spring(cardRotateAnim, {
      toValue: 1,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [carregarDadosDoBanco]);

  // Re-hidratação ao focar na tela / voltar do background (crítico para iPhone)
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const rehidratar = async () => {
        if (isMounted) {
          await carregarDadosDoBanco();
        }
      };

      rehidratar();

      // Listener para quando o app no iPhone volta do background para o primeiro plano
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active' && isMounted) {
          rehidratar();
        }
      });

      return () => {
        isMounted = false;
        subscription.remove();
      };
    }, [carregarDadosDoBanco])
  );

  // Interpola de -8° (início) para -4° (final) — efeito levemente inclinado
  const cardRotate = cardRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-8deg', '-4deg'],
  });

  // ── Ação: adquirir card (persistência real no Supabase) ────────────────────
  const handleAdquirir = async () => {
    if (adquirido || loading) return;

    // Pulso no botão para feedback tátil visual
    Animated.sequence([
      Animated.timing(btnScaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(btnScaleAnim, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
    ]).start();

    setLoading(true);

    try {
      if (MODO_TESTE) {
        // 1. Atualiza o estado da memória imediatamente (UX instantânea)
        setAdquirido(true);

        // 2. Atualiza o cache local
        await AsyncStorage.setItem(ASYNC_KEY, 'true').catch(() => {});

        // 3. PERSISTÊNCIA REAL NO SUPABASE (Sobrevive a qualquer limpeza do iPhone)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { error } = await supabase
            .from('usuarios')
            .update({
              premium_status: true,
              premium_ativado_em: new Date().toISOString(),
              vip: true,
              premium: true,
              card_ultimate: true,
              card_style: 'fut',
              plano: 'vip',
            })
            .eq('email', session.user.email);

          if (error) {
            console.warn('[Premium] Aviso ao salvar no Supabase:', error.message);
          }
        }

        Alert.alert(
          '🏆 Card Premium Ativado!',
          `Parabéns, ${userName}! Seu Card Premium foi ativado com sucesso.\n\n✓ Modo Teste — sem cobrança nesta versão.`,
          [{ text: 'Incrível!', style: 'default' }]
        );
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível completar a aquisição. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={tokens.colors.neutralBg} />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.topBarBtn}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={tokens.colors.neutralDark} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Card Premium</Text>

        <View style={styles.topBarBtn}>
          <Ionicons name="trophy" size={22} color={GOLD} accessibilityLabel="Troféu premium" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Card Hero Premium (Fut PlayerCard Dinâmico para Lucas Fernandes Guerreiro) ── */}
        <View style={styles.cardHeroWrapper}>
          {isLucasGuerreiro ? (
            <PlayerCard
              nome={userName}
              posicao={userStats.posicao}
              idade={userStats.idade}
              jogos={userStats.jogos}
              gols={userStats.gols}
              rating={userStats.rating}
              primaryColor={userStats.primaryColor}
              secondaryColor={userStats.secondaryColor}
              timeNome={userStats.timeNome}
              nacionalidade={userStats.nacionalidade}
              adquirido={adquirido}
              foto={userAvatar ?? undefined}
            />
          ) : (
            <Animated.View style={[styles.cardHeroShadow, { transform: [{ rotate: cardRotate }] }]}>
              <LinearGradient
                colors={[CARD_BG_START, '#0D4030', CARD_BG_END]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardHero}
              >
                {/* Watermark decorativo */}
                <Text style={styles.watermark}>⚽</Text>

                {/* Tag PREMIUM (canto superior direito) */}
                <View style={styles.premiumTag}>
                  <Text style={styles.premiumTagText}>✦ PREMIUM</Text>
                </View>

                {/* Avatar + badge VIP */}
                <View style={styles.avatarSection}>
                  <View style={styles.avatarRing}>
                    {userAvatar ? (
                      <Image source={{ uri: userAvatar }} style={styles.avatarImg} />
                    ) : (
                      <LinearGradient colors={[CARD_BG_START, '#0A2E1A']} style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarInitial}>{userName.charAt(0).toUpperCase()}</Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.vipBadge}>
                    <Text style={styles.vipBadgeText}>VIP</Text>
                  </View>
                </View>

                {/* Nome e posição */}
                <Text style={styles.cardName} numberOfLines={1}>{userName}</Text>
                <View style={styles.posicaoPill}>
                  <Text style={styles.posicaoText}>Atacante</Text>
                </View>

                {/* 5 estrelas de habilidade douradas */}
                <View style={styles.starsRow} accessibilityLabel="5 estrelas de habilidade">
                  {[1, 2, 3, 4, 5].map(i => <Ionicons key={i} name="star" size={16} color={GOLD_LIGHT} />)}
                </View>

                {/* Estatísticas: Jogos | Gols */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>28</Text>
                    <Text style={styles.statLabel}>Jogos</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>12</Text>
                    <Text style={styles.statLabel}>Gols</Text>
                  </View>
                </View>

                {/* Rodapé do card */}
                <Text style={styles.cardFooter}>
                  {adquirido ? '🏅 Card Ativo • Membro Elite' : 'Membro Elite desde 2026'}
                </Text>

                {/* Selo ATIVO (visível após aquisição) */}
                {adquirido && (
                  <View style={styles.activeSeal}>
                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                    <Text style={styles.activeSealText}>ATIVO</Text>
                  </View>
                )}
              </LinearGradient>
            </Animated.View>
          </View>

        {/* ── Benefícios Exclusivos ── */}
        <View style={styles.benefitsCard}>
          <View style={styles.benefitsHeader}>
            <Ionicons name="ribbon" size={20} color={GOLD} />
            <Text style={styles.benefitsTitle}>Benefícios Exclusivos</Text>
          </View>
          {BENEFICIOS.map((b, i) => (
            <View key={i} style={[styles.benefitRow, i === BENEFICIOS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.benefitIcon}>
                <Ionicons name={b.icon as any} size={18} color={GOLD} />
              </View>
              <Text style={styles.benefitLabel}>{b.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Preço e Botão ── */}
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Valor do Card Premium</Text>
          <Text style={styles.priceValue}>R$ 19,90</Text>
          <Text style={styles.priceInstall}>ou 5× R$ 3,98</Text>

          {/* Botão animado */}
          <Animated.View style={{ transform: [{ scale: btnScaleAnim }], width: '100%' }}>
            <TouchableOpacity
              style={[styles.buyBtn, adquirido && styles.buyBtnDone]}
              onPress={handleAdquirir}
              disabled={adquirido || loading}
              accessibilityLabel={adquirido ? 'Card Premium já adquirido' : 'Adquirir Card Premium'}
              accessibilityRole="button"
              activeOpacity={0.85}
            >
              <Ionicons name={adquirido ? 'checkmark-circle' : 'ribbon'} size={20} color={GOLD} />
              <Text style={styles.buyBtnText}>
                {loading ? 'Processando...' : adquirido ? 'Adquirido ✓' : 'Adquirir Card Premium'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.buySubtext}>Pagamento único • Acesso vitalício ao card</Text>
        </View>

        {/* ── Banner Modo Teste ── */}
        {MODO_TESTE && (
          <View style={styles.testBanner}>
            <Ionicons name="checkmark-circle" size={14} color={tokens.colors.primary} />
            <Text style={styles.testBannerText}>Teste — Sem cobrança nesta versão</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: tokens.colors.neutralBg },

  // Top Bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md, paddingVertical: 12,
    backgroundColor: tokens.colors.neutralBg,
    borderBottomWidth: 1, borderBottomColor: tokens.colors.neutralBorder,
  },
  topBarBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: {
    fontSize: tokens.typography.sizes.h2,
    fontWeight: tokens.typography.weights.semibold as any,
    color: tokens.colors.neutralDark,
  },

  scrollContent: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.lg, alignItems: 'center' },

  // Card Hero
  cardHeroWrapper: { width: '100%', alignItems: 'center', marginBottom: tokens.spacing.xl, paddingVertical: 16 },
  cardHeroShadow: {
    width: 300, borderRadius: tokens.radius.lg,
    shadowColor: CARD_BG_START, shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 16,
  },
  cardHero: {
    width: 300, minHeight: 390, borderRadius: tokens.radius.lg,
    borderWidth: 1.5, borderColor: GOLD,
    padding: 20, alignItems: 'center', overflow: 'hidden', position: 'relative',
  },
  watermark: { position: 'absolute', fontSize: 200, opacity: 0.05, bottom: -40, right: -20, transform: [{ rotate: '-15deg' }] },

  premiumTag: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: GOLD,
    borderRadius: tokens.radius.sm, paddingHorizontal: 8, paddingVertical: 3,
  },
  premiumTagText: { color: GOLD_LIGHT, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },

  // Avatar
  avatarSection: { marginTop: 8, alignItems: 'center' },
  avatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: GOLD, overflow: 'hidden', marginBottom: 4 },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: GOLD_LIGHT },
  vipBadge: {
    backgroundColor: GOLD, borderRadius: tokens.radius.full,
    paddingHorizontal: 10, paddingVertical: 2, marginTop: -10, zIndex: 10,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4,
  },
  vipBadgeText: { color: '#1A1A1A', fontSize: 10, fontWeight: '800', letterSpacing: 2 },

  // Info card
  cardName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 10, letterSpacing: 0.5 },
  posicaoPill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: tokens.radius.full, paddingHorizontal: 12, paddingVertical: 3, marginTop: 6 },
  posicaoText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 4, marginTop: 12 },

  // Stats
  statsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: tokens.radius.md,
    paddingVertical: 10, paddingHorizontal: 20, width: '100%',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  statValue: { color: GOLD_LIGHT, fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  cardFooter: { color: 'rgba(255,255,255,0.45)', fontSize: 10, marginTop: 14, letterSpacing: 0.5 },
  activeSeal: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(29,158,117,0.6)', borderRadius: tokens.radius.full,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 8,
  },
  activeSealText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // Benefícios
  benefitsCard: {
    width: '100%', backgroundColor: tokens.colors.neutralSurface,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md, ...tokens.shadows.elevated,
  },
  benefitsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  benefitsTitle: { fontSize: tokens.typography.sizes.h3, fontWeight: tokens.typography.weights.bold as any, color: tokens.colors.neutralDark },
  benefitRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.colors.neutralBorder, gap: 12,
  },
  benefitIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FBF5DD', alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { flex: 1, fontSize: tokens.typography.sizes.body, color: tokens.colors.neutralDark },

  // Preço
  priceCard: {
    width: '100%', backgroundColor: tokens.colors.neutralSurface,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md,
    alignItems: 'center', marginBottom: tokens.spacing.md, ...tokens.shadows.card,
  },
  priceLabel: { fontSize: tokens.typography.sizes.caption, color: tokens.colors.neutralMuted, fontWeight: tokens.typography.weights.semibold as any, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  priceValue: { fontSize: 36, fontWeight: '800', color: tokens.colors.neutralDark, letterSpacing: -0.5 },
  priceInstall: { fontSize: tokens.typography.sizes.caption, color: tokens.colors.neutralMuted, marginBottom: tokens.spacing.md, marginTop: 2 },
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: tokens.colors.primary, borderRadius: tokens.radius.md,
    height: tokens.layout.buttonHeight, width: '100%',
  },
  buyBtnDone: { backgroundColor: '#14724F' }, // Verde escuro = adquirido
  buyBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buySubtext: { fontSize: tokens.typography.sizes.caption, color: tokens.colors.neutralMuted, marginTop: 10, textAlign: 'center' },

  // Banner Teste
  testBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: tokens.colors.successBg, borderRadius: tokens.radius.full,
    paddingHorizontal: 14, paddingVertical: 7, marginTop: 4,
  },
  testBannerText: { color: tokens.colors.successText, fontSize: tokens.typography.sizes.caption, fontWeight: tokens.typography.weights.semibold as any },
});
