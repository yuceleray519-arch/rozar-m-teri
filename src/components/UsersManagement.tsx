import { useState, useEffect } from 'react';
import { User } from '../types.ts';
import { Users as UsersIcon, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface UsersProps {
  firebaseUser: any;
}

export default function UsersManagement({ firebaseUser }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'personnel' });
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(await res.json().catch(() => ({})));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [firebaseUser]);

  const handleAddUser = async (e: any) => {
    e.preventDefault();
    setError('');
    if (newUser.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      
      if (res.ok) {
        setShowAddModal(false);
        setNewUser({ email: '', password: '', role: 'personnel' });
        fetchUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Personel eklenemedi.');
      }
    } catch (error: any) {
      setError('Bir hata oluştu.');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Bu personeli silmek istediğinize emin misiniz?')) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/users/${uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Personel Yönetimi</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sisteme erişimi olan personelleri yönetin.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>Yeni Personel</span>
        </button>
      </header>

      {loading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-700">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">ID</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">E-posta</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400">Rol</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">{u.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{u.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {u.uid !== firebaseUser.uid && (
                      <button 
                        onClick={() => handleDeleteUser(u.uid)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-2"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Yeni Personel Ekle</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-posta</label>
                <input 
                  type="email" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Şifre</label>
                <input 
                  type="password" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                >
                  <option value="personnel">Personel</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              
              {error && <p className="text-red-500 text-sm">{error}</p>}
              
              <div className="flex justify-end space-x-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                >
                  İptal
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Oluştur
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
