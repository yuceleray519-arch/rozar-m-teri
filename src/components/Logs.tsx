import { useEffect, useState } from 'react';
import { Log } from '../types.ts';
import { ScrollText, Calendar as CalendarIcon, X } from 'lucide-react';
import { motion } from 'motion/react';

interface LogsProps {
  firebaseUser: any;
}

export default function Logs({ firebaseUser }: LogsProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        const url = selectedDate ? `/api/logs?date=${selectedDate}` : '/api/logs';
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setLogs(await res.json().catch(() => ({})));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [firebaseUser, selectedDate]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
      <header className="mb-8 flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ScrollText size={32} className="text-blue-600 dark:text-blue-400" />
            İşlem Logları
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Sistemdeki tüm kayıtlı işlemleri ve değişiklikleri görüntüleyin.</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-10 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Tarihi temizle"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700 text-sm">
                <th className="px-6 py-4 font-medium">Tarih</th>
                <th className="px-6 py-4 font-medium">İşlem</th>
                <th className="px-6 py-4 font-medium">Kullanıcı (ID)</th>
                <th className="px-6 py-4 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(log.createdAt).toLocaleString('tr-TR')}
                  </td>
                  <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{log.action}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{log.userId}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Henüz log kaydı bulunmuyor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
