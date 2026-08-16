import { useEffect, useState } from 'react';
import { User, Room, GuestRegistration } from '../types.ts';
import { Users, BedDouble, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  user: User;
  firebaseUser: any;
}

export default function Dashboard({ user, firebaseUser }: DashboardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        
        const [roomsRes, guestsRes] = await Promise.all([
          fetch('/api/rooms', { headers }),
          fetch('/api/guests', { headers })
        ]);

        if (roomsRes.ok && guestsRes.ok) {
          setRooms(await roomsRes.json().catch(() => ({})));
          setGuests(await guestsRes.json().catch(() => ({})));
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [firebaseUser]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
  }

  const activeGuestsCount = guests.filter(g => g.status === 'Active').reduce((sum, g) => sum + g.numGuests, 0);
  const occupiedRoomsCount = rooms.filter(r => r.status === 'Occupied').length;
  const availableRoomsCount = rooms.filter(r => r.status === 'Available').length;
  const dirtyRoomsCount = rooms.filter(r => r.status === 'Dirty').length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8"
    >
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Hoş Geldiniz, {user.email}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Günlük otel özetini aşağıda görebilirsiniz.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Aktif Misafirler</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeGuestsCount}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Uygun Odalar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{availableRoomsCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center space-x-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            <BedDouble size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Dolu Odalar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{occupiedRoomsCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center space-x-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Kirli Odalar</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{dirtyRoomsCount}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Son Giriş Yapan Misafirler</h3>
          <div className="space-y-4">
            {guests.filter(g => g.status === 'Active').slice(0, 5).map(g => {
              const room = rooms.find(r => r.id === g.roomId);
              return (
                <div key={g.id} className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-zinc-700 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{g.firstName} {g.lastName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(g.checkInDate).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} - {g.numGuests} Kişi</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium">
                      Oda {room?.number}
                    </div>
                    <div className="text-xs text-gray-500 font-medium whitespace-pre-line text-right">
                      {(g.paymentType === 'Misafir' || (!g.paymentType && g.paymentAmount === 0)) 
                        ? 'Misafir' 
                        : `${g.paymentAmount || 0} ₺ (${g.paymentType || 'Nakit'})${g.paymentType2 ? `\n${g.paymentAmount2 || 0} ₺ (${g.paymentType2})` : ''}`}
                    </div>
                  </div>
                </div>
              );
            })}
            {guests.filter(g => g.status === 'Active').length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">Aktif misafir bulunmuyor.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
