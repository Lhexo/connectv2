import React from 'react';
import GirovisiteSection from '../components/GirovisiteSection';
import { User } from '../types';

interface GirovisiteProps {
  currentUser: User | null;
  onSelectClient?: (clientId: number) => void;
}

export const Girovisite: React.FC<GirovisiteProps> = ({ currentUser, onSelectClient }) => {
  return <GirovisiteSection currentUser={currentUser} onSelectClient={onSelectClient} />;
};

export default Girovisite;
