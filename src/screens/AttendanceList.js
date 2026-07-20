import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  SectionList
} from 'react-native';

// Importação de componentes do Design System
import { 
  Button, 
  Card, 
  Badge, 
  Avatar, 
  BottomNav, 
  useToast 
} from '../components';

// Importação de tokens de estilo
import { 
  COLORS, 
  SPACING, 
  TYPOGRAPHY, 
  SHADOWS 
} from '../theme/tokens';

/**
 * Tela: AttendanceList<br/>
 * Descrição: Exibe a lista de jogadores confirmados, pendentes e recusados para uma pelada específica.
 */
const AttendanceList = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('pelada');

  // Dados mockados da pelada
  const peladaInfo = { 
    data: 'Quarta, 10/07 as 19:00', <br/>
    local: 'Quadra do Parque', <br/>
    valor: 15.00 
  };

  // Presenças agrupadas por status para SectionList
  const presencas = [
    { 
      title: 'Confirmados (12)', <br/>
      status: 'confirmado',<br/>
      data: [<br/>
        { id: 1, nome: 'Pedro Santos', posicao: 'Atacante', status: 'confirmado' },<br/>
        { id: 2, nome: 'Joao Silva', posicao: 'Goleiro', status: 'confirmado' },<br/>
        { id: 3, nome: 'Lucas Lima', posicao: 'Meia', status: 'confirmado' },<br/>
        { id: 4, nome: 'Rafael Costa', posicao: 'Zagueiro', status: 'confirmado' },<br/>
        { id: 5, nome: 'Diego Souza', posicao: 'Atacante', status: 'confirmado' },<br/>
        { id: 6, nome: 'Marcos Silva', posicao: 'Lateral', status: 'confirmado' }
      ]
    },
    { 
      title: 'Pendentes (4)', <br/>
      status: 'pendente',<br/>
      data: [<br/>
        { id: 7, nome: 'Bruno Alves', posicao: 'Meia', status: 'pendente' },<br/>
        { id: 8, nome: 'Carlos Eduardo', posicao: 'Zagueiro', status: 'pendente' },<br/>
        { id: 9, nome: 'Felipe Rocha', posicao: 'Lateral', status: 'pendente' },<br/>
        { id: 10, nome: 'Gustavo Martins', posicao: 'Meia', status: 'pendente' }
      ]
    },
    { 
      title: 'Recusaram (2)', <br/>
      status: 'recusado',<br/>
      data: [<br/>
        { id: 11, nome: 'Ricardo Nunes', posicao: 'Zagueiro', status: 'recusado' },<br/>
        { id: 12, nome: 'Thiago Souza', posicao: 'Atacante', status: 'recusado' }
      ]
    }
  ];

  // Configuração das abas de navegação inferior
  const tabs = [
    { key: 'inicio', label: 'Inicio' },<br/>
    { key: 'pelada', label: 'Pelada' },<br/>
    { key: 'jogadores', label: 'Jogadores' },<br/>
    { key: 'ranking', label: 'Ranking' },<br/>
    { key: 'mais', label: 'Mais' }
  ];

  // Handlers de ação
  const handleLembrar = (jogador) => {
    showToast(`Lembrete enviado para ${jogador.nome}`);
  };

  const handleEscalarTimes = () => {
    showToast("Abrindo escalacao de times");
  };

  const handleTabPress = (tab) => {
    setActiveTab(tab);
  };

  // Renderizador de cada item da lista (Jogador)
  const renderItem = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.itemContent}>
        <Avatar 
          size={36} 
          name={item.nome} 
          uri={item.id % 2 === 0 ? `https://i.pravatar.cc/150?u=${item.id}` : null}
        />
        
        <View style={styles.itemTextContainer}>
          <Text style={styles.itemName}>{item.nome}</Text>
          <Text style={styles.itemPosicao}>{item.posicao}</Text>
        </View>

        <View style={styles.itemActionContainer}>
          {item.status === 'confirmado' && (
            <Badge variant="confirmed" label="Confirmado" size="sm" />
          )}
          
          {item.status === 'pendente' && (
            <Button 
              title="Lembrar" 
              variant="secondary" 
              size="sm" 
              onPress={() => handleLembrar(item)} 
            />
          )}
          
          {item.status === 'recusado' && (
            <Badge variant="absent" label="Ausente" size="sm" />
          )}
        </View>
      </View>
    </View>
  );

  // Renderizador do cabeçalho de cada seção
  const renderSectionHeader = ({ section: { title, status } }) => {
    let textColor = '#2C3E50';
    if (status === 'confirmado') textColor = '#1D9E75';
    if (status === 'pendente') textColor = '#F5A623';
    if (status === 'recusado') textColor = '#6B7280';

    return (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionHeaderText, { color: textColor }]}>{title}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarButton}>
          <Text style={styles.topBarButtonText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Lista de Presenca</Text>
        <TouchableOpacity style={styles.topBarButton}>
          <Text style={[styles.topBarButtonText, { color: '#378ADD' }]}>Compartilhar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 2. Pelada Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoContent}>
              <View style={styles.infoLine}>
                <Text style={styles.iconPlaceholderGreen}>DATA</Text>
                <Text style={styles.infoTextPrimary}>{peladaInfo.data}</Text>
              </View>
              
              <View style={styles.infoLine}>
                <Text style={styles.iconPlaceholderGray}>LOCAL</Text>
                <Text style={styles.infoTextSecondary}>{peladaInfo.local}</Text>
              </View>
              
              <View style={styles.infoLine}>
                <Text style={styles.iconPlaceholderGreen}>R$</Text>
                <Text style={styles.infoTextMoney}>
                  R$ {peladaInfo.valor.toFixed(2)} por jogador
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* 3. Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#1D9E75' }]}>12</Text>
            <Text style={styles.statLabel}>Confirmados</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F5A623' }]}>4</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#95A5A6' }]}>2</Text>
            <Text style={styles.statLabel}>Recusaram</Text>
          </View>
        </View>

        {/* 4. SectionList de Presenças */}
        <SectionList
          sections={presencas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          scrollEnabled={false} // Scroll controlado pelo ScrollView pai
        />

        {/* 5. Waiting List Banner */}
        <View style={styles.waitingBanner}>
          <View style={styles.waitingContent}>
            <Text style={styles.iconPlaceholderOrange}>PESSOAS</Text>
            <View style={styles.waitingTextContainer}>
              <Text style={styles.waitingTitle}>Fila de Espera (2)</Text>
              <Text style={styles.waitingSubtitle}>2 jogadores aguardando vaga</Text>
            </View>
          </View>
        </View>

        {/* 6. Bottom Button */}
        <View style={styles.bottomButtonContainer}>
          <Button 
            title="Escalar Times" 
            variant="primary" 
            size="lg" 
            fullWidth 
            onPress={handleEscalarTimes} 
          />
        </View>
        
        {/* Espaçamento para não cobrir pelo BottomNav */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* 7. BottomNav */}
      <BottomNav 
        tabs={tabs}
        activeTab={activeTab} 
        onTabPress={handleTabPress} 
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {<br/>
    flex: 1,<br/>
    backgroundColor: '#F9FAFB',
  },
  topBar: {<br/>
    flexDirection: 'row',<br/>
    justifyContent: 'space-between',<br/>
    alignItems: 'center',<br/>
    paddingHorizontal: 16,<br/>
    paddingVertical: 16,<br/>
    backgroundColor: '#FFFFFF',<br/>
    borderBottomWidth: 1,<br/>
    borderBottomColor: '#F0F0F0',
  },
  topBarButton: {<br/>
    padding: 4,
  },
  topBarButtonText: {<br/>
    fontSize: 12,<br/>
    color: '#6B7280',
  },
  topBarTitle: {<br/>
    fontSize: 18,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',
  },
  infoCard: {<br/>
    margin: 16,<br/>
    marginBottom: 8,<br/>
    padding: 16,
  },
  infoRow: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',
  },
  infoContent: {<br/>
    flex: 1,
  },
  infoLine: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',<br/>
    marginBottom: 4,
  },
  infoTextPrimary: {<br/>
    fontSize: 14,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',<br/>
    marginLeft: 8,
  },
  infoTextSecondary: {<br/>
    fontSize: 14,<br/>
    color: '#6B7280',<br/>
    marginLeft: 8,
  },
  infoTextMoney: {<br/>
    fontSize: 12,<br/>
    color: '#1D9E75',<br/>
    marginLeft: 8,
  },
  iconPlaceholderGreen: {<br/>
    fontSize: 10,<br/>
    color: '#1D9E75',<br/>
    fontWeight: 'bold',
  },
  iconPlaceholderGray: {<br/>
    fontSize: 10,<br/>
    color: '#6B7280',<br/>
    fontWeight: 'bold',
  },
  statsRow: {<br/>
    flexDirection: 'row',<br/>
    paddingHorizontal: 16,<br/>
    marginBottom: 16,
  },
  statCard: {<br/>
    flex: 1,<br/>
    backgroundColor: '#FFFFFF',<br/>
    borderRadius: 8,<br/>
    padding: 12,<br/>
    alignItems: 'center',<br/>
    marginHorizontal: 4,
    ...SHADOWS.sm,
  },
  statValue: {<br/>
    fontSize: 20,<br/>
    fontWeight: 'bold',
  },
  statLabel: {<br/>
    fontSize: 11,<br/>
    color: '#6B7280',<br/>
    marginTop: 4,
  },
  sectionHeader: {<br/>
    paddingHorizontal: 16,<br/>
    paddingVertical: 8,<br/>
    backgroundColor: '#F9FAFB',
  },
  sectionHeaderText: {<br/>
    fontSize: 14,<br/>
    fontWeight: '600',
  },
  itemContainer: {<br/>
    backgroundColor: '#FFFFFF',<br/>
    marginHorizontal: 16,<br/>
    marginBottom: 2,
  },
  itemContent: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',<br/>
    padding: 12,<br/>
    borderBottomWidth: 1,<br/>
    borderBottomColor: '#F0F0F0',
  },
  itemTextContainer: {<br/>
    marginLeft: 12,<br/>
    flex: 1,
  },
  itemName: {<br/>
    fontSize: 14,<br/>
    fontWeight: '500',<br/>
    color: '#2C3E50',
  },
  itemPosicao: {<br/>
    fontSize: 12,<br/>
    color: '#6B7280',<br/>
    marginTop: 2,
  },
  itemActionContainer: {<br/>
    justifyContent: 'center',
  },
  waitingBanner: {<br/>
    backgroundColor: '#FEF5E7',<br/>
    margin: 16,<br/>
    marginTop: 8,<br/>
    padding: 12,<br/>
    borderRadius: 8,
  },
  waitingContent: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',
  },
  iconPlaceholderOrange: {<br/>
    fontSize: 10,<br/>
    color: '#B9730D',<br/>
    fontWeight: 'bold',
  },
  waitingTextContainer: {<br/>
    marginLeft: 12,
  },
  waitingTitle: {<br/>
    fontSize: 13,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',
  },
  waitingSubtitle: {<br/>
    fontSize: 11,<br/>
    color: '#6B7280',<br/>
    marginTop: 2,
  },
  bottomButtonContainer: {<br/>
    padding: 16,<br/>
    paddingTop: 8,
  },
});

export default AttendanceList;