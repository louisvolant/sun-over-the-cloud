// src/app/components/AccountActionsComponent.tsx
import React, { useState, useRef } from 'react';
import { changePassword } from '@/lib/login_api';
import { useLanguage } from '@/context/LanguageContext';

interface AccountActionsComponentProps {
  onDeleteAccount: () => void;
}

export default function AccountActionsComponent({
  onDeleteAccount,
}: AccountActionsComponentProps) {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
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
    if (newPassword.length < 8) {
      setPasswordError(t('password_min_length_error'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwords_do_not_match_error'));
      return;
    }
    try {
      await changePassword(newPassword);
      setSuccessMessage(t('password_changed_success'));
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordForm(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError(t('failed_to_change_password'));
    }
  };

  const togglePasswordForm = () => {
    setShowPasswordForm(!showPasswordForm);
    setPasswordError('');
    setSuccessMessage('');
    setNewPassword('');
    setConfirmPassword('');
    if (!showPasswordForm && formRef.current) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center space-y-4 md:flex-row md:justify-center md:space-y-0 md:space-x-4">
        <button
          onClick={togglePasswordForm}
          className={`w-full md:w-auto text-white font-medium py-2 px-6 rounded transition-colors ${
            showPasswordForm
              ? 'bg-blue-700 dark:bg-blue-500 ring-2 ring-blue-500'
              : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500'
          }`}
        >
          {t('change_my_password_button')}
        </button>
        <button
          onClick={onDeleteAccount}
          className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-6 rounded transition-colors"
        >
          {t('delete_my_account_button')}
        </button>
      </div>

      {showPasswordForm && (
        <div
          ref={formRef}
          className="mt-8 bg-white dark:bg-gray-900 rounded-lg shadow-md p-6 max-w-md mx-auto relative"
        >
          <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400 mb-4">{t('change_password_title')}</h2>
          <form onSubmit={handleChangePassword}>
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
            {successMessage && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-800 border border-green-300 dark:border-green-600 text-green-700 dark:text-green-200 rounded-md animate-fade-in text-sm">
                {successMessage}
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={togglePasswordForm}
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
      )}
    </>
  );
}