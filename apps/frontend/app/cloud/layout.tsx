'use client';

import React from 'react';
import { CloudProvider } from '../../context/CloudContext';
import CloudLayoutWrapper from './CloudLayoutWrapper';

export default function CloudLayout({ children }: { children: React.ReactNode }) {
  return (
    <CloudProvider>
      <CloudLayoutWrapper>
        {children}
      </CloudLayoutWrapper>
    </CloudProvider>
  );
}
