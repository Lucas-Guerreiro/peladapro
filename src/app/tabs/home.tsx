import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Conquista = {
  id: string | number;
  nome?: string | null;
  descricao?: string | null;
  icone?: string | null;
};

type Grupo = {
  id: string | number;
  nome?: string | null;
};

export default function HomeScreen() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAllConquistas, setShowAllConquistas] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [conquistasRes, gruposRes] = await Promise.all([
        supabase.from('conquistas').select('*'),
        supabase.from('grupos').select('*'),
      ]);

      if (!conquistasRes.error && conquistasRes.data) {
        setConquistas(conquistasRes.data as Conquista[]);
      }
      if (!gruposRes.error && gruposRes.data) {
        setGrupos(gruposRes.data as Grupo[]);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          router.replace('../');
          return;
        }

        if (mounted) {
          setUserEmail(data.session.user?.email ?? null);
        }

        await fetchData();
      } catch (err) {
        console.error('Erro na inicialização:', err);
        router.replace('../');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
    } finally {
      router.replace('../');
    }
  };

  const formatToday = () => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = months[now.getMonth()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${dayName}, ${day}/${month} às ${hours}:${minutes}`;
  };

  const visibleConquistas = showAllConquistas ? conquistas : conquistas.slice(0, 6);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1D9E75']} tintColor="#1D9E75" />
        }
      >
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <Text style={styles.appTitle}>Pelada Pro</Text>
          <Text style={styles.userEmail} numberOfLines={1} ellipsizeMode="tail">
            {userEmail ?? '...'}
          </Text>
        </View>

        {/* NEXT MATCH CARD */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Próxima Pelada</Text>
          <Text style={styles.heroDate}>{formatToday()}</Text>
          <View style={styles.heroLocationRow}>
            <Ionicons name="pin" size={14} color="#FFFFFF" />
            <Text style={styles.heroLocation}>Quadra do Parque</Text>
          </View>
          <View style={styles.pillsRow}>
            <View style={styles.pillConfirmed}>
              <Text style={styles.pillConfirmedText}>Confirmados: 0</Text>
            </View>
            <View style={styles.pillPending}>
              <Text style={styles.pillPendingText}>Pendentes: 0</Text>
            </View>
          </View>
        </View>

        {/* QUICK ACTIONS ROW */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.8}>
            <View style={[styles.quickActionButton, { backgroundColor: '#1D9E75' }]}>
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionLabel}>Nova Pelada</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.8}>
            <View style={[styles.quickActionButton, { backgroundColor: '#378ADD' }]}>
              <Ionicons name="shuffle" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionLabel}>Escalar Times</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem} activeOpacity={0.8}>
            <View style={[styles.quickActionButton, { backgroundColor: '#F5A623' }]}>
              <Ionicons name="cash" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.quickActionLabel}>Cobranças</Text>
          </TouchableOpacity>
        </View>

        {/* FINANCE CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financeiro</Text>
          <View style={styles.financeRow}>
            <View style={styles.financeColumn}>
              <Text style={styles.financeLabel}>Caixa</Text>
              <Text style={styles.financeValue}>R$ 0,00</Text>
            </View>
            <View style={styles.financeColumn}>
              <Text style={styles.financeLabel}>Pendências</Text>
              <Text style={styles.financePending}>0 pendentes</Text>
            </View>
          </View>
          <View style={styles.financeFooter}>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.financeLink}>Ver detalhes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONQUISTAS CARD */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trophy" size={18} color="#F5A623" />
            <Text style={styles.cardTitle}>Conquistas</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1D9E75" />
            </View>
          ) : conquistas.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma conquista encontrada</Text>
          ) : (
            <View style={styles.conquistasList}>
              {visibleConquistas.map((item, index) => (
                <View key={item.id ?? index} style={styles.conquistaItem}>
                  <Text style={styles.conquistaIcon}>
                    {item.icone ?? '🏆'}
                  </Text>
                  <View style={styles.conquistaTextContainer}>
                    <Text style={styles.conquistaName} numberOfLines={1}>
                      {item.nome ?? 'Conquista'}
                    </Text>
                    {item.descricao ? (
                      <Text style={styles.conquistaDescription} numberOfLines={2}>
                        {item.descricao}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}

              {conquistas.length > 6 && (
                <TouchableOpacity
                  style={styles.seeMoreButton}
                  onPress={() => setShowAllConquistas((prev) => !prev)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeMoreText}>
                    {showAllConquistas ? 'Ver menos' : 'Ver mais'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#E74C3C" />
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1D9E75',
  },
  userEmail: {
    fontSize: 12,
    color: '#7F8C8D',
    maxWidth: 180,
  },
  heroCard: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroDate: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 6,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  heroLocation: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginLeft: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  pillConfirmed: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillConfirmedText: {
    color: '#1D9E75',
    fontSize: 13,
    fontWeight: '600',
  },
  pillPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillPendingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 20,
    gap: 8,
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#2C3E50',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  financeRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  financeColumn: {
    flex: 1,
  },
  financeLabel: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  financeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D9E75',
    marginTop: 4,
  },
  financePending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7F8C8D',
    marginTop: 4,
  },
  financeFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  financeLink: {
    color: '#378ADD',
    fontSize: 13,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#7F8C8D',
    marginTop: 12,
  },
  conquistasList: {
    marginTop: 12,
  },
  conquistaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECF0F1',
    gap: 12,
  },
  conquistaIcon: {
    fontSize: 24,
  },
  conquistaTextContainer: {
    flex: 1,
  },
  conquistaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  conquistaDescription: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  seeMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  seeMoreText: {
    color: '#378ADD',
    fontSize: 13,
    fontWeight: '500',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: '#E74C3C',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});