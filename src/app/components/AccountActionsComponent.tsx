// src/app/components/AccountActionsComponent.tsx
import React, { useState, useRef } from 'react';
import { changePassword } from '@/lib/login_api';
import { MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy';
import { useLanguage } from '@/context/LanguageContext';

interface AccountActionsComponentProps {
  onDeleteAccount: () => void;
}

export default function AccountActionsComponent({
  onDeleteAccount,
}: AccountActionsComponentProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setSuccessMessage('');
    if (!currentPassword) {
      setPasswordError(t('current_password_required_error'));
      return;
    }
    // Mirrors the shared server-side policy (src/lib/passwordPolicy.ts) so
    // the client never submits a password the backend would reject.
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('password_min_length_error'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwords_do_not_match_error'));
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage(t('password_changed_success'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      // Map the backend's stable error code to a translated message; keep a
      // generic fallback for network or server errors.
      if (error instanceof Error && error.message === 'current_password_incorrect') {
        setPasswordError(t('current_password_incorrect_error'));
      } else {
        setPasswordError(t('failed_to_change_password'));
      }
    }
  };

  const openPasswordForm = () => {
    setShowPasswordForm(true);
    setPasswordError('');
    setSuccessMessage('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    setPasswordError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {successMessage && (
        <div className="w-full max-w-md p-3 bg-green-100 dark:bg-green-800 border border-green-300 dark:border-green-600 text-green-700 dark:text-green-200 rounded-md animate-fade-in text-sm text-center">
          {successMessage}
        </div>
      )}

      {showPasswordForm ? (
        <div
          ref={formRef}
          className="w-full bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 max-w-md mx-auto relative"
        >
          <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4">{t('change_password_title')}</h2>
          <form onSubmit={handleChangePassword}>
            <div className="mb-4">
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('current_password_label')}
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder={t('current_password_placeholder')}
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('new_password_label')}
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder={t('new_password_placeholder')}
                required
              />
            </div>
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('confirm_password_label')}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                placeholder={t('confirm_password_placeholder')}
                required
              />
            </div>
            {passwordError && (
              <p className="text-red-500 dark:text-red-400 text-sm mb-4">{passwordError}</p>
            )}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closePasswordForm}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 font-medium py-2 px-4 rounded transition-colors text-sm"
              >
                {t('cancel_button')}
              </button>
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors text-sm"
              >
                {t('save_password_button')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="w-full flex flex-col items-center space-y-4 md:flex-row md:justify-center md:space-y-0 md:space-x-4">
        {!showPasswordForm && (
          <button
            onClick={openPasswordForm}
            className="w-full md:w-auto bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-medium py-2 px-6 rounded transition-colors"
          >
            {t('change_my_password_button')}
          </button>
        )}
        <button
          onClick={onDeleteAccount}
          className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded transition-colors"
        >
          {t('delete_my_account_button')}
        </button>
      </div>
    </div>
  );
}
