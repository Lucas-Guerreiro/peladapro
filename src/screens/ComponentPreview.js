import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView } from 'react-native';
import { 
  Button, Card, Input, Badge, Toggle, Toast, useToast,
  Modal, BottomNav, SegmentedControl, StatCard, Avatar, EmptyState 
} from '../components';

export default function ComponentPreview() {
  const [toggle, setToggle] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [segKey, setSegKey] = useState('auto');
  const [input, setInput] = useState('');
  const { show } = useToast();

  const segments = [
    { key: 'auto', label: 'Auto' },
    { key: 'aleatorio', label: 'Aleatório' },
    { key: 'manual', label: 'Manual' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Design System - Preview</Text>

        {/* Botões */}
        <Text style={styles.label}>Buttons</Text>
        <Button title="Primary" onPress={() => show('Primary')} />
        <Button title="Secondary" variant="secondary" onPress={() => show('Secondary')} />
        <Button title="Ghost" variant="ghost" onPress={() => show('Ghost')} />
        <Button title="Danger" variant="danger" onPress={() => show('Danger')} />
        <Button title="Carregando" loading />
        <Button title="Desabilitado" disabled />

        {/* Card */}
        <Text style={styles.label}>Card</Text>
        <Card><Text>Conteúdo do card com padding</Text></Card>
        <Card noPadding><Text style={{padding: 16}}>Card sem padding</Text></Card>

        {/* Badge */}
        <Text style={styles.label}>Badge</Text>
        <View style={{flexDirection: 'row', gap: 8, flexWrap: 'wrap'}}>
          <Badge variant="confirmed" label="Confirmado" />
          <Badge variant="pending" label="Pendente" />
          <Badge variant="absent" label="Ausente" />
          <Badge variant="goalkeeper" label="Goleiro" />
          <Badge variant="debtor" label="Devedor" />
        </View>

        {/* Input */}
        <Text style={styles.label}>Input</Text>
        <Input label="Nome" value={input} onChangeText={setInput} placeholder="Digite o nome" />
        <Input label="Com erro" value="" placeholder="Campo obrigatório" error="Este campo é obrigatório" />

        {/* Toggle */}
        <Text style={styles.label}>Toggle</Text>
        <Toggle value={toggle} onValueChange={setToggle} />

        {/* SegmentedControl */}
        <Text style={styles.label}>SegmentedControl</Text>
        <SegmentedControl segments={segments} selectedKey={segKey} onSelect={setSegKey} />

        {/* Avatar & StatCard */}
        <Text style={styles.label}>Avatar & StatCard</Text>
        <View style={{flexDirection: 'row', gap: 16, alignItems: 'center'}}>
          <Avatar name="João Silva" size={48} />
          <Avatar name="Pedro Santos" size={48} uri="https://i.pravatar.cc/150?u=1" />
        </View>
        <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
          <StatCard value="28" label="Jogos" />
          <StatCard value="12" label="Gols" color="#F5A623" />
          <StatCard value="85%" label="Presença" color="#378ADD" />
        </View>

        {/* Modal */}
        <Button title="Abrir Modal" onPress={() => setModalVisible(true)} />
        <Modal visible={modalVisible} title="Exemplo" onClose={() => setModalVisible(false)}>
          <Text>Este é um modal de exemplo.</Text>
          <Button title="Fechar" onPress={() => setModalVisible(false)} />
        </Modal>

        {/* EmptyState */}
        <Text style={styles.label}>EmptyState</Text>
        <EmptyState
          title="Nenhuma pelada encontrada"
          subtitle="Crie sua primeira pelada para começar"
          actionLabel="Criar Pelada"
          onAction={() => show('Criar pelada')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#2C3E50' },
  label: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 8, textTransform: 'uppercase' }
});