import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from 'react-native';

// Importação de componentes do Design System local
import { Button, Card, Input, Toggle, useToast } from '../components';
import tokens from '../theme/tokens';

const CreatePelada = () => {
  const { showToast } = useToast();

  // Estados do formulário
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [local, setLocal] = useState('');
  const [valor, setValor] = useState('');
  const [jogadoresPorTime, setJogadoresPorTime] = useState(5);
  const [duracao, setDuracao] = useState(60);
  const [recorrente, setRecorrente] = useState(false);
  const [diaRecorrente, setDiaRecorrente] = useState('quarta');

  // Dados mockados de jogadores e código
  const [jogadores, setJogadores] = useState([
    { id: 1, nome: 'Pedro Santos' },<br/>
    { id: 2, nome: 'Joao Silva' },<br/>
    { id: 3, nome: 'Lucas Lima' }
  ]);
  const codigoPelada = 'PEL4521';

  // Gerenciamento de incrementos/decrementos (Steppers)
  const handleStepper = (field, direction) => {
    if (field === 'jogadores') {
      const newValue = direction === 'up' ? jogadoresPorTime + 1 : jogadoresPorTime - 1;
      if (newValue >= 3) setJogadoresPorTime(newValue);
    } else if (field === 'duracao') {
      const newValue = direction === 'up' ? duracao + 10 : duracao - 10;
      if (newValue >= 30) setDuracao(newValue);
    }
  };

  // Ação de criação da pelada
  const handleCreate = () => {
    if (!data || !horario || !local) {
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }
    showToast('Pelada criada com sucesso', 'success');
  };

  // Compartilhamento de link/código
  const handleShareLink = () => {
    showToast('Link copiado', 'success');
  };

  // Remoção de jogador da lista mockada
  const handleRemovePlayer = (id) => {
    setJogadores(jogadores.filter(p => p.id !== id));
    showToast('Jogador removido', 'info');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backButtonText}>VOLTAR</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Nova Pelada</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          
          {/* Form Card */}
          <Card style={styles.formCard}>
            <Input 
              label="Data" 
              placeholder="DD/MM/AAAA" 
              value={data} 
              onChangeText={setData} 
            />
            <Input 
              label="Horario" 
              placeholder="19:00" 
              value={horario} 
              onChangeText={setHorario} 
            />
            <Input 
              label="Local / Quadra" 
              placeholder="Nome do local" 
              value={local} 
              onChangeText={setLocal} 
            />
            <Input 
              label="Valor da Pelada" 
              placeholder="R$ 0,00" 
              value={valor} 
              onChangeText={setValor} 
              keyboardType="numeric" 
            />

            {/* Stepper Jogadores */}
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Jogadores por time</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity 
                  style={styles.stepperButtonGray} 
                  onPress={() => handleStepper('jogadores', 'down')}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{jogadoresPorTime}</Text>
                <TouchableOpacity 
                  style={styles.stepperButtonGreen} 
                  onPress={() => handleStepper('jogadores', 'up')}
                >
                  <Text style={[styles.stepperButtonText, styles.whiteText]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Stepper Duração */}
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Duracao (min)</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity 
                  style={styles.stepperButtonGray} 
                  onPress={() => handleStepper('duracao', 'down')}
                >
                  <Text style={styles.stepperButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{duracao}</Text>
                <TouchableOpacity 
                  style={styles.stepperButtonGreen} 
                  onPress={() => handleStepper('duracao', 'up')}
                >
                  <Text style={[styles.stepperButtonText, styles.whiteText]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Toggle Recorrência */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Recorrente (semanal)</Text>
              <Toggle value={recorrente} onValueChange={setRecorrente} />
            </View>

            {recorrente && (
              <Input 
                label="Repetir toda" 
                placeholder="Ex: Quarta" 
                value={diaRecorrente} 
                onChangeText={setDiaRecorrente} 
              />
            )}
          </Card>

          {/* Invite Card */}
          <Card style={styles.inviteCard}>
            <Text style={styles.sectionTitle}>Convidar Jogadores</Text>
            <View style={styles.inviteRow}>
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Codigo:</Text>
                <Text style={styles.codeValue}>{codigoPelada}</Text>
              </View>
              <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
                <Text style={styles.shareButtonText}>COMPARTILHAR LINK</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Players List */}
          <Card style={styles.playersCard}>
            <Text style={styles.sectionTitleSmall}>
              Jogadores Adicionados ({jogadores.length})
            </Text>
            {jogadores.map((jogador) => (
              <View key={jogador.id} style={styles.playerRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {jogador.nome.charAt(0)}
                  </Text>
                </View>
                <Text style={styles.playerName}>{jogador.nome}</Text>
                <TouchableOpacity onPress={() => handleRemovePlayer(jogador.id)}>
                  <Text style={styles.removeText}>REMOVER</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>

          {/* Bottom Action */}
          <Button 
            title="Criar Pelada" 
            onPress={handleCreate} 
            fullWidth 
            size="lg" 
            style={styles.mainButton}
          />
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {<br/>
    flex: 1,<br/>
    backgroundColor: '#F9FAFB',
  },
  flex: {<br/>
    flex: 1,
  },
  scrollContent: {<br/>
    padding: 16,
  },
  topBar: {<br/>
    flexDirection: 'row',<br/>
    justifyContent: 'space-between',<br/>
    alignItems: 'center',<br/>
    padding: 16,<br/>
    backgroundColor: '#FFFFFF',<br/>
    borderBottomWidth: 1,<br/>
    borderBottomColor: '#F0F0F0',
  },
  topBarTitle: {<br/>
    fontSize: 18,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',
  },
  backButton: {<br/>
    width: 60,
  },
  backButtonText: {<br/>
    fontSize: 12,<br/>
    color: '#6B7280',<br/>
    fontWeight: '500',
  },
  placeholder: {<br/>
    width: 60,
  },
  formCard: {<br/>
    padding: 16,<br/>
    marginBottom: 16,
  },
  stepperRow: {<br/>
    flexDirection: 'row',<br/>
    justifyContent: 'space-between',<br/>
    alignItems: 'center',<br/>
    marginTop: 16,
  },
  stepperLabel: {<br/>
    fontSize: 14,<br/>
    color: '#2C3E50',
  },
  stepperControls: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',
  },
  stepperButtonGray: {<br/>
    width: 40,<br/>
    height: 40,<br/>
    borderRadius: 20,<br/>
    backgroundColor: '#F3F4F6',<br/>
    alignItems: 'center',<br/>
    justifyContent: 'center',
  },
  stepperButtonGreen: {<br/>
    width: 40,<br/>
    height: 40,<br/>
    borderRadius: 20,<br/>
    backgroundColor: '#1D9E75',<br/>
    alignItems: 'center',<br/>
    justifyContent: 'center',
  },
  stepperButtonText: {<br/>
    fontSize: 20,<br/>
    fontWeight: '500',<br/>
    color: '#2C3E50',
  },
  whiteText: {<br/>
    color: '#FFFFFF',
  },
  stepperValue: {<br/>
    fontSize: 20,<br/>
    fontWeight: '700',<br/>
    color: '#2C3E50',<br/>
    width: 40,<br/>
    textAlign: 'center',
  },
  toggleRow: {<br/>
    flexDirection: 'row',<br/>
    justifyContent: 'space-between',<br/>
    alignItems: 'center',<br/>
    marginTop: 20,<br/>
    marginBottom: 8,
  },
  toggleLabel: {<br/>
    fontSize: 14,<br/>
    color: '#2C3E50',<br/>
    flex: 1,
  },
  inviteCard: {<br/>
    padding: 16,<br/>
    marginBottom: 16,
  },
  sectionTitle: {<br/>
    fontSize: 16,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',<br/>
    marginBottom: 12,
  },
  inviteRow: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',
  },
  codeBox: {<br/>
    flex: 1,<br/>
    backgroundColor: '#F5F5F5',<br/>
    borderRadius: 8,<br/>
    padding: 12,<br/>
    marginRight: 12,
  },
  codeLabel: {<br/>
    fontSize: 12,<br/>
    color: '#6B7280',
  },
  codeValue: {<br/>
    fontSize: 16,<br/>
    fontWeight: '700',<br/>
    color: '#1D9E75',
  },
  shareButton: {<br/>
    backgroundColor: '#1D9E75',<br/>
    borderRadius: 8,<br/>
    padding: 12,<br/>
    justifyContent: 'center',
  },
  shareButtonText: {<br/>
    fontSize: 12,<br/>
    color: '#FFFFFF',<br/>
    fontWeight: '700',
  },
  playersCard: {<br/>
    padding: 16,<br/>
    marginBottom: 16,
  },
  sectionTitleSmall: {<br/>
    fontSize: 14,<br/>
    fontWeight: '600',<br/>
    color: '#2C3E50',<br/>
    marginBottom: 12,
  },
  playerRow: {<br/>
    flexDirection: 'row',<br/>
    alignItems: 'center',<br/>
    paddingVertical: 12,<br/>
    borderBottomWidth: 1,<br/>
    borderBottomColor: '#F0F0F0',
  },
  avatarCircle: {<br/>
    width: 32,<br/>
    height: 32,<br/>
    borderRadius: 16,<br/>
    backgroundColor: '#1D9E75',<br/>
    alignItems: 'center',<br/>
    justifyContent: 'center',
  },
  avatarText: {<br/>
    color: '#FFFFFF',<br/>
    fontSize: 14,<br/>
    fontWeight: '700',
  },
  playerName: {<br/>
    flex: 1,<br/>
    marginLeft: 12,<br/>
    fontSize: 14,<br/>
    color: '#2C3E50',
  },
  removeText: {<br/>
    fontSize: 12,<br/>
    color: '#E74C3C',<br/>
    fontWeight: '700',
  },
  mainButton: {<br/>
    marginBottom: 24,
  }
});

export default CreatePelada;