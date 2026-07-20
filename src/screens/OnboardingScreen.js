import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import Card from '../components/Card';
import Toggle from '../components/Toggle';

const OnboardingScreen = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [groupName, setGroupName] = useState('Pelada da Turma');
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const [modality, setModality] = useState('Futebol Society');
  const [rules, setRules] = useState('');

  const setStep = (step) => {
    setCurrentStep(step);
  };

  const renderDots = () => {
    return (
      <View style={styles.dotsContainer}>
        <View style={styles.dotsRow}>
          {[1, 2, 3].map((step) => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;
            return (
              <View
                key={step}
                style={[
                  styles.dot,
                  isCompleted && styles.dotCompleted,
                  isCurrent && styles.dotCurrent,
                  !isCompleted && !isCurrent && styles.dotFuture,
                ]}
              />
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={onComplete}
        >
          <Text style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStep1 = () => {
    return (
      <View style={styles.step1Container}>
        {renderDots()}
        <View style={styles.step1Content}>
          <View style={styles.illustrationCircleLarge}>
            <Text style={styles.illustrationEmojiLarge}>⚽</Text>
          </View>

          <Text style={styles.step1Title}>Organize suas peladas</Text>
          <Text style={styles.step1Subtitle}>em um só lugar</Text>

          <Text style={styles.step1Description}>
            Cadastre jogadores, escale times, controle finanças e acompanhe o ranking. Tudo que você precisa para suas peladas.
          </Text>

          <View style={styles.step1Bottom}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setStep(2)}
            >
              <Text style={styles.primaryButtonText}>Começar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderStep2 = () => {
    return (
      <View style={styles.stepContainer}>
        {renderDots()}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationCircleMedium}>
              <Text style={styles.illustrationEmojiMedium}>🎯</Text>
            </View>
          </View>

          <Text style={styles.stepTitle}>Crie seu Grupo</Text>
          <Text style={styles.stepSubtitle}>
            Dê um nome e configure as regras básicas
          </Text>

          <Card style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Nome do Grupo</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Pelada da Turma"
                  placeholderTextColor="#9CA3AF"
                />
                {groupName.length > 0 && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
            </View>

            <View style={[styles.field, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Foto do Grupo</Text>
              <View style={styles.photoRow}>
                <View style={styles.photoCircle}>
                  <Text style={styles.photoIcon}>📷</Text>
                </View>
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Tirar foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Galeria</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={[styles.field, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Jogadores por Time</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperButtonGray}
                  onPress={() =>
                    setPlayersPerTeam(Math.max(1, playersPerTeam - 1))
                  }
                >
                  <Text style={styles.stepperButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{playersPerTeam}</Text>
                <TouchableOpacity
                  style={styles.stepperButtonGreen}
                  onPress={() => setPlayersPerTeam(playersPerTeam + 1)}
                >
                  <Text style={styles.stepperButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Modalidade</Text>
              <View style={styles.chipsRow}>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    modality === 'Futebol Society' && styles.chipSelected,
                  ]}
                  onPress={() => setModality('Futebol Society')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      modality === 'Futebol Society' &&
                        styles.chipTextSelected,
                    ]}
                  >
                    Futebol Society
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chip,
                    modality === 'Futebol Campo' && styles.chipSelected,
                  ]}
                  onPress={() => setModality('Futebol Campo')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      modality === 'Futebol Campo' &&
                        styles.chipTextSelected,
                    ]}
                  >
                    Futebol Campo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, { marginTop: 16 }]}>
              <Text style={styles.fieldLabel}>Regras do Grupo</Text>
              <TextInput
                style={styles.multilineInput}
                value={rules}
                onChangeText={setRules}
                placeholder="Ex: Quem perde paga a próxima, goleiro fixo, etc."
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />
            </View>
          </Card>

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 32 }]}
            onPress={() => setStep(3)}
          >
            <Text style={styles.primaryButtonText}>Avançar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderStep3 = () => {
    const shareButtons = [
      { id: 'whatsapp', icon: '💬', bg: '#25D366' },
      { id: 'telegram', icon: '✈️', bg: '#0088CC' },
      { id: 'messenger', icon: '💌', bg: '#006AFF' },
    ];

    return (
      <View style={styles.stepContainer}>
        {renderDots()}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.illustrationWrapper}>
            <View style={styles.illustrationCircleMedium}>
              <Text style={styles.illustrationEmojiMedium}>📨</Text>
            </View>
          </View>

          <Text style={styles.stepTitle}>Convide seus amigos</Text>
          <Text style={styles.stepSubtitle}>
            Compartilhe o link ou código de convite
          </Text>

          <Card style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Link de Convite</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={1}>
                  https://peladapro.app/convite/PEL4521
                </Text>
                <TouchableOpacity style={styles.copyButton}>
                  <Text style={styles.copyButtonText}>Copiar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.field, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>Código de Convite</Text>
              <Text style={styles.inviteCode}>PEL4521</Text>
            </View>

            <View style={[styles.field, { marginTop: 20 }]}>
              <Text style={styles.fieldLabel}>Compartilhar via</Text>
              <View style={styles.shareRow}>
                {shareButtons.map((btn) => (
                  <TouchableOpacity
                    key={btn.id}
                    style={[styles.shareButton, { backgroundColor: btn.bg }]}
                  >
                    <Text style={styles.shareIcon}>{btn.icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          <TouchableOpacity
            style={[styles.primaryButton, { marginTop: 32, marginBottom: 40 }]}
            onPress={onComplete}
          >
            <Text style={styles.primaryButtonText}>Ir para o App 🚀</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  step1Container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  dotsContainer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotCompleted: {
    backgroundColor: '#1D9E75',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCurrent: {
    backgroundColor: '#1D9E75',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotFuture: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    top: -6,
  },
  skipText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  step1Content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  illustrationCircleLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  illustrationEmojiLarge: {
    fontSize: 56,
  },
  step1Title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  step1Subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1D9E75',
    textAlign: 'center',
  },
  step1Description: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  step1Bottom: {
    marginTop: 60,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  scrollViewContent: {
    paddingBottom: 40,
  },
  illustrationWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  illustrationCircleMedium: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationEmojiMedium: {
    fontSize: 48,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    borderRadius: 8,
    padding: 20,
    marginTop: 24,
  },
  field: {},
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    padding: 0,
  },
  checkmark: {
    fontSize: 16,
    color: '#1D9E75',
    fontWeight: 'bold',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  photoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 24,
  },
  photoButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: '#1D9E75',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  outlineButtonText: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
  },
  ghostButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ghostButtonText: {
    fontSize: 13,
    color: '#6B7280',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  stepperButtonGray: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonGreen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperButtonText: {
    fontSize: 20,
    color: '#2C3E50',
    fontWeight: 'bold',
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginHorizontal: 24,
  },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#1D9E75',
    borderColor: '#1D9E75',
  },
  chipText: {
    fontSize: 13,
    color: '#6B7280',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    height: 80,
    fontSize: 14,
    color: '#2C3E50',
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: '#1D9E75',
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  linkText: {
    fontSize: 13,
    color: '#378ADD',
    flex: 1,
  },
  copyButton: {
    backgroundColor: '#378ADD',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 8,
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  inviteCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    letterSpacing: 4,
    textAlign: 'center',
    marginTop: 8,
  },
  shareRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shareIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
});

export default OnboardingScreen;