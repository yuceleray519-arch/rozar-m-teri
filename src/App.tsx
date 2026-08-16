import { useState, useEffect } from 'react';
import { auth } from './lib/firebase.ts';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { User } from './types.ts';
import Dashboard from './components/Dashboard.tsx';
import Rooms from './components/Rooms.tsx';
import Guests from './components/Guests.tsx';
import Logs from './components/Logs.tsx';
import Settings from './components/Settings.tsx';
import UsersManagement from './components/UsersManagement.tsx';
import Revenue from './components/Revenue.tsx';
import { LayoutDashboard, BedDouble, Users, ScrollText, Settings as SettingsIcon, LogOut, Moon, Sun, Shield, Banknote } from 'lucide-react';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const fetchDbUser = async (user: any) => {
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setDbUser(data.user);
        return true;
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Failed to fetch user data", errData);
        setLoginError('Kullanıcı verisi alınamadı: ' + (errData.error || 'Sunucu hatası'));
        return false;
      }
    } catch (e: any) {
      console.error(e);
      setLoginError('Sunucu bağlantı hatası.');
      return false;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchDbUser(user);
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    const cleanEmail = email.trim();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      await fetchDbUser(userCredential.user);
    } catch (error: any) {
      console.error("Login error:", error);
      let msg = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Hatalı e-posta veya şifre. (Eğer henüz Firebase Authentication paneline bu kullanıcıyı eklemediyseniz önce eklemelisiniz).';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'Firebase Konsolunda E-posta/Şifre ile giriş yöntemi henüz aktifleştirilmemiş.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Çok fazla hatalı deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
      } else if (error.message) {
        msg = error.message;
      }
      setLoginError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!firebaseUser || !dbUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-900 transition-colors px-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Rozar Hotel</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Yönetim Sistemine Giriş Yapın</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">E-posta</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Şifre</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                required
              />
            </div>
            
            {loginError && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                {loginError}
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoggingIn ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>


        </div>
      </div>
    );
  }

  const isAdmin = dbUser.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 transition-colors flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white dark:bg-zinc-800 border-b md:border-b-0 md:border-r border-gray-200 dark:border-zinc-700 flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rozar Hotel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{dbUser.role} Portalı</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
          >
            <LayoutDashboard size={20} />
            <span>Panel</span>
          </button>
          <button 
            onClick={() => setActiveTab('rooms')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'rooms' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
          >
            <BedDouble size={20} />
            <span>Odalar</span>
          </button>
          <button 
            onClick={() => setActiveTab('guests')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'guests' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
          >
            <Users size={20} />
            <span>Misafirler</span>
          </button>
          <button 
            onClick={() => setActiveTab('revenue')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'revenue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
          >
            <Banknote size={20} />
            <span>Ciro</span>
          </button>
          
          {isAdmin && (
            <>
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
              >
                <Shield size={20} />
                <span>Personel Yönetimi</span>
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'logs' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
              >
                <ScrollText size={20} />
                <span>İşlem Logları</span>
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 font-medium' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700'}`}
              >
                <SettingsIcon size={20} />
                <span>Ayarlar (Telegram)</span>
              </button>
            </>
          )}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-zinc-700 space-y-4">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <span>Tema Değiştir</span>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        {activeTab === 'dashboard' && <Dashboard user={dbUser} firebaseUser={firebaseUser} />}
        {activeTab === 'rooms' && <Rooms user={dbUser} firebaseUser={firebaseUser} />}
        {activeTab === 'guests' && <Guests user={dbUser} firebaseUser={firebaseUser} />}
        {activeTab === 'revenue' && <Revenue firebaseUser={firebaseUser} />}
        {activeTab === 'users' && isAdmin && <UsersManagement firebaseUser={firebaseUser} />}
        {activeTab === 'logs' && isAdmin && <Logs firebaseUser={firebaseUser} />}
        {activeTab === 'settings' && isAdmin && <Settings firebaseUser={firebaseUser} />}
      </main>
    </div>
  );
}
