import React from 'react';
import { Toaster as HotToaster } from 'react-hot-toast';

export const Toast = () => {
  return (
    <HotToaster
      position="top-right"
      reverseOrder={false}
      gutter={12}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#151722',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#0a0b0f',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#0a0b0f',
          },
        },
      }}
    />
  );
};

export default Toast;
