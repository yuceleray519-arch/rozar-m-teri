import cron from "node-cron";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, requireAdmin, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { rooms, guestRegistrations, logs, settings, users } from "./src/db/schema.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { eq, desc, and, asc, gte, lt } from "drizzle-orm";

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Helper to log actions
  const logAction = async (userId: number, action: string, details: string) => {
    try {
      await db.insert(logs).values({ userId, action, details });
    } catch (error) {
      console.error("Failed to log action:", error);
    }
  };

  // Helper to send Telegram message
  const sendTelegramNotification = async (message: string) => {
    try {
      const dbSettings = await db.select().from(settings);
      const tokenSetting = dbSettings.find(s => s.key === 'telegram_token');
      const chatIdSetting = dbSettings.find(s => s.key === 'telegram_chat_id');
      
      if (tokenSetting?.value && chatIdSetting?.value) {
        const chatIds = chatIdSetting.value.split(',').filter(Boolean);
        for (const chatId of chatIds) {
          const url = `https://api.telegram.org/bot${tokenSetting.value}/sendMessage`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId.trim(),
              text: message,
            }),
          });
        }
      }
    } catch (error) {
      console.error("Failed to send telegram notification:", error);
    }
  };

  app.get("/api/me", requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  // Rooms API
  app.get("/api/rooms", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allRooms = await db.select().from(rooms)
        .where(eq(rooms.isDeleted, false))
        .orderBy(asc(rooms.floor), asc(rooms.orderIndex), asc(rooms.number));
      res.json(allRooms);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch rooms", cause: error.message });
    }
  });

  app.post("/api/rooms", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { number, floor, capacity, orderIndex } = req.body;
      const result = await db.insert(rooms).values({ number, floor, capacity, orderIndex: orderIndex || 0 }).returning();
      await logAction(req.dbUser.id, "Create Room", `Created room ${number}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create room", cause: error.message });
    }
  });

  app.put("/api/rooms/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { number, floor, capacity, orderIndex } = req.body;
      const result = await db.update(rooms).set({ number, floor, capacity, orderIndex, updatedAt: new Date() }).where(eq(rooms.id, Number(id))).returning();
      await logAction(req.dbUser.id, "Update Room", `Updated room ${number}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update room", cause: error.message });
    }
  });

  app.delete("/api/rooms/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const result = await db.update(rooms).set({ isDeleted: true, updatedAt: new Date() }).where(eq(rooms.id, Number(id))).returning();
      await logAction(req.dbUser.id, "Delete Room", `Deleted room ${result[0].number}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete room", cause: error.message });
    }
  });

  app.put("/api/rooms/:id/status", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (req.dbUser.role !== 'admin' && status !== 'Occupied') {
        const activeGuests = await db.select().from(guestRegistrations).where(
          and(
            eq(guestRegistrations.roomId, Number(id)),
            eq(guestRegistrations.status, 'Active'),
            eq(guestRegistrations.isDeleted, false)
          )
        );
        if (activeGuests.length > 0) {
          return res.status(400).json({ 
            error: "Bu odada aktif konaklayan misafir(ler) var. Personel oda durumunu değiştiremez, önce Misafirler sayfasından çıkış yapmalıdır." 
          });
        }
      }

      const result = await db.update(rooms).set({ status, updatedAt: new Date() }).where(eq(rooms.id, Number(id))).returning();
      await logAction(req.dbUser.id, "Update Room Status", `Room ${result[0].number} status changed to ${status}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update room status", cause: error.message });
    }
  });

  // Guests API
  app.get("/api/guests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allGuests = await db.select().from(guestRegistrations).where(eq(guestRegistrations.isDeleted, false)).orderBy(desc(guestRegistrations.createdAt));
      res.json(allGuests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch guests", cause: error.message });
    }
  });

  app.post("/api/guests", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { roomId, notes, guests, paymentType, paymentAmount, paymentType2, paymentAmount2 } = req.body;
      
      const insertedGuests = [];
      for (let i = 0; i < guests.length; i++) {
        const guest = guests[i];
        const isPrimary = i === 0;
        const result = await db.insert(guestRegistrations).values({
          firstName: guest.firstName,
          lastName: guest.lastName,
          tcId: guest.tcId,
          phone: guest.phone,
          roomId: Number(roomId),
          numGuests: 1,
          notes,
          paymentType: isPrimary ? (paymentType || 'Misafir') : 'Misafir',
          paymentAmount: isPrimary ? (Number(paymentAmount) || 0) : 0,
          paymentType2: isPrimary ? (paymentType2 || null) : null,
          paymentAmount2: isPrimary ? (Number(paymentAmount2) || null) : null,
          checkInPersonnelId: req.dbUser.id
        }).returning();
        insertedGuests.push(result[0]);
      }
      
      await db.update(rooms).set({ status: 'Occupied' }).where(eq(rooms.id, Number(roomId)));
      
      const roomResult = await db.select().from(rooms).where(eq(rooms.id, Number(roomId)));
      const roomNumber = roomResult[0]?.number || roomId;
      
      const primaryGuest = guests[0];
      const finalPaymentType = paymentType || 'Misafir';
      
      let paymentLog = `${Number(paymentAmount) || 0} TL - ${finalPaymentType}`;
      let tgPaymentInfo = `${Number(paymentAmount) || 0} TL (${finalPaymentType})`;
      
      if (paymentType2 && Number(paymentAmount2) > 0) {
        paymentLog += ` / ${Number(paymentAmount2)} TL - ${paymentType2}`;
        tgPaymentInfo += ` + ${Number(paymentAmount2)} TL (${paymentType2})`;
      }

      await logAction(req.dbUser.id, "Guest Check-in", `Checked in ${primaryGuest.firstName} ${primaryGuest.lastName} ${guests.length > 1 ? `and ${guests.length - 1} others` : ''} to room ${roomNumber} (Payment: ${paymentLog})`);
      await sendTelegramNotification(`🛎 Yeni Giriş:\nMisafir: ${primaryGuest.firstName} ${primaryGuest.lastName} ${guests.length > 1 ? `(+${guests.length - 1} kişi)` : ''}\nOda: ${roomNumber}\nKişi Sayısı: ${guests.length}\nÖdeme: ${tgPaymentInfo}\nNot: ${notes || '-'}\nPersonel: ${req.dbUser.email}`);
      
      res.json(insertedGuests);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to register guest", cause: error.message });
    }
  });

  app.post("/api/rooms/:id/transfer", requireAuth, async (req: AuthRequest, res) => {
    try {
      const oldRoomId = Number(req.params.id);
      const { newRoomId } = req.body;

      if (!newRoomId || oldRoomId === Number(newRoomId)) {
        return res.status(400).json({ error: "Geçersiz hedef oda" });
      }

      // Check if there are active guests in old room
      const activeGuests = await db.select().from(guestRegistrations).where(
        and(eq(guestRegistrations.roomId, oldRoomId), eq(guestRegistrations.status, 'Active'))
      );

      if (activeGuests.length === 0) {
        return res.status(400).json({ error: "Bu odada taşınacak aktif misafir yok" });
      }

      const oldRoomResult = await db.select().from(rooms).where(eq(rooms.id, oldRoomId));
      const newRoomResult = await db.select().from(rooms).where(eq(rooms.id, Number(newRoomId)));
      const oldRoomNumber = oldRoomResult[0]?.number || oldRoomId;
      const newRoomNumber = newRoomResult[0]?.number || newRoomId;

      // Move guests to new room
      await db.update(guestRegistrations)
        .set({ roomId: Number(newRoomId), updatedAt: new Date() })
        .where(and(eq(guestRegistrations.roomId, oldRoomId), eq(guestRegistrations.status, 'Active')));

      // Update room statuses
      await db.update(rooms).set({ status: 'Dirty' }).where(eq(rooms.id, oldRoomId));
      await db.update(rooms).set({ status: 'Occupied' }).where(eq(rooms.id, Number(newRoomId)));

      const primaryGuest = activeGuests[0];
      await logAction(req.dbUser.id, "Room Transfer", `Moved ${primaryGuest.firstName} ${primaryGuest.lastName} and others from room ${oldRoomNumber} to ${newRoomNumber}`);
      await sendTelegramNotification(`🔄 Oda Değişimi:\nMisafir: ${primaryGuest.firstName} ${primaryGuest.lastName} ${activeGuests.length > 1 ? `(+${activeGuests.length - 1} kişi)` : ''}\nEski Oda: ${oldRoomNumber}\nYeni Oda: ${newRoomNumber}\nPersonel: ${req.dbUser.email}`);

      res.json({ success: true, movedCount: activeGuests.length });
    } catch (error: any) {
      res.status(500).json({ error: "Oda taşıma işlemi başarısız", cause: error.message });
    }
  });

  app.post("/api/guests/:id/checkout", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { roomStatus } = req.body; // Available or Dirty, passed if no guests remain
      
      const guestResult = await db.update(guestRegistrations).set({ 
        status: 'CheckedOut', 
        checkOutDate: new Date(),
        checkOutPersonnelId: req.dbUser.id,
        updatedAt: new Date()
      }).where(eq(guestRegistrations.id, Number(id))).returning();
      
      const guest = guestResult[0];
      
      const roomResult = await db.select().from(rooms).where(eq(rooms.id, guest.roomId));
      const roomNumber = roomResult[0]?.number || guest.roomId;
      
      // Check if other active guests in this room
      const activeGuests = await db.select().from(guestRegistrations).where(
        and(eq(guestRegistrations.roomId, guest.roomId), eq(guestRegistrations.status, 'Active'))
      );
      
      let finalRoomStatus = 'Occupied';
      if (activeGuests.length === 0) {
        finalRoomStatus = roomStatus || 'Dirty';
        await db.update(rooms).set({ status: finalRoomStatus }).where(eq(rooms.id, guest.roomId));
      }
      
      await logAction(req.dbUser.id, "Guest Check-out", `Checked out ${guest.firstName} ${guest.lastName} from room ${roomNumber}`);
      // Telegram notification for checkouts removed as requested
      
      res.json(guest);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to checkout guest", cause: error.message });
    }
  });

  // Admin Logs
  app.get("/api/logs", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { date } = req.query;
      let query = db.select().from(logs).$dynamic();
      
      if (date && typeof date === 'string') {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query.where(
          and(
            gte(logs.createdAt, startOfDay),
            lt(logs.createdAt, endOfDay)
          )
        );
      }
      
      const allLogs = await query.orderBy(desc(logs.createdAt)).limit(date ? 500 : 100);
      res.json(allLogs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch logs", cause: error.message });
    }
  });

  // Settings
  app.get("/api/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const allSettings = await db.select().from(settings);
      res.json(allSettings);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch settings", cause: error.message });
    }
  });
  
  app.put("/api/settings", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { settings: newSettings } = req.body;
      for (const [key, value] of Object.entries(newSettings)) {
        await db.insert(settings)
          .values({ key, value: String(value) })
          .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: new Date() } });
      }
      await logAction(req.dbUser.id, "Update Settings", "Updated system settings");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update settings", cause: error.message });
    }
  });

  app.post("/api/settings/telegram/verify", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;
      const dbSettings = await db.select().from(settings);
      const tokenSetting = dbSettings.find(s => s.key === 'telegram_token');
      
      if (!tokenSetting?.value) {
        return res.status(400).json({ error: "Telegram bot token bulunamadı." });
      }
      
      // Fetch updates from Telegram API
      const response = await fetch(`https://api.telegram.org/bot${tokenSetting.value}/getUpdates`);
      const data = await response.json();
      
      if (data.ok && data.result) {
        const matchingUpdate = data.result.find((update: any) => 
          update.message?.text?.includes(`/start ${code}`)
        );
        
        if (matchingUpdate) {
          const chatId = String(matchingUpdate.message.chat.id);
          const currentChatIdSetting = dbSettings.find(s => s.key === 'telegram_chat_id')?.value || '';
          const chatIds = currentChatIdSetting.split(',').filter(Boolean);
          
          if (!chatIds.includes(chatId)) {
            chatIds.push(chatId);
            await db.insert(settings)
              .values({ key: 'telegram_chat_id', value: chatIds.join(',') })
              .onConflictDoUpdate({ target: settings.key, set: { value: chatIds.join(','), updatedAt: new Date() } });
          }
            
          await sendTelegramNotification("✅ Rozar Hotel Bildirimleri bu kanala başarıyla bağlandı!");
          return res.json({ success: true, chatId: chatIds.join(',') });
        }
      }
      
      res.status(400).json({ error: "Eşleşen kod bulunamadı. Lütfen bota doğru kodu gönderdiğinizden emin olun." });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to verify telegram", cause: error.message });
    }
  });

  // Users API
  app.get("/api/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(asc(users.id));
      res.json(allUsers);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch users", cause: error.message });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { email, password, role } = req.body;
      const userRecord = await adminAuth.createUser({
        email,
        password,
      });
      
      const result = await db.insert(users).values({
        uid: userRecord.uid,
        email,
        role: role || 'personnel'
      }).returning();
      
      await logAction(req.dbUser.id, "Create User", `Created user ${email}`);
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to create user", cause: error.message });
    }
  });

  app.delete("/api/users/:uid", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const uid = String(req.params.uid);
      await adminAuth.deleteUser(uid);
      await db.delete(users).where(eq(users.uid, uid));
      await logAction(req.dbUser.id, "Delete User", `Deleted user ${uid}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to delete user", cause: error.message });
    }
  });

  app.get("/api/init-accounts", async (req, res) => {
    res.json({ success: true, message: "Use Firebase Console to manage accounts" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  
  
  const sendDailyReport = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayRegs = await db.select({
        id: guestRegistrations.id,
        roomId: guestRegistrations.roomId,
        roomNumber: rooms.number,
        paymentType: guestRegistrations.paymentType,
        paymentAmount: guestRegistrations.paymentAmount,
        paymentType2: guestRegistrations.paymentType2,
        paymentAmount2: guestRegistrations.paymentAmount2,
        checkInDate: guestRegistrations.checkInDate,
        personnelEmail: users.email
      })
      .from(guestRegistrations)
      .leftJoin(rooms, eq(guestRegistrations.roomId, rooms.id))
      .leftJoin(users, eq(guestRegistrations.checkInPersonnelId, users.id))
      .where(
        and(
          gte(guestRegistrations.checkInDate, today),
          lt(guestRegistrations.checkInDate, tomorrow)
        )
      );

      // Group by room to prevent duplicate counting for multi-guest single rooms
      const bookings = [];
      for (const reg of todayRegs) {
        if (!reg.checkInDate) continue;
        const existing = bookings.find(b => 
          b.roomId === reg.roomId &&
          Math.abs(b.checkInDate.getTime() - reg.checkInDate.getTime()) < 60000 // within 1 minute
        );
        if (!existing) {
          bookings.push(reg);
        }
      }

      if (bookings.length === 0) {
        await sendTelegramNotification("📊 Gün Sonu Raporu:\nBugün için herhangi bir oda girişi yapılmamıştır.");
        return;
      }

      let reportMsg = `📊 Gün Sonu Raporu (Bugün verilen oda sayısı: ${bookings.length})\n\n`;
      
      let totalRevenue = 0;
      for (const b of bookings) {
        const timeStr = new Date(b.checkInDate).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
        let paymentInfo = `${b.paymentAmount} ₺ (${b.paymentType})`;
        if (b.paymentType2 && Number(b.paymentAmount2) > 0) {
          paymentInfo += ` + ${b.paymentAmount2} ₺ (${b.paymentType2})`;
        }
        reportMsg += `Oda ${b.roomNumber} - ${paymentInfo}\n`;
        reportMsg += `Saat: ${timeStr} | Personel: ${b.personnelEmail}\n\n`;
        totalRevenue += (Number(b.paymentAmount) || 0) + (Number(b.paymentAmount2) || 0);
      }

      reportMsg += `💰 Toplam Tutar: ${totalRevenue} ₺`;

      await sendTelegramNotification(reportMsg);
      console.log("Daily report sent via Telegram.");
    } catch (error) {
      console.error("Failed to send daily telegram report:", error);
    }
  };

  // Daily Telegram Report (23:59)
  cron.schedule('59 23 * * *', sendDailyReport, {
    timezone: "Europe/Istanbul"
  });
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
