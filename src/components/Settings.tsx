import { useEffect, useState } from 'react';
import { Setting } from '../types.ts';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import { motion } from 'motion/react';

interface SettingsProps {
  firebaseUser: any;
}

export default function Settings({ firebaseUser }: SettingsProps) {
  const [settings, setSettings] = useState<{ [key: string]: string }>({
    telegram_token: '',
    telegram_chat_id: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // Telegram Verification State
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');

  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerifyCode(code);
    setVerifyMessage('');
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyMessage('');
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/settings/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: verifyCode })
      });
      
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSettings(prev => ({...prev, telegram_chat_id: data.chatId}));
        setVerifyMessage('✅ Başarıyla bağlandı! Chat ID otomatik eklendi. Lütfen "Kaydet" butonuna basarak ayarları kalıcı hale getirin.');
      } else {
        setVerifyMessage(`❌ Hata: ${data.error}`);
      }
    } catch (error) {
      setVerifyMessage('❌ Bir hata oluştu.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data: Setting[] = await res.json().catch(() => ({}));
          const newSettings: any = { telegram_token: '', telegram_chat_id: '' };
          data.forEach(s => { newSettings[s.key] = s.value; });
          setSettings(newSettings);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [firebaseUser]);

  const handleSave = async (e: any) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings })
      });
      if (res.ok) {
        setMessage('Ayarlar başarıyla kaydedildi.');
      } else {
        setMessage('Hata oluştu.');
      }
    } catch (error) {
      console.error(error);
      setMessage('Hata oluştu.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 max-w-2xl">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon size={32} className="text-blue-600 dark:text-blue-400" />
          Sistem Ayarları
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Telegram bot entegrasyonu ve diğer genel ayarlar.</p>
      </header>

      {loading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 p-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Telegram Bildirimleri</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Yeni giriş ve çıkış işlemlerinde anında Telegram üzerinden bildirim almak için bot bilgilerinizi girin.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bot Token</label>
                  <input 
                    type="text" 
                    value={settings.telegram_token}
                    onChange={e => setSettings({...settings, telegram_token: e.target.value})}
                    placeholder="123456789:AAH..."
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chat ID</label>
                  <input 
                    type="text" 
                    value={settings.telegram_chat_id}
                    onChange={e => setSettings({...settings, telegram_chat_id: e.target.value})}
                    placeholder="-100123456789"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-100 dark:border-zinc-700 flex flex-col space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Otomatik Bağlantı (Önerilen)</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-4">
                  Bot token'ınızı girdikten ve kaydettikten sonra, bir doğrulama kodu oluşturup bota gönderebilirsiniz. Sistem Chat ID'yi otomatik bulacaktır.
                </p>
                {!verifyCode ? (
                  <button type="button" onClick={generateCode} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Bağlantı Kodu Oluştur
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Lütfen Telegram'da botunuza gidip aşağıdaki mesajı gönderin:
                    </p>
                    <div className="bg-white dark:bg-zinc-800 p-3 rounded font-mono text-center text-lg tracking-wider border border-gray-200 dark:border-zinc-700 font-bold select-all">
                      /start {verifyCode}
                    </div>
                    <button type="button" onClick={handleVerify} disabled={verifying} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      {verifying ? 'Kontrol Ediliyor...' : 'Gönderdim, Doğrula'}
                    </button>
                    {verifyMessage && <p className={`text-sm mt-2 font-medium ${verifyMessage.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{verifyMessage}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">{message}</span>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Save size={20} />
                  <span>{saving ? 'Kaydediliyor...' : 'Kaydet'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </motion.div>
  );
}
