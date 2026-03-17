-- Valoria Hotel – Otel Kuralları metni (şimdilik bu içerik; Admin panelden her zaman düzenlenebilir)
-- Sözleşmeler → Kurallar sözleşmesi (7 dil) – Düzenle ekranından istediğiniz zaman değiştirebilirsiniz.

UPDATE public.contract_templates
SET
  title = 'Otel Kuralları',
  content = '<div style="font-family: sans-serif; color: #1a202c; padding: 12px; line-height: 1.6; max-width: 720px; margin: 0 auto;">
<h2 style="text-align:center;">VALORİA HOTEL</h2>
<p style="text-align:center;"><strong>OTEL KURALLARI</strong></p>
<p style="text-align:center;">Misafirlerimizin dikkatine</p>

<h3>1. GİRİŞ VE ÇIKIŞ SAATLERİ</h3>
<p>✓ Giriş saati: 14:00</p>
<p>✓ Çıkış saati: 11:00</p>
<ul>
<li>Erken giriş talepleri, odanın müsaitlik durumuna göre değerlendirilir.</li>
<li>Geç çıkış durumunda 1 günlük konaklama ücreti uygulanır.</li>
<li>Saatlere riayet edilmesi önemle rica olunur.</li>
</ul>

<h3>2. SİGARA VE YANGIN GÜVENLİĞİ</h3>
<p>❌ ODALARDA SİGARA İÇMEK KESİNLİKLE YASAKTIR.</p>
<ul>
<li>Sigara içildiği tespit edildiğinde ciddi cezai işlem uygulanır.</li>
<li>Yangın alarmına müdahale etmek yasaktır.</li>
<li>Yangın merdivenleri ve çıkışlar her zaman açık tutulmalıdır.</li>
<li>Yangın söndürme tüplerinin yerleri odanızda belirtilmiştir.</li>
</ul>

<h3>3. ODA İÇİ KURALLAR</h3>
<p>❌ Düklü tencere, ocak, tüp, elektrikli ısıtıcı vb. cihazlar kullanmak yasaktır.</p>
<p>❌ Kesici, delici, patlayıcı ve yanıcı maddeler (bıçak, çakmak gazı, benzin, tiner vb.) odaya sokmak yasaktır.</p>
<p>❌ Havluları odadan dışarı çıkarmak yasaktır.</p>
<p>✓ Odadan çıkarken kapıyı mutlaka kilitleyiniz.</p>
<p>✓ Değerli eşyalarınızı odada bırakmayınız, kasa kullanınız.</p>

<h3>4. SES VE GÜRÜLTÜ KURALLARI</h3>
<p>🔕 SESSİZLİK SAATLERİ: 23:00 - 09:00</p>
<ul>
<li>Yüksek sesle müzik dinlemek yasaktır.</li>
<li>Koridorda bağırmak, koşmak ve kapıları çarpmak yasaktır.</li>
<li>Diğer misafirlerin huzurunu bozacak davranışlardan kaçınınız.</li>
</ul>
<p>İhlal durumunda: 1. İhlal: Sözlü uyarı · 2. İhlal: Yazılı uyarı · 3. İhlal: Otelden çıkarılma (ücret iadesiz)</p>

<h3>5. ÇOCUK GÜVENLİĞİ</h3>
<p>👪 Çocukların kontrolü ve güvenliği tamamen ANNE-BABA''ya aittir.</p>
<ul>
<li>Çocukları odada yalnız bırakmayınız.</li>
<li>Çocukların balkon ve pencerelere çıkmasına izin vermeyiniz.</li>
<li>Otel personeli çocuklardan sorumlu değildir.</li>
</ul>

<h3>6. ORTAK ALANLAR</h3>
<p>🏋️ Spor salonu: 07:00 - 23:00 arası açıktır. Ekipmanlar kullanıldıktan sonra yerine bırakılır.</p>
<p>🍽️ Restoran: Kahvaltı 07:00 - 10:00, Akşam yemeği 19:00 - 22:00</p>

<h3>7. PERSONELE KARŞI DAVRANIŞ</h3>
<p>🤝 Otel personeli, misafirlerin konforu için çalışmaktadır.</p>
<p>❌ Aşağıdaki davranışlar KESİNLİKLE YASAKTIR: Saygısızlık ve hakaret, ırkçı söylemler, tehdit ve fiziksel müdahale, taciz ve rahatsız edici davranışlar.</p>
<p>⚠️ İhlal durumunda: Güvenlik çağrılır, tutanak tutulur, kolluk kuvvetlerine bilgi verilir, otelden kalıcı olarak uzaklaştırılma.</p>

<h3>8. OTOPARK KULLANIMI</h3>
<p>🅿️ Otelimizin küçük bir otoparkı mevcuttur.</p>
<ul>
<li>Araçlarınızı park yerine bırakınız. Değerli eşyaları araçta bırakmayınız.</li>
<li>Otoparkta hızlı araç kullanmayınız.</li>
<li>Otoparkta oluşabilecek hasarlardan otel sorumlu değildir.</li>
<li>Yer darlığı durumunda resepsiyona danışınız.</li>
</ul>

<h3>9. ZİYARETÇİLER</h3>
<ul>
<li>Oda dışından ziyaretçi kabul edilebilmesi için resepsiyona bilgi verilmesi gerekmektedir.</li>
<li>Ziyaretçiler 23:00''e kadar odada kalabilir.</li>
<li>Ziyaretçilerin otel kurallarına uyması zorunludur.</li>
<li>Ziyaretçi kabulünde oda sahibi tüm sorumluluğu üstlenir.</li>
</ul>

<h3>10. KAYIP EŞYALAR</h3>
<p>🔍 Odada unutulan eşyalar için resepsiyona başvurunuz. 30 gün içinde alınmayan eşyalar bağışlanır. Değerli eşyalar özel olarak saklanır ve iletişime geçilir.</p>

<h3>11. EVCİL HAYVANLAR</h3>
<p>🐾 Evcil hayvan kabulü yapılmamaktadır. (Rehber köpekler hariç)</p>

<h3>12. ŞİKAYET VE TALEPLER</h3>
<p>📞 Resepsiyon (dahili), Otel Müdürü: <a href="https://wa.me/905330483061">+90 533 048 30 61</a> (WhatsApp), E-posta: info@valoriahotel.com</p>
<p>Şikayetleriniz en kısa sürede değerlendirilecektir.</p>

<h3>13. KURAL İHLALLERİ VE YAPTIRIMLAR</h3>
<p>⚠️ 1. İhlal → Sözlü uyarı · 2. İhlal → Yazılı uyarı · 3. İhlal → Otelden çıkarılma (ücret iadesiz). Ağır ihlallerde (kavga, hırsızlık, yangın riski, personele saldırı) doğrudan kolluk kuvvetlerine bilgi verilir ve otel ile ilişik kesilir.</p>

<h3>14. KABUL BEYANI</h3>
<p>Otelimize giriş yaparak, yukarıdaki tüm kuralları okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz. Kurallara uymamanız durumunda yaptırımlar uygulanacaktır.</p>
<p>Teşekkür eder, keyifli bir konaklama dileriz.</p>
<p style="text-align:center; margin-top: 24px;"><strong>VALORİA HOTEL AİLESİ</strong><br/>Misafirlerimizi ağırlamaktan mutluluk duyarız.</p>
</div>',
  updated_at = now()
WHERE lang = 'tr' AND version = 2;
