# Rozar Hotel Yönetim Sistemi Tasarımı

## 1. Sistem Mimarisi (System Architecture)
- **Frontend**: React (Vite tabanlı), Tailwind CSS (stiller ve dark mode), Framer Motion (animasyonlar), Lucide React (ikonlar). Single Page Application (SPA) yapısı ile akıcı kullanıcı deneyimi hedeflenmiştir.
- **Backend**: Node.js ve Express.js. Drizzle ORM kullanılarak veritabanı iletişimi sağlanmaktadır.
- **Veritabanı**: Cloud SQL (PostgreSQL). Tamamen ilişkisel, hızlı ve güvenli.
- **Kimlik Doğrulama (Auth)**: Firebase Authentication (Email/Password). Sunucu tarafında `firebase-admin` ile JWT doğrulaması yapılır.

## 2. Veritabanı Şeması (Database Schema)
- `users`: Sistem kullanıcıları (personnel veya admin). Firebase UID, Email ve rol (role) içerir.
- `rooms`: Oda bilgileri (Oda numarası, kat, kapasite, durum).
- `guest_registrations`: Misafir kayıtları (Ad, Soyad, TC, Telefon, Oda ilişkisi, kişi sayısı, giriş/çıkış tarihleri, giriş/çıkış yapan personeller).
- `logs`: Sistemde yapılan tüm kritik işlemlerin (Oda ekleme, misafir girişi, ayar güncelleme) tutulduğu log tablosu.
- `settings`: Telegram API entegrasyonu için bot token ve chat id bilgilerinin tutulduğu key/value tablosu.

*(Tüm tablolarda güvenlik amaçlı Soft-Delete yapısı desteklenmiştir)*

## 3. Klasör Yapısı (Folder Structure)
- `/server.ts` : Backend API sunucusu ve Vite middleware'i
- `/src/components/` : React ekranları (Dashboard, Rooms, Guests, Logs, Settings)
- `/src/db/` : Drizzle ORM şemaları ve veritabanı bağlantısı
- `/src/lib/` : Firebase client ve admin ayarları
- `/src/middleware/` : Backend yetkilendirme kontrolleri (requireAuth, requireAdmin)

## 4. API Tasarımı (API Design)
- `GET /api/me` : Aktif kullanıcı bilgilerini ve rolünü getirir.
- `GET /api/rooms`, `POST /api/rooms`, `PUT /api/rooms/:id/status` : Odaları listeler, yeni oda oluşturur (sadece Admin), oda durumunu günceller.
- `GET /api/guests`, `POST /api/guests`, `POST /api/guests/:id/checkout` : Misafir kayıtlarını yönetir. Çıkış yaparken odanın son durumunu belirler.
- `GET /api/logs` : Admin işlemleri logları listesi.
- `GET /api/settings`, `PUT /api/settings` : Telegram ayarlarını yönetir.

## 5. Kullanıcı Akışı (User Flow)
1. **Giriş (Login)**: Personel veya Admin Firebase Auth aracılığı ile sisteme giriş yapar.
2. **Dashboard**: Anlık durum paneli ile uygun/dolu/kirli oda sayıları ve yeni misafirler görüntülenir.
3. **Yeni Kayıt (Check-in)**: Personel misafirleri odaya yerleştirir. Otomatik olarak oda 'Dolu' (Occupied) durumuna geçer, log tutulur ve (ayarlıysa) Telegram'a bildirim gider.
4. **Çıkış İşlemi (Check-out)**: Misafir çıkışı onaylandığında, oda boşalıyorsa personel 'Uygun' (Available) veya 'Kirli' (Dirty) seçeneğini belirtir. Log ve Telegram bildirimi tetiklenir.

## 6. Güvenlik Planı (Security Plan)
- **SQL Injection**: Drizzle ORM kullanılarak tüm sorgular parametrize edilmiştir.
- **XSS & CSRF**: React ile veri güvenli olarak parse edilir ve API istekleri sadece Authorization header'ı ile (Firebase JWT) kabul edilir.
- **Yetkilendirme (RBAC)**: Backend seviyesinde özel `requireAdmin` middleware'i ile Logs ve Settings sayfalarına / API'lerine standart personel erişimi engellenmiştir.

## 7. Geliştirme Yol Haritası (Development Roadmap)
1. Firebase Auth kurulumu ve DB ilişkilendirilmesi.
2. Cloud SQL PostgreSQL instance ayağa kaldırılması ve schema.ts yapısının DB'ye itilmesi.
3. Backend (Express) REST Endpoint'lerinin `server.ts` içerisine yazılması.
4. React tarafında Component bazlı SPA ve Tailwind yapısının oluşturulması.
5. Telegram bot entegrasyonu (Fetch tabanlı bildirim).
6. Dark/Light Tema desteğinin eklenmesi.
