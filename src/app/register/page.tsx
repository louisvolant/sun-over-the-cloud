'use client';

import { useState } from 'react';
import { register } from '@/lib/login_api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const router = useRouter();
  const { t } = useLanguage();

  // Validation rules
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Basic email format check

  const validateUsername = (value: string) => {
    if (value.length <= 6) {
      setUsernameError(t('username_length_error'));
    } else {
      setUsernameError('');
    }
  };

  const validateEmail = (value: string) => {
    if (!emailRegex.test(value)) {
      setEmailError(t('invalid_email_error'));
    } else {
      setEmailError('');
    }
  };

  const validatePassword = (value: string) => {
    if (value.length < 15) {
      setPasswordError(t('password_length_error'));
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    validateUsername(username);
    validateEmail(email);
    validatePassword(password);

    if (usernameError || emailError || passwordError || !username || !email || !password) {
      setError(t('fix_errors_before_submitting'));
      return;
    }

    try {
      await register(username, email, password);
      router.push('/account');
    } catch (err: unknown) {
      // Handle the error with type checking
      if (err instanceof Error && 'response' in err) {
        // Assuming the error has a response property from fetch
        const fetchError = err as Error & { response?: { data?: { error?: string } } };
        setError(fetchError.response?.data?.error || t('registration_failed'));
      } else if (err instanceof Error) {
        setError(err.message || t('registration_failed'));
      } else {
        setError(t('registration_failed'));
      }
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t('register_title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 dark:text-gray-200 mb-2">
              {t('username_label')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                validateUsername(e.target.value);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              required
            />
            {usernameError && (
              <p className="text-red-500 text-sm mt-1">{usernameError}</p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 dark:text-gray-200 mb-2">
              {t('email_label')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                validateEmail(e.target.value);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              required
            />
            {emailError && (
              <p className="text-red-500 text-sm mt-1">{emailError}</p>
            )}
          </div>
          <div>
            <label className="block text-gray-700 dark:text-gray-200 mb-2">
              {t('password_label')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(e.target.value);
              }}
              className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              required
            />
            {passwordError && (
              <p className="text-red-500 text-sm mt-1">{passwordError}</p>
            )}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <div>
            <button
              type="submit"
              className="w-full bg-primary text-white hover:bg-primary-focus dark:bg-primary dark:hover:bg-primary-focus px-4 py-2 rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!!usernameError || !!emailError || !!passwordError}
            >
              {t('register_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}