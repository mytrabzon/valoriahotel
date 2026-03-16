-- Valoria Hotel - Tam Konaklama Sözleşmesi ve Otel Kuralları (version=2, çoklu dil)
-- Admin panelden düzenlenebilir. Karakter sınırı yok (TEXT). Resim/link/numara HTML ile desteklenir.

INSERT INTO public.contract_templates (lang, version, title, content) VALUES
('tr', 2, 'Konaklama Sözleşmesi ve Otel Kuralları',
'<div style="font-family: sans-serif; color: #1a202c; padding: 8px; line-height: 1.5;">
<h2 style="text-align:center;">VALORİA HOTEL</h2>
<p style="text-align:center;"><strong>KONAKLAMA SÖZLEŞMESİ VE OTEL KURALLARI</strong></p>

<h3>📞 ACİL DURUM İLETİŞİM</h3>
<p><strong>Otel Müdürü – Soner Toprak</strong><br/>
<a href="https://wa.me/905330483061">+90 533 048 30 61</a> (WhatsApp)</p>
<p><strong>Otel Sorumlusu – Emin Kattan</strong><br/>
<a href="https://wa.me/905360736399">+90 536 073 63 99</a> (WhatsApp)</p>
<p><strong>Resepsiyon:</strong> Gece 02:00''ye kadar açık. Acil durumlarda her zaman ulaşabilirsiniz.</p>

<h3>⏰ GİRİŞ - ÇIKIŞ SAATLERİ</h3>
<p>Giriş: 14:00 | Çıkış: 11:00</p>
<p><strong>Uyarı:</strong> Uyarılara rağmen kurallara uyulmazsa 1 günlük konaklama ücreti tahsil edilir.</p>

<h3>💰 ÖDEME VE İPTAL KOŞULLARI</h3>
<p>Rezervasyon anında fatura oluşturulur. Mücbir sebepler dışında iade mümkün değildir.</p>

<h3>📹 GÜVENLİK KAMERALARI</h3>
<p>Otelde 43 güvenlik kamerası ile halka açık alanlar 7/24 izlenmektedir. Özel alanlar (odalar) izlenmez.</p>

<h3>🧯 YANGIN GÜVENLİĞİ</h3>
<p>Her katta 2 yangın söndürme tüpü, 1 ilkyardım kiti. Yangın merdiveni ve acil çıkış kapıları kırmızı ile işaretlidir.</p>

<h3>⛔ YASAKLI MADDELER</h3>
<p>Kesici/delici aletler, patlayıcı ve yanıcı maddeler yasaktır. Tespit durumunda resepsiyona bildirim, güvenlik müdahalesi.</p>

<h3>🚭 ODA İÇİ KURALLAR</h3>
<p>Sigara (oda, balkon, banyo) kesinlikle yasaktır; tespitte cezai işlem uygulanır. Düklü tencere, ocak, tüp, elektrikli ısıtıcı yasaktır; yangın riski nedeniyle derhal tahliye.</p>

<h3>🔕 SES VE GÜRÜLTÜ</h3>
<p>23:00 – 09:00 sessizlik zamanı. İhlalde: sözlü → yazılı uyarı → otel ile ilişik kesilir.</p>

<h3>👪 ÇOCUK GÜVENLİĞİ</h3>
<p>Çocukların kontrolü tamamen velilere aittir. Koridor, havuz, merdiven, pencere güvenliği veli sorumluluğundadır.</p>

<h3>🤝 PERSONELE DAVRANIŞ</h3>
<p>Saygısızlık, hakaret, tehdit, fiziksel müdahale yasaktır; güvenlik ve kolluk kuvvetlerine bildirim, kalıcı uzaklaştırma.</p>

<h3>🅿️ OTOPARK</h3>
<p>Küçük otopark mevcuttur. Otoparkta oluşan hasarlardan otel sorumlu değildir.</p>

<h3>📋 DİĞER KURALLAR</h3>
<p>Havluları odadan dışarı çıkarmayın. Odadan çıkarken kapıyı kilitleyin. Anahtarı check-out''ta resepsiyona teslim edin.</p>

<h3>✅ ONAY BEYANI</h3>
<p>Kuralları okuduğumu, anladığımı ve kabul ettiğimi, yaptırımları kabul ettiğimi, kişisel verilerimin işlenmesine izin verdiğimi beyan ederim.</p>
<p style="margin-top:24px; text-align:center;"><strong>Valoria Hotel Ailesi – İyi tatiller dileriz.</strong></p>
</div>')
ON CONFLICT (lang, version) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, updated_at = now();

-- Placeholder for other languages (admin can edit later)
INSERT INTO public.contract_templates (lang, version, title, content) VALUES
('en', 2, 'Accommodation Agreement and Hotel Rules', '<div style="font-family: sans-serif;"><p>Full contract content – edit from Admin panel. Contact: <a href="https://wa.me/905330483061">+90 533 048 30 61</a>, <a href="https://wa.me/905360736399">+90 536 073 63 99</a>.</p></div>'),
('ar', 2, 'اتفاقية الإقامة وقواعد الفندق', '<div style="font-family: sans-serif; direction: rtl;"><p>المحتوى الكامل – يرجى التحرير من لوحة الإدارة.</p></div>'),
('de', 2, 'Unterkunftsvertrag und Hotelregeln', '<div style="font-family: sans-serif;"><p>Vollständiger Vertrag – im Admin-Bereich bearbeiten.</p></div>'),
('fr', 2, 'Contrat d''hébergement et règles de l''hôtel', '<div style="font-family: sans-serif;"><p>Contenu complet – modifier depuis l''administration.</p></div>'),
('ru', 2, 'Договор размещения и правила отеля', '<div style="font-family: sans-serif;"><p>Полный текст – редактировать в панели администратора.</p></div>'),
('es', 2, 'Contrato de alojamiento y normas del hotel', '<div style="font-family: sans-serif;"><p>Contenido completo – editar desde el panel de administración.</p></div>')
ON CONFLICT (lang, version) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, updated_at = now();
