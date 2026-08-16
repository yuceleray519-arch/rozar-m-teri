import fs from "fs";

let content = fs.readFileSync("server.ts", "utf-8");

// 1. Add node-cron import
if (!content.includes("import cron from")) {
    content = content.replace('import express from "express";', 'import express from "express";\nimport cron from "node-cron";');
}

// 2. Add cron logic before app.listen
const cronLogic = `
  // Daily Telegram Report (23:59)
  cron.schedule('59 23 * * *', async () => {
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
        await sendTelegramNotification("📊 Gün Sonu Raporu:\\nBugün için herhangi bir oda girişi yapılmamıştır.");
        return;
      }

      let reportMsg = \`📊 Gün Sonu Raporu (Bugün verilen oda sayısı: \${bookings.length})\\n\\n\`;
      
      let totalRevenue = 0;
      for (const b of bookings) {
        const timeStr = b.checkInDate.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        reportMsg += \`Oda \${b.roomNumber} - \${b.paymentAmount} ₺ (\${b.paymentType})\\n\`;
        reportMsg += \`Saat: \${timeStr} | Personel: \${b.personnelEmail}\\n\\n\`;
        totalRevenue += Number(b.paymentAmount) || 0;
      }

      reportMsg += \`💰 Toplam Tutar: \${totalRevenue} ₺\`;

      await sendTelegramNotification(reportMsg);
      console.log("Daily report sent via Telegram.");
    } catch (error) {
      console.error("Failed to send daily telegram report:", error);
    }
  });

  app.listen(PORT`;

content = content.replace("app.listen(PORT", cronLogic);

fs.writeFileSync("server.ts", content);
