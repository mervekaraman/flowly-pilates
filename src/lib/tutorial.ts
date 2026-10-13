import type { FlowlyIconName } from "@/components/flowly/icons";
import { studio } from "@/lib/studio";

// Step-by-step guide shown once right after sign-up and kept at /rehber (Profil › Nasıl kullanılır?).
export type TutorialStep = { icon: FlowlyIconName; where?: string; title: string; text: string; tips?: string[] };

const memberSteps: TutorialStep[] = [
  {
    icon: "calendar", where: "Program",
    title: "Sana uyan saati bul",
    text: "Program sekmesinde üstteki günlerden birini seç. O günün dersleri saat, seviye, eğitmen ve kalan yer sayısıyla listelenir.",
    tips: ["Dersler küçük gruplarla, en fazla birkaç kişiyle yapılır.", "“Dolu” yazan derslerde bekleme listesine katılabilirsin."],
  },
  {
    icon: "bookmark", where: "Ders sayfası",
    title: "Yerini ayır",
    text: "Derse dokun ve “Rezervasyon Talebi Gönder”e bas. Talebin, eğitmen karar verene kadar senin için bir yer tutar.",
    tips: ["Eğitmenine not bırakabilirsin; ör. bir sakatlığın ya da ilk dersin olduğu.", "İstersen derste çalmasını istediğin Spotify listesinin linkini ekle."],
  },
  {
    icon: "check", where: "E-posta ve bildirim",
    title: "Onayı bekle",
    text: "Eğitmen talebini onayladığında e-posta ve bildirim gelir; rezervasyonun kesinleşir.",
    tips: ["Onaydan sonra dersi tek dokunuşla telefonunun takvimine ekleyebilirsin.", "Stüdyoya WhatsApp'tan yazmak için rezervasyon sayfasındaki butonu kullan.", "Dersten bir gün önce hatırlatma gönderiyoruz."],
  },
  {
    icon: "repeat", where: "Rezervasyonlarım",
    title: "Planın değişirse",
    text: `Rezervasyonlarım sayfasından dersini başka bir saate taşıyabilir ya da iptal edebilirsin. Onaylı derslerde bu, derse ${studio.cancellationHours} saat kalana kadar mümkün.`,
    tips: ["Son saatlerde gelemeyeceksen stüdyoya doğrudan haber ver; yerin başka birine açılabilir."],
  },
  {
    icon: "bell", where: "Profil › Ayarlar",
    title: "Bildirimleri aç",
    text: "Ayarlar'daki “Telefon bildirimleri”ni açarsan onay, iptal ve hatırlatmalar anında telefonuna gelir.",
    tips: ["iPhone'da önce Safari'de Paylaş › “Ana Ekrana Ekle” ile siteyi uygulama gibi ekle, sonra oradan aç."],
  },
  {
    icon: "star", where: "Ders sonrası",
    title: "Dersini değerlendir",
    text: "Katıldığın dersten sonra eforunu 1–10 arasında puanlayabilir ve yorum bırakabilirsin. Eğitmenin derslerini buna göre ayarlar.",
  },
];

const trainerSteps: TutorialStep[] = [
  {
    icon: "home", where: "Özet",
    title: "Günün tek bakışta",
    text: "Eğitmen panelinde bugünkü derslerini, bu haftanın doluluğunu ve onay bekleyen talepleri görürsün.",
  },
  {
    icon: "plus", where: "Yeni Ders",
    title: "Ders saati aç",
    text: "“Yeni Ders Saati”nden gün ve başlangıç saatini seç. Dersler saat başında başlar, varsayılan kontenjan 4 kişidir.",
    tips: ["“Her hafta tekrarla” ile aynı dersi birkaç hafta için tek seferde açabilirsin.", "Dolu ya da geçmiş saatler listede kapalı görünür; aynı saate iki ders açılamaz."],
  },
  {
    icon: "document", where: "Talepler",
    title: "Talepleri yanıtla",
    text: "Üyeler ders seçtiğinde talep olarak sana düşer. Onayla ya da reddet; üyeye not ekleyebilirsin, karar e-postayla iletilir.",
    tips: ["Üyenin notunu ve önerdiği çalma listesini talep sayfasında görürsün."],
  },
  {
    icon: "users", where: "Takvim › Ders",
    title: "Ders listeni yönet",
    text: "Takvimden bir derse dokununca katılımcıları görürsün. Buradan üye ekleyebilir, dersi düzenleyebilir ya da iptal edebilirsin.",
    tips: ["“Hatırlat” ile üyeye WhatsApp'tan hazır bir mesaj gönderebilirsin.", "Ders iptal edilirse kayıtlı üyelere otomatik haber verilir."],
  },
  {
    icon: "check", where: "Ders sonrası",
    title: "Yoklamayı işaretle",
    text: "Ders bittikten sonra her üye için “Geldi” ya da “Gelmedi”yi seç. Gelen üyeler eforlarını puanlayabilir; ortalamaları Üyeler sayfasında görünür.",
  },
  {
    icon: "bell", where: "Profil › Ayarlar",
    title: "Talepleri kaçırma",
    text: "Ayarlar'dan telefon bildirimlerini aç; yeni talep ve iptaller anında telefonuna gelsin.",
    tips: ["iPhone'da siteyi Safari'den “Ana Ekrana Ekle” ile ekleyip oradan açman gerekir."],
  },
];

export const tutorialSteps = (role: "member" | "trainer") => role === "trainer" ? trainerSteps : memberSteps;
