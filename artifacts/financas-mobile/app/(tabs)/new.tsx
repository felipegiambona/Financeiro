import { router } from 'expo-router';
import React, { useEffect } from 'react';

export default function NewTransactionTab() {
  useEffect(() => {
    router.replace('/transaction/new?fromTab=1');
  }, []);

  return null;
}