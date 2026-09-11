import React from 'react';

export interface PlayerCardProps {
  nome?: string;
  posicao?: string;
  idade?: number;
  jogos?: number;
  gols?: number;
  rating?: number;
  primaryColor?: string;
  secondaryColor?: string;
  nacionalidade?: { code: string; flagEmoji: string } | string;
  timeNome?: string;
  timeFlagUrl?: string;
  adquirido?: boolean;
  foto?: string;
  anoAquisicao?: number;
}

declare const PlayerCard: React.ComponentType<PlayerCardProps>;
export default PlayerCard;
