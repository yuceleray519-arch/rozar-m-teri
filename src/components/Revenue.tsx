import { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Banknote, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import type { GuestRegistration, Room } from '../types';

interface RevenueProps {
  firebaseUser: any;
}

interface Booking {
  id: number;
  roomId: number;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date | null;
  paymentAmount: number;
  paymentType: string;
  paymentAmount2?: number | null;
  paymentType2?: string | null;
  guestsCount: number;
  primaryGuestName: string;
}

interface DayData {
  dateStr: string;
  dateObj: Date;
  totalRevenue: number;
  roomCount: number;
  bookings: Booking[];
}

export default function Revenue({ firebaseUser }: RevenueProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<GuestRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  useEffect(() => {
    fetchData();
  }, [firebaseUser]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [rRes, gRes] = await Promise.all([
        fetch('/api/rooms', { headers }),
        fetch('/api/guests', { headers })
      ]);
      
      if (rRes.ok) setRooms(await rRes.json().catch(() => ({})));
      if (gRes.ok) setGuests(await gRes.json().catch(() => ({})));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // Process data
  const dayData = useMemo(() => {
    if (!guests.length || !rooms.length) return [];

    const daysMap = new Map<string, Booking[]>();

    // First group all guests by day
    const sortedGuests = [...guests].sort((a, b) => {
      const timeDiff = new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id - b.id;
    });

    sortedGuests.forEach(guest => {
      const date = new Date(guest.checkInDate);
      
      // Filter by selected month and year
      if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return;

      const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      if (!daysMap.has(dateStr)) {
        daysMap.set(dateStr, []);
      }
      
      const dayBookings = daysMap.get(dateStr)!;
      
      // Check if this booking is already recorded (same stay overlap)
      const existing = dayBookings.find(b => {
        if (b.roomId !== guest.roomId) return false;
        
        const gCheckIn = date.getTime();
        const bCheckIn = b.checkInDate.getTime();
        const gCheckOut = guest.checkOutDate ? new Date(guest.checkOutDate).getTime() : Infinity;
        const bCheckOut = b.checkOutDate ? b.checkOutDate.getTime() : Infinity;
        
        // Overlap condition: max(start1, start2) <= min(end1, end2)
        // We add a small buffer (e.g. 1 hour) just in case check-out and check-in are very close but they were supposed to be together
        // Actually strict overlap is fine
        return Math.max(gCheckIn, bCheckIn) <= Math.min(gCheckOut, bCheckOut);
      });

      if (existing) {
        existing.guestsCount += 1;
        
        // Legacy fix: If check-in time is within 10 seconds, it's part of the same batch insert.
        // Legacy code duplicated the payment amount for all guests in a batch. 
        // New code sets secondary guests' payment to 0.
        // In both cases, we shouldn't sum them up for the same batch to avoid 24000 instead of 6000.
        // Only sum if it's a separately added guest (time diff > 10s).
        if (Math.abs(date.getTime() - existing.checkInDate.getTime()) > 10000) {
          existing.paymentAmount += (Number(guest.paymentAmount) || 0);
          existing.paymentAmount2 = (existing.paymentAmount2 || 0) + (Number(guest.paymentAmount2) || 0);
        }
        
        // Update checkOutDate to the maximum of both
        if (existing.checkOutDate && guest.checkOutDate) {
           existing.checkOutDate = new Date(Math.max(existing.checkOutDate.getTime(), new Date(guest.checkOutDate).getTime()));
        } else {
           existing.checkOutDate = null;
        }
      } else {
        const room = rooms.find(r => r.id === guest.roomId);
        dayBookings.push({
          id: guest.id,
          roomId: guest.roomId,
          roomNumber: room ? room.number : '?',
          checkInDate: date,
          checkOutDate: guest.checkOutDate ? new Date(guest.checkOutDate) : null,
          paymentAmount: Number(guest.paymentAmount) || 0,
          paymentType: (guest.paymentType === 'Misafir' || (!guest.paymentType && Number(guest.paymentAmount) === 0)) ? 'Misafir' : (guest.paymentType || 'Nakit'),
          paymentAmount2: Number(guest.paymentAmount2) || 0,
          paymentType2: guest.paymentType2 || null,
          guestsCount: 1,
          primaryGuestName: `${guest.firstName} ${guest.lastName}`
        });
      }
    });

    const result: DayData[] = [];
    
    daysMap.forEach((bookings, dateStr) => {
      let totalRevenue = 0;
      bookings.forEach(b => { 
        totalRevenue += (b.paymentAmount || 0) + (b.paymentAmount2 || 0); 
      });
      
      // Sort bookings by time descending
      bookings.sort((a, b) => b.checkInDate.getTime() - a.checkInDate.getTime());
      
      // Date object for sorting days
      const [day, month, year] = dateStr.split('.');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      
      result.push({
        dateStr,
        dateObj,
        totalRevenue,
        roomCount: bookings.length,
        bookings
      });
    });

    // Sort days by date descending
    return result.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  }, [guests, rooms, selectedMonth, selectedYear]);

  const totalMonthlyRevenue = useMemo(() => {
    return dayData.reduce((sum, day) => sum + day.totalRevenue, 0);
  }, [dayData]);

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  // Generate a list of years (e.g., from 2024 to current year + 1)
  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:justify-between md:items-start mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Banknote className="text-green-500" size={32} />
            Ciro ve Raporlar
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Günlük alınan oda sayısı ve ciro takibi.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 shadow-lg mb-8 text-white flex items-center justify-between">
        <div>
          <p className="text-green-100 font-medium mb-1">Seçili Ayın Toplam Cirosu</p>
          <h3 className="text-4xl font-bold">{totalMonthlyRevenue.toLocaleString('tr-TR')} ₺</h3>
        </div>
        <div className="bg-white/20 p-4 rounded-xl">
          <Banknote size={48} className="text-white" />
        </div>
      </div>

      {dayData.length === 0 ? (
        <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">Bu ay için henüz kayıtlı bir konaklama bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dayData.map((day) => (
            <div key={day.dateStr} className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden transition-all">
              <button 
                onClick={() => toggleDay(day.dateStr)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl text-blue-600 dark:text-blue-400">
                    <Calendar size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{day.dateStr}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{day.roomCount} Oda Verildi</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Günlük Ciro</p>
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">{day.totalRevenue} ₺</p>
                  </div>
                  <div className="text-gray-400">
                    {expandedDays[day.dateStr] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </button>
              
              {expandedDays[day.dateStr] && (
                <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-zinc-700">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-zinc-700">
                          <th className="py-3 font-medium">Saat</th>
                          <th className="py-3 font-medium">Oda</th>
                          <th className="py-3 font-medium">Misafir (Asıl)</th>
                          <th className="py-3 font-medium">Kişi</th>
                          <th className="py-3 font-medium text-right">Tutar</th>
                          <th className="py-3 font-medium text-right">Ödeme Tipi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-zinc-700/50">
                        {day.bookings.map(booking => (
                          <tr key={booking.id} className="text-sm text-gray-700 dark:text-gray-300">
                            <td className="py-3">{booking.checkInDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                            <td className="py-3 font-medium"><span className="bg-gray-100 dark:bg-zinc-700 px-2 py-1 rounded">{booking.roomNumber}</span></td>
                            <td className="py-3">{booking.primaryGuestName}</td>
                            <td className="py-3">{booking.guestsCount}</td>
                            <td className="py-3 font-bold text-right whitespace-pre-line">
                              {booking.paymentType === 'Misafir' ? 'Misafir' : `${booking.paymentAmount} ₺${booking.paymentType2 ? `\n${booking.paymentAmount2} ₺` : ''}`}
                            </td>
                            <td className="py-3 text-right text-xs whitespace-pre-line">
                              {booking.paymentType !== 'Misafir' && (
                                <div className="flex flex-col gap-1 items-end">
                                  <span className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 px-2 py-1 rounded inline-block">
                                    {booking.paymentType}
                                  </span>
                                  {booking.paymentType2 && (
                                    <span className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 px-2 py-1 rounded inline-block mt-1">
                                      {booking.paymentType2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
