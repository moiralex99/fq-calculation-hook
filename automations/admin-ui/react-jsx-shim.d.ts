// Minimal React/JSX shim for isolated usage without full TS config
// Safe to delete if your app already has React type definitions.

import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export {};
