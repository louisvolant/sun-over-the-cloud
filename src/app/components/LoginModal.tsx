// src/components/LoginModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { login } from '@/lib/login_api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

interface LoginModalProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

export default function LoginModal({ isOpen, setIsOpen }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { setIsAuthenticated } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  const handleGoogleLogin = () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      setIsOpen(false);
      setIsAuthenticated(true);
      router.push('/account');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message); // Use the backend's error message if available
      } else {
        setError(t('unexpected_error'));
      }
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  // Clear error message after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50 m-0 p-0">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 w-full max-w-md">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('login_modal_title')}</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 mb-2">
              {t('username_or_email_label')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 dark:text-gray-200 mb-2">
              {t('password_label')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
              required
            />
          </div>
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md animate-fade-in">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="submit"
              className="bg-secondary text-white hover:bg-secondary-focus dark:bg-secondary dark:hover:bg-secondary-focus px-4 py-2 rounded-md transition-all duration-300"
            >
              {t('login_button')}
            </button>
            <button
              type="button"
              className="bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-md transition-all duration-300"
              onClick={handleCancel}
            >
              {t('cancel_button')}
            </button>
          </div>
        </form>
        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 px-4 py-2 rounded-md shadow-sm transition-all duration-300"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M17.6996 9.20184C17.6996 8.57234 17.6432 7.96706 17.5382 7.38599H9.17725V10.82H13.955C13.7492 11.9297 13.1237 12.8699 12.1835 13.4994V15.7268H15.0525C16.7312 14.1813 17.6996 11.9054 17.6996 9.20184Z"
                fill="#4285F4"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.1774 17.8775C11.5743 17.8775 13.5839 17.0826 15.0527 15.7268L12.1836 13.4993C11.3887 14.032 10.3718 14.3467 9.1774 14.3467C6.86521 14.3467 4.90813 12.7851 4.21003 10.6868H1.24414V12.9868C2.70489 15.8882 5.7071 17.8775 9.1774 17.8775Z"
                fill="#34A853"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.20994 10.687C4.03239 10.1543 3.93151 9.58534 3.93151 9.00023C3.93151 8.41512 4.03239 7.84616 4.20994 7.31351V5.01343H1.24405C0.642799 6.21189 0.299805 7.56773 0.299805 9.00023C0.299805 10.4327 0.642799 11.7886 1.24405 12.987L4.20994 10.687Z"
                fill="#FBBC05"
              />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.1774 3.65338C10.4808 3.65338 11.651 4.10129 12.571 4.98097L15.1173 2.43474C13.5798 1.00224 11.5703 0.122559 9.1774 0.122559C5.7071 0.122559 2.70489 2.11193 1.24414 5.01326L4.21003 7.31334C4.90813 5.21502 6.86521 3.65338 9.1774 3.65338Z"
                fill="#EA4335"
              />
            </svg>
            <span>{t('login_with_google')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}