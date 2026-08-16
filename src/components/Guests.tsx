import { useEffect, useState, useRef } from 'react';
import { User, Room, GuestRegistration } from '../types.ts';
import { Users, Plus, Search, LogOut, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';
import { isValidTC } from '../lib/utils.ts';

interface GuestsProps {
  user: User;
  firebaseUser: any;
}

export default function Guests({ user, firebaseUser }: GuestsProps) {
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Advanced Filter state
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const [filterTc, setFilterTc] = useState('');
  const [filterFirstName, setFilterFirstName] = useState('');
  const [filterLastName, setFilterLastName] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  
  // Active filter state applied on "Filtrele" click
  const [appliedFilters, setAppliedFilters] = useState({
    tc: '',
    firstName: '',
    lastName: '',
    date: '',
    room: ''
  });

  const handleApplyFilters = () => {
    setAppliedFilters({
      tc: filterTc.trim(),
      firstName: filterFirstName.trim(),
      lastName: filterLastName.trim(),
      date: filterDate,
      room: filterRoom.trim()
    });
  };

  const handleClearFilters = () => {
    setFilterTc('');
    setFilterFirstName('');
    setFilterLastName('');
    setFilterDate('');
    setFilterRoom('');
    setAppliedFilters({
      tc: '',
      firstName: '',
      lastName: '',
      date: '',
      room: ''
    });
    setSearch('');
  };
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [guestFormError, setGuestFormError] = useState<string>('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const isCheckingOutRef = useRef(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestRegistration | null>(null);
  
  const [newGuestData, setNewGuestData] = useState({
    numGuests: 1,
    roomId: '',
    notes: '',
    paymentType: '',
    paymentAmount: '',
    paymentType2: '',
    paymentAmount2: '',
    guests: [{ firstName: '', lastName: '', tcId: '', phone: '' }]
  });
  const [checkoutRoomStatus, setCheckoutRoomStatus] = useState('Dirty');

  const handleNumGuestsChange = (e: any) => {
    const val = parseInt(e.target.value);
    const count = isNaN(val) || val < 1 ? 1 : val;
    setNewGuestData(prev => {
      const newGuests = [...prev.guests];
      while (newGuests.length < count) {
        newGuests.push({ firstName: '', lastName: '', tcId: '', phone: '' });
      }
      if (newGuests.length > count) {
        newGuests.length = count;
      }
      return { ...prev, numGuests: count, guests: newGuests };
    });
  };

  const handleGuestFieldChange = (index: number, field: string, value: string) => {
    setNewGuestData(prev => {
      const newGuests = [...prev.guests];
      newGuests[index] = { ...newGuests[index], [field]: value };
      return { ...prev, guests: newGuests };
    });
  };

  const fetchData = async () => {
    try {
      const token = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [gRes, rRes] = await Promise.all([
        fetch('/api/guests', { headers }),
        fetch('/api/rooms', { headers })
      ]);
      if (gRes.ok && rRes.ok) {
        setGuests(await gRes.json().catch(() => ({})));
        setRooms(await rRes.json().catch(() => ({})));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [firebaseUser]);

  const handleAddGuest = async (e: any) => {
    e.preventDefault();
    setGuestFormError('');
    
    const invalidGuest = newGuestData.guests.find(g => !isValidTC(g.tcId));
    if (invalidGuest) {
      setGuestFormError(`Geçersiz TC Kimlik No: ${invalidGuest.tcId}. Lütfen geçerli bir TC Kimlik Numarası girin.`);
      return;
    }

    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newGuestData)
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewGuestData({ numGuests: 1, roomId: '', notes: '', paymentType: '', paymentAmount: '', paymentType2: '', paymentAmount2: '', guests: [{ firstName: '', lastName: '', tcId: '', phone: '' }] });
        fetchData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCheckout = async (e: any) => {
    e.preventDefault();
    if (!selectedGuest) return;
    if (isCheckingOutRef.current) return;
    
    isCheckingOutRef.current = true;
    setIsCheckingOut(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/guests/${selectedGuest.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomStatus: 'Dirty' })
      });
      if (res.ok) {
        setShowCheckoutModal(false);
        setSelectedGuest(null);
        fetchData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      isCheckingOutRef.current = false;
      setIsCheckingOut(false);
    }
  };

  const toTrLower = (str: string) => (str || '').toLocaleLowerCase('tr-TR');

  const filteredGuests = guests.filter(g => {
    const room = rooms.find(r => r.id === g.roomId);
    const roomNumber = room ? room.number : '';
    
    // Quick search bar
    if (search && !toTrLower(`${g.firstName} ${g.lastName} ${g.tcId} ${g.phone} ${roomNumber}`).includes(toTrLower(search))) {
      return false;
    }

    // Advanced applied filters
    if (appliedFilters.tc && !toTrLower(g.tcId || '').includes(toTrLower(appliedFilters.tc))) {
      return false;
    }
    if (appliedFilters.firstName && !toTrLower(g.firstName || '').includes(toTrLower(appliedFilters.firstName))) {
      return false;
    }
    if (appliedFilters.lastName && !toTrLower(g.lastName || '').includes(toTrLower(appliedFilters.lastName))) {
      return false;
    }
    if (appliedFilters.room && !toTrLower(roomNumber || '').includes(toTrLower(appliedFilters.room))) {
      return false;
    }
    if (appliedFilters.date) {
      if (!g.checkInDate) return false;
      const checkInStr = new Date(g.checkInDate).toISOString().split('T')[0];
      if (checkInStr !== appliedFilters.date) return false;
    }

    return true;
  }).sort((a, b) => {
    if (a.status === 'Active' && b.status !== 'Active') return -1;
    if (a.status !== 'Active' && b.status === 'Active') return 1;
    if (a.status === 'Active' && b.status === 'Active') {
      if (a.roomId !== b.roomId) {
        const roomALatest = Math.max(...guests.filter(g => g.roomId === a.roomId && g.status === 'Active').map(g => new Date(g.checkInDate).getTime()));
        const roomBLatest = Math.max(...guests.filter(g => g.roomId === b.roomId && g.status === 'Active').map(g => new Date(g.checkInDate).getTime()));
        if (roomALatest !== roomBLatest) {
          return roomBLatest - roomALatest;
        }
        const roomA = rooms.find(r => r.id === a.roomId)?.number || '';
        const roomB = rooms.find(r => r.id === b.roomId)?.number || '';
        return roomA.localeCompare(roomB, undefined, { numeric: true });
      }
    }
    return new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime();
  });

  const availableRooms = rooms.filter(r => r.status !== 'Dirty' && r.status !== 'Maintenance');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Misafirler</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Kayıtlı tüm misafirleri yönetin ve detaylı filtreleme yapın.</p>
        </div>
        <button 
          onClick={() => {
            setShowAddModal(true);
            setGuestFormError('');
          }}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={20} />
          <span>Yeni Misafir</span>
        </button>
      </header>

      {/* Advanced Filter Panel */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 p-6 transition-colors">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800">
              <Filter size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Filtreleme</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Listeyi hızlıca daraltmak için alanları kullanın</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleApplyFilters}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-medium transition-colors shadow-sm"
            >
              <Filter size={18} />
              <span>Filtrele</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="flex items-center space-x-2 bg-white dark:bg-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-zinc-600 px-4 py-2 rounded-xl font-medium transition-colors"
            >
              <X size={18} />
              <span>Temizle</span>
            </button>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-zinc-700 rounded-xl transition-colors"
            >
              {showFilterPanel ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {showFilterPanel && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Kimlik No</label>
              <input
                type="text"
                placeholder="Kimlik No filtrele"
                value={filterTc}
                onChange={e => setFilterTc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Ad</label>
              <input
                type="text"
                placeholder="Ad filtrele"
                value={filterFirstName}
                onChange={e => setFilterFirstName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Soyad</label>
              <input
                type="text"
                placeholder="Soyad filtrele"
                value={filterLastName}
                onChange={e => setFilterLastName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Geliş Tarihi</label>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilterDate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Verilen Oda</label>
              <input
                type="text"
                placeholder="Oda filtrele"
                value={filterRoom}
                onChange={e => setFilterRoom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-900/50 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-zinc-800 transition-all text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="İsim, TC Kimlik, Telefon veya Oda No ile ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-zinc-800/80 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-zinc-700 text-sm">
                <th className="px-6 py-4 font-medium">Ad Soyad</th>
                <th className="px-6 py-4 font-medium">TC Kimlik</th>
                <th className="px-6 py-4 font-medium">Telefon</th>
                <th className="px-6 py-4 font-medium">Oda</th>
                <th className="px-6 py-4 font-medium">Ödeme</th>
                <th className="px-6 py-4 font-medium">Giriş / Çıkış</th>
                <th className="px-6 py-4 font-medium">Not</th>
                <th className="px-6 py-4 font-medium">Durum</th>
                <th className="px-6 py-4 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
              {filteredGuests.map(guest => {
                const room = rooms.find(r => r.id === guest.roomId);
                return (
                  <tr key={guest.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors">
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">{guest.firstName} {guest.lastName}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{guest.tcId}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm">{guest.phone}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-700 rounded text-sm font-medium">{room?.number}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {(guest.paymentType === 'Misafir' || (!guest.paymentType && guest.paymentAmount === 0)) ? (
                        <div className="font-medium text-gray-900 dark:text-white">Misafir</div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{guest.paymentAmount || 0} ₺</div>
                            <div className="text-xs">{guest.paymentType || 'Nakit'}</div>
                          </div>
                          {guest.paymentType2 && (
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{guest.paymentAmount2 || 0} ₺</div>
                              <div className="text-xs">{guest.paymentType2}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div>G: {new Date(guest.checkInDate).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      {guest.checkOutDate && <div>Ç: {new Date(guest.checkOutDate).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[150px]">
                      {guest.notes ? (
                        guest.notes.length > 20 ? (
                          <div className="flex items-center space-x-1">
                            <span className="truncate">{guest.notes.substring(0, 20)}...</span>
                            <button 
                              onClick={() => { setSelectedNote(guest.notes || ''); setShowNoteModal(true); }}
                              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium text-xs whitespace-nowrap"
                            >
                              Devamını Oku
                            </button>
                          </div>
                        ) : (
                          guest.notes
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${guest.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300'}`}>
                        {guest.status === 'Active' ? 'Aktif' : 'Çıkış Yaptı'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {guest.status === 'Active' && (
                        <button 
                          onClick={() => { setSelectedGuest(guest); setShowCheckoutModal(true); }}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 flex items-center space-x-1 ml-auto text-sm font-medium"
                        >
                          <LogOut size={16} /> <span>Çıkış Yap</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filteredGuests.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Misafir bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-2xl w-full my-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Yeni Misafir Kaydı</h3>
            {guestFormError && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                <div className="mt-0.5">⚠️</div>
                <div>{guestFormError}</div>
              </div>
            )}
            <form onSubmit={handleAddGuest} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oda Seçimi</label>
                  <select value={newGuestData.roomId} onChange={e => setNewGuestData({...newGuestData, roomId: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required>
                    <option value="">Seçiniz...</option>
                    {availableRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.number} (Kap: {r.capacity}) - {r.status === 'Available' ? 'Uygun' : 'Dolu'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Toplam Kişi Sayısı</label>
                  <input type="number" min={1} value={newGuestData.numGuests} onChange={handleNumGuestsChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required />
                </div>
                {rooms.find(r => r.id.toString() === newGuestData.roomId)?.status !== 'Occupied' && (
                  <>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. Ödeme Tipi</label>
                        <select
                          value={newGuestData.paymentType}
                          onChange={e => setNewGuestData({...newGuestData, paymentType: e.target.value})}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                          required
                        >
                          <option value="">Seçiniz...</option>
                          <option value="Nakit">Nakit</option>
                          <option value="Kart">Kart</option>
                          <option value="IBAN">IBAN</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1. Ödeme Tutarı (TL)</label>
                        <input 
                          type="number"
                          min={0}
                          placeholder="0"
                          value={newGuestData.paymentAmount} 
                          onChange={e => setNewGuestData({...newGuestData, paymentAmount: e.target.value})} 
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>
                    
                    {newGuestData.paymentType && (
                      <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">2. Ödeme Tipi (İsteğe Bağlı)</label>
                          <select
                            value={newGuestData.paymentType2}
                            onChange={e => setNewGuestData({...newGuestData, paymentType2: e.target.value})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                          >
                            <option value="">Seçiniz...</option>
                            {newGuestData.paymentType !== 'Nakit' && <option value="Nakit">Nakit</option>}
                            {newGuestData.paymentType !== 'Kart' && <option value="Kart">Kart</option>}
                            {newGuestData.paymentType !== 'IBAN' && <option value="IBAN">IBAN</option>}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">2. Ödeme Tutarı (TL)</label>
                          <input 
                            type="number"
                            min={0}
                            placeholder="0"
                            value={newGuestData.paymentAmount2} 
                            onChange={e => setNewGuestData({...newGuestData, paymentAmount2: e.target.value})} 
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                            required={!!newGuestData.paymentType2}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 pt-4">
                {newGuestData.guests.map((guest, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-zinc-700 rounded-xl relative">
                    <div className="absolute -top-3 left-4 bg-white dark:bg-zinc-800 px-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                      {index + 1}. Misafir {index === 0 ? '(Asıl)' : ''}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ad</label>
                        <input type="text" value={guest.firstName} onChange={e => handleGuestFieldChange(index, 'firstName', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Soyad</label>
                        <input type="text" value={guest.lastName} onChange={e => handleGuestFieldChange(index, 'lastName', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">TC Kimlik No</label>
                        <input type="text" maxLength={11} value={guest.tcId} onChange={e => handleGuestFieldChange(index, 'tcId', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Telefon {index > 0 ? '(Opsiyonel)' : ''}</label>
                        <input type="tel" value={guest.phone} onChange={e => handleGuestFieldChange(index, 'phone', e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" required={index === 0} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Genel Not (Personel için)</label>
                <textarea rows={2} value={newGuestData.notes} onChange={e => setNewGuestData({...newGuestData, notes: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" placeholder="Örn: Erken giriş yaptı..." />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-zinc-700">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg font-medium" disabled={isSubmitting}>İptal</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmitting}>
                  {isSubmitting ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showCheckoutModal && selectedGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Çıkış İşlemi</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              <strong>{selectedGuest.firstName} {selectedGuest.lastName}</strong> misafirinin çıkışını yapmak üzeresiniz.
            </p>
            <form onSubmit={handleCheckout}>
              <div className="mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">Not: Eğer odadaki son misafir ise, oda durumu otomatik olarak "Kirli" yapılacaktır.</p>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCheckoutModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg" disabled={isCheckingOut}>İptal</button>
                <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2" disabled={isCheckingOut}>
                  {isCheckingOut ? 'İşleniyor...' : 'Çıkışı Onayla'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Genel Not</h3>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{selectedNote}</p>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-zinc-700 flex justify-end">
              <button onClick={() => setShowNoteModal(false)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Kapat</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
