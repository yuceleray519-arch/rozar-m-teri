import { useEffect, useState, useRef } from 'react';
import { User, Room, GuestRegistration } from '../types.ts';
import { BedDouble, Plus, Users, Edit2, Trash2, ArrowRightLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { isValidTC } from '../lib/utils.ts';

interface RoomsProps {
  user: User;
  firebaseUser: any;
}

export default function Rooms({ user, firebaseUser }: RoomsProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ number: '', floor: 1, capacity: 2, orderIndex: 1 });
  
  // Room Edit State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Guest Add State
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestFormError, setGuestFormError] = useState('');
  const [selectedRoomForGuest, setSelectedRoomForGuest] = useState<Room | null>(null);
  const [isSubmittingGuest, setIsSubmittingGuest] = useState(false);
  const isSubmittingGuestRef = useRef(false);
  
  const [newGuestData, setNewGuestData] = useState<{
    numGuests: number;
    notes: string;
    paymentType: string;
    paymentAmount: string | number;
    paymentType2?: string;
    paymentAmount2?: string | number;
    guests: Array<{ firstName: string; lastName: string; tcId: string; phone: string }>;
  }>({
    numGuests: 1,
    notes: '',
    paymentType: '',
    paymentAmount: '',
    paymentType2: '',
    paymentAmount2: '',
    guests: [{ firstName: '', lastName: '', tcId: '', phone: '' }]
  });
  
  const [confirmRoomWarning, setConfirmRoomWarning] = useState<Room | null>(null);
  const [confirmRoomDelete, setConfirmRoomDelete] = useState<number | null>(null);

  // Transfer State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedRoomForTransfer, setSelectedRoomForTransfer] = useState<Room | null>(null);
  const [targetTransferRoomId, setTargetTransferRoomId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const isTransferringRef = useRef(false);

  const fetchRooms = async () => {
    try {
      const token = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [rRes, gRes] = await Promise.all([
        fetch('/api/rooms', { headers }),
        fetch('/api/guests', { headers })
      ]);
      if (rRes.ok) {
        setRooms(await rRes.json().catch(() => ({})));
      }
      if (gRes.ok) {
        setGuests(await gRes.json().catch(() => ({})));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [firebaseUser]);

  const handleAddRoom = async (e: any) => {
    e.preventDefault();
    if (user.role !== 'admin') return;
    
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newRoom)
      });
      
      if (res.ok) {
        setShowAddModal(false);
        setNewRoom({ number: '', floor: 1, capacity: 2, orderIndex: 1 });
        fetchRooms();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditRoom = async (e: any) => {
    e.preventDefault();
    if (user.role !== 'admin' || !editingRoom) return;
    
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/rooms/${editingRoom.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingRoom)
      });
      
      if (res.ok) {
        setShowEditModal(false);
        setEditingRoom(null);
        fetchRooms();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (user.role !== 'admin') return;
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setShowEditModal(false);
        setEditingRoom(null);
        fetchRooms();
      }
    } catch (error) {
      console.error(error);
    }
  };
  
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

  const handleAddGuest = async (e: any) => {
    e.preventDefault();
    setGuestFormError('');
    if (!selectedRoomForGuest) return;

    const invalidGuest = newGuestData.guests.find(g => !isValidTC(g.tcId));
    if (invalidGuest) {
      setGuestFormError(`Geçersiz TC Kimlik No: ${invalidGuest.tcId}. Lütfen geçerli bir TC Kimlik Numarası girin.`);
      return;
    }

    if (isSubmittingGuestRef.current) return;
    
    isSubmittingGuestRef.current = true;
    setIsSubmittingGuest(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          ...newGuestData, 
          paymentAmount: Number(newGuestData.paymentAmount) || 0,
          roomId: selectedRoomForGuest.id 
        })
      });
      
      if (res.ok) {
        setShowGuestModal(false);
        setNewGuestData({ numGuests: 1, notes: '', paymentType: '', paymentAmount: '', paymentType2: '', paymentAmount2: '', guests: [{ firstName: '', lastName: '', tcId: '', phone: '' }] });
        setSelectedRoomForGuest(null);
        fetchRooms();
      }
    } catch (error) {
      console.error(error);
    } finally {
      isSubmittingGuestRef.current = false;
      setIsSubmittingGuest(false);
    }
  };

  const handleTransferRoom = async (e: any) => {
    e.preventDefault();
    if (!selectedRoomForTransfer || !targetTransferRoomId) return;
    if (isTransferringRef.current) return;

    const targetRoom = rooms.find(r => r.id === Number(targetTransferRoomId));
    if (targetRoom) {
      if (targetRoom.status === 'Dirty') {
        alert("Hedef oda şu an KİRLİ durumda. Taşıma yapılamaz.");
        return;
      }
      if (targetRoom.status === 'Maintenance') {
        alert("Hedef oda şu an ARIZALI durumda. Taşıma yapılamaz.");
        return;
      }
      if (targetRoom.status === 'Occupied') {
        alert("Hedef oda şu an DOLU durumda. Taşıma yapılamaz.");
        return;
      }
    }

    isTransferringRef.current = true;
    setIsTransferring(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/rooms/${selectedRoomForTransfer.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newRoomId: targetTransferRoomId })
      });
      
      if (res.ok) {
        setShowTransferModal(false);
        setSelectedRoomForTransfer(null);
        setTargetTransferRoomId('');
        fetchRooms();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Oda taşıma işlemi başarısız.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      isTransferringRef.current = false;
      setIsTransferring(false);
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    // Check if room has active guests registered (staff only restriction)
    const activeGuestsInRoom = guests.filter(g => g.roomId === id && g.status === 'Active' && !g.isDeleted);
    
    if (user.role !== 'admin' && activeGuestsInRoom.length > 0 && status !== 'Occupied') {
      alert("Bu odada aktif konaklayan misafir(ler) bulunmaktadır! Personel oda durumunu değiştiremez. Oda durumunu değiştirmek için lütfen önce Misafirler sayfasından Çıkış (Check-out) yapınız.");
      fetchRooms(); // refresh select dropdown back
      return;
    }

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`/api/rooms/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        fetchRooms();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Oda durumu güncellenemedi.");
        fetchRooms();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Group rooms by floor
  const groupedRooms = rooms.reduce((acc, room) => {
    if (!acc[room.floor]) acc[room.floor] = [];
    acc[room.floor].push(room);
    return acc;
  }, {} as { [key: number]: Room[] });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-8"
    >
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Odalar</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Tüm odaları yönetin ve durumlarını güncelleyin.</p>
        </div>
        {user.role === 'admin' && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={20} />
            <span>Yeni Oda</span>
          </button>
        )}
      </header>

      {loading ? (
        <div className="text-gray-500">Yükleniyor...</div>
      ) : (
        <div className="space-y-8">
          {Object.keys(groupedRooms).sort((a, b) => Number(b) - Number(a)).map((floorStr) => {
            const floorRooms = groupedRooms[Number(floorStr)];
            return (
              <div key={floorStr} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-zinc-700 pb-2">
                  {floorStr}. Kat Odaları
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                  {floorRooms.map(room => (
                    <div key={room.id} className="bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-700 p-3.5 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 rounded-lg shadow-sm">
                            <BedDouble size={20} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{room.number}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' && (
                            <button
                              onClick={() => {
                                setEditingRoom(room);
                                setShowEditModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                              title="Düzenle"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          <div className={`px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm ${
                            room.status === 'Available' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                            room.status === 'Occupied' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800' :
                            room.status === 'Maintenance' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border border-yellow-200/80 dark:border-yellow-800'
                          }`}>
                            {room.status === 'Available' ? 'Uygun' : room.status === 'Occupied' ? 'Dolu' : room.status === 'Maintenance' ? 'Arızalı' : 'Kirli'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2 mb-6 flex justify-between items-center">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Kapasite: <strong>{room.capacity} Kişi</strong></p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Misafir: <strong>{room.status === 'Occupied' ? guests.filter(g => g.roomId === room.id && g.status === 'Active' && !g.isDeleted).length + ' Kişi' : 'Boş'}</strong>
                        </p>
                      </div>
                      
                      <div className="mt-auto pt-4 border-t border-gray-200 dark:border-zinc-700">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Durum Değiştir</label>
                        <select 
                          value={room.status}
                          onChange={(e) => handleStatusChange(room.id, e.target.value)}
                          className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none mb-3 cursor-pointer"
                        >
                          <option value="Available">Uygun</option>
                          <option value="Occupied">Dolu</option>
                          <option value="Dirty">Kirli</option>
                          <option value="Maintenance">Arızalı</option>
                        </select>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (room.status === 'Dirty') {
                                alert("Bu oda şu an KİRLİ durumda. Temizlenmeden misafir eklenemez.");
                                return;
                              }
                              if (room.status === 'Maintenance') {
                                alert("Bu oda şu an ARIZALI durumda. Misafir eklenemez.");
                                return;
                              }
                              if (room.status === 'Occupied') {
                                setConfirmRoomWarning(room);
                                return;
                              }
                              setSelectedRoomForGuest(room);
                              setGuestFormError('');
                              setShowGuestModal(true);
                            }}
                            className="flex-1 flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Users size={16} />
                            <span>{room.status === 'Occupied' ? 'Ekle' : 'Misafir Ekle'}</span>
                          </button>
                          
                          {room.status === 'Occupied' && (
                            <button
                              onClick={() => {
                                setSelectedRoomForTransfer(room);
                                setShowTransferModal(true);
                              }}
                              className="flex-1 flex items-center justify-center space-x-2 bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 dark:text-orange-400 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                              <ArrowRightLeft size={16} />
                              <span>Taşı</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showGuestModal && selectedRoomForGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-2xl w-full my-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Oda {selectedRoomForGuest.number} - Misafir Kaydı</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Maksimum kapasite: {selectedRoomForGuest.capacity} kişi</p>
            {guestFormError && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                <div className="mt-0.5">⚠️</div>
                <div>{guestFormError}</div>
              </div>
            )}
            <form onSubmit={handleAddGuest} className="space-y-6">
              
              <div className={`bg-gray-50 dark:bg-zinc-900 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 grid ${selectedRoomForGuest.status === 'Occupied' ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Toplam Kişi Sayısı</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={selectedRoomForGuest.capacity} 
                    value={newGuestData.numGuests} 
                    onChange={handleNumGuestsChange} 
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" 
                    required 
                  />
                </div>
                {selectedRoomForGuest.status !== 'Occupied' && (
                  <>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Ödeme Tipi</label>
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Ödeme Tutarı (TL)</label>
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
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Ödeme Tipi (İsteğe Bağlı)</label>
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
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Ödeme Tutarı (TL)</label>
                          <input 
                            type="number"
                            min={0}
                            placeholder="0"
                            value={newGuestData.paymentAmount2 || ''} 
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

              <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 pt-4">
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
                <textarea rows={2} value={newGuestData.notes} onChange={e => setNewGuestData({...newGuestData, notes: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white" placeholder="Örn: Erken giriş yaptı, ekstra yatak istendi..." />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-zinc-700">
                <button type="button" onClick={() => setShowGuestModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg font-medium" disabled={isSubmittingGuest}>İptal</button>
                <button type="submit" className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed" disabled={isSubmittingGuest}>
                  {isSubmittingGuest ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-md w-full"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Yeni Oda Ekle</h3>
            <form onSubmit={handleAddRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oda Numarası</label>
                <input 
                  type="text" 
                  value={newRoom.number}
                  onChange={e => setNewRoom({...newRoom, number: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kat</label>
                  <input 
                    type="number" 
                    value={newRoom.floor}
                    onChange={e => setNewRoom({...newRoom, floor: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kapasite</label>
                  <input 
                    type="number" 
                    value={newRoom.capacity}
                    onChange={e => setNewRoom({...newRoom, capacity: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sıra No</label>
                  <input 
                    type="number" 
                    value={newRoom.orderIndex}
                    onChange={e => setNewRoom({...newRoom, orderIndex: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
              </div>
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
                  Ekle
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showEditModal && editingRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-md w-full"
          >
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Oda Düzenle</h3>
            <form onSubmit={handleEditRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Oda Numarası</label>
                <input 
                  type="text" 
                  value={editingRoom.number}
                  onChange={e => setEditingRoom({...editingRoom, number: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kat</label>
                  <input 
                    type="number" 
                    value={editingRoom.floor}
                    onChange={e => setEditingRoom({...editingRoom, floor: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kapasite</label>
                  <input 
                    type="number" 
                    value={editingRoom.capacity}
                    onChange={e => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sıra No</label>
                  <input 
                    type="number" 
                    value={editingRoom.orderIndex}
                    onChange={e => setEditingRoom({...editingRoom, orderIndex: parseInt(e.target.value)})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-between items-center mt-8">
                <button 
                  type="button" 
                  onClick={() => setConfirmRoomDelete(editingRoom.id)}
                  className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center space-x-2"
                >
                  <Trash2 size={16} />
                  <span>Sil</span>
                </button>
                <div className="flex space-x-3">
                  <button 
                    type="button" 
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    Güncelle
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {confirmRoomWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Dikkat</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Bu oda şu an DOLU durumda. Yeni misafir eklemek istediğinize emin misiniz?
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setConfirmRoomWarning(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">İptal</button>
              <button 
                onClick={() => {
                  const room = confirmRoomWarning;
                  setConfirmRoomWarning(null);
                  setSelectedRoomForGuest(room);
                  setGuestFormError('');
                  setShowGuestModal(true);
                }} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Evet, Devam Et
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {confirmRoomDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Odayı Sil</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Bu odayı silmek istediğinize emin misiniz?
            </p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setConfirmRoomDelete(null)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">İptal</button>
              <button 
                onClick={() => {
                  handleDeleteRoom(confirmRoomDelete);
                  setConfirmRoomDelete(null);
                }} 
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Evet, Sil
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showTransferModal && selectedRoomForTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft size={24} className="text-orange-500" /> Oda Taşıma İşlemi
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">&times;</button>
            </div>
            
            <form onSubmit={handleTransferRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mevcut Oda</label>
                <div className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-300 font-bold border border-gray-200 dark:border-zinc-600">
                  {selectedRoomForTransfer.number}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hedef Oda (Yeni Oda)</label>
                <select 
                  value={targetTransferRoomId} 
                  onChange={(e) => setTargetTransferRoomId(e.target.value)} 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Seçiniz...</option>
                  {rooms.filter(r => r.id !== selectedRoomForTransfer.id).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.number} (Kap: {r.capacity}) - {r.status === 'Available' ? 'Uygun' : r.status === 'Occupied' ? 'Dolu' : r.status === 'Maintenance' ? 'Arızalı' : 'Kirli'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg">İptal</button>
                <button type="submit" disabled={isTransferring} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                  {isTransferring ? 'Taşınıyor...' : 'Misafirleri Taşı'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
