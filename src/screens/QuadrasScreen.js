import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import Card from '../components/Card';

const defaultCourts = [
  {
    id: 1,
    name: 'Quadra Central',
    address: 'Rua das Flores, 123 - Centro',
    rating: 5,
    active: true,
    price: 80,
  },
  {
    id: 2,
    name: 'Arena Norte',
    address: 'Av. Brasil, 456 - Zona Norte',
    rating: 4,
    active: true,
    price: 100,
  },
  {
    id: 3,
    name: 'Ginásio Sul',
    address: 'Rua dos Esportes, 789 - Zona Sul',
    rating: 3,
    active: false,
    price: 60,
  },
  {
    id: 4,
    name: 'Quadra do Parque',
    address: 'Praça Verde, s/n - Parque',
    rating: 4,
    active: true,
    price: 50,
  },
  {
    id: 5,
    name: 'Complexo Esportivo',
    address: 'Rodovia BR-101, km 2 - Distrito',
    rating: 5,
    active: true,
    price: 120,
  },
];

const QuadrasScreen = ({ onNavigate, goBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCourt, setEditingCourt] = useState(null);
  const [courts, setCourts] = useState(defaultCourts);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formRating, setFormRating] = useState(0);
  const [formActive, setFormActive] = useState(true);

  const filteredCourts = courts.filter(
    (court) =>
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStars = (r) => {
    const full = '★'.repeat(Math.max(0, Math.min(5, r)));
    const empty = '☆'.repeat(5 - full.length);
    return full + empty;
  };

  const formatPrice = (p) => {
    const value = Number(p) || 0;
    const formatted = value.toFixed(2).replace('.', ',');
    return `R$ ${formatted}`;
  };

  const openInMaps = (court) => {
    const query = encodeURIComponent(court.address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erro', 'Não foi possível abrir o mapa.')
    );
  };

  const handleAdd = () => {
    setEditingCourt(null);
    setFormName('');
    setFormAddress('');
    setFormPrice('');
    setFormRating(0);
    setFormActive(true);
    setShowModal(true);
  };

  const handleEdit = (court) => {
    setEditingCourt(court);
    setFormName(court.name);
    setFormAddress(court.address);
    setFormPrice(String(court.price));
    setFormRating(court.rating);
    setFormActive(court.active);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formAddress.trim()) {
      Alert.alert('Atenção', 'Preencha nome e endereço.');
      return;
    }

    const priceNum = Number(formPrice) || 0;
    const ratingNum = Math.max(1, Math.min(5, Number(formRating) || 1));

    if (editingCourt) {
      setCourts((prev) =>
        prev.map((c) =>
          c.id === editingCourt.id
            ? {
                ...c,
                name: formName.trim(),
                address: formAddress.trim(),
                price: priceNum,
                rating: ratingNum,
                active: formActive,
              }
            : c
        )
      );
    } else {
      const newCourt = {
        id: Date.now(),
        name: formName.trim(),
        address: formAddress.trim(),
        price: priceNum,
        rating: ratingNum,
        active: formActive,
      };
      setCourts((prev) => [...prev, newCourt]);
    }

    closeModal();
  };

  const handleDelete = () => {
    if (!editingCourt) return;
    Alert.alert(
      'Excluir quadra',
      `Deseja excluir "${editingCourt.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            setCourts((prev) => prev.filter((c) => c.id !== editingCourt.id));
            closeModal();
          },
        },
      ]
    );
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCourt(null);
    setFormName('');
    setFormAddress('');
    setFormPrice('');
    setFormRating(0);
    setFormActive(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar quadras..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {filteredCourts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏟️</Text>
            <Text style={styles.emptyText}>Nenhuma quadra encontrada</Text>
          </View>
        ) : (
          filteredCourts.map((court) => (
            <Card key={court.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardPhotoIcon}>📷</Text>
                  <Text style={styles.cardInitial}>{court.name[0]}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardName}>{court.name}</Text>
                  <Text style={styles.cardAddress}>📍 {court.address}</Text>
                  <Text style={styles.cardStars}>{renderStars(court.rating)}</Text>
                  <Text style={styles.cardPrice}>{formatPrice(court.price)}</Text>
                  <TouchableOpacity style={styles.mapsLink} onPress={() => openInMaps(court)}>
                    <Text style={styles.mapsLinkText}>📍 Abrir no Maps</Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: court.active ? '#1D9E75' : '#E74C3C' },
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {court.active ? 'Ativa' : 'Inativa'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <TouchableOpacity
                  style={styles.cardActionButton}
                  onPress={() => handleEdit(court)}
                >
                  <Text style={styles.editText}>✏️ Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardActionButton, styles.borderLeft]}
                  onPress={() => handleEdit(court)}
                >
                  <Text style={styles.deleteText}>🗑️ Excluir</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleAdd}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        transparent
        animationType="slide"
        visible={showModal}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.dragIndicator} />
            <Text style={styles.modalTitle}>
              {editingCourt ? '✏️ Editar Quadra' : '🏟️ Nova Quadra'}
            </Text>

            <View style={styles.photoCircle}>
              <Text style={styles.photoIcon}>📷</Text>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>Nome da Quadra</Text>
              <TextInput
n                style={styles.input}
                value={formName}
                onChangeText={setFormName}
                placeholder="Nome da quadra"
              />

              <Text style={styles.label}>Endereço</Text>
              <TextInput
                style={styles.input}
                value={formAddress}
                onChangeText={setFormAddress}
                placeholder="Endereço"
              />

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Valor (R$)</Text>
                  <TextInput
                    style={styles.input}
                    value={formPrice}
                    onChangeText={setFormPrice}
                    placeholder="80"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Avaliação</Text>
                  <TextInput
                    style={styles.input}
                    value={formRating ? String(formRating) : ''}
                    onChangeText={(v) => setFormRating(Number(v) || 0)}
                    placeholder="1-5"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Quadra ativa</Text>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: formActive ? '#1D9E75' : '#CCC' }]}
                  onPress={() => setFormActive((v) => !v)}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      { transform: [{ translateX: formActive ? 22 : 0 }] },
                    ]}
                  />
                </TouchableOpacity>
              </View>

              {editingCourt && (
                <TouchableOpacity onPress={handleDelete} style={styles.deleteLink}>
                  <Text style={styles.deleteLinkText}>Excluir quadra</Text>
                </TouchableOpacity>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchBar: {
    height: 44,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginHorizontal: 12,
    marginTop: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
  },
  cardLeft: {
    width: 100,
    height: 100,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cardPhotoIcon: {
    position: 'absolute',
    fontSize: 32,
    color: 'white',
    opacity: 0.3,
  },
  cardInitial: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  cardRight: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  cardAddress: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  cardStars: {
    color: '#FFD700',
    fontSize: 14,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1D9E75',
    marginTop: 4,
  },
  mapsLink: {
    marginTop: 6,
  },
  mapsLinkText: {
    fontSize: 12,
    color: '#378ADD',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  cardBottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  cardActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
  },
  editText: {
    fontSize: 13,
    color: '#378ADD',
  },
  deleteText: {
    fontSize: 13,
    color: '#E74C3C',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D9E75',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  dragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  photoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 28,
  },
  modalScroll: {
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'white',
  },
  deleteLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  deleteLinkText: {
    color: '#E74C3C',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default QuadrasScreen;