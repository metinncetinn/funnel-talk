// ÖNEMLİ: .exe'yi derlemeden önce bu adresi Raspberry Pi'deki token sunucunun
// Tailscale Funnel adresiyle değiştir.
// Örnek: https://pi-adin.tail1234.ts.net
window.APP_CONFIG = {
  TOKEN_SERVER_URL: 'https://metpi.tail5d616d.ts.net',

  // type: 'voice'  -> mikrofon/ekran paylaşımı olan normal kanal
  // type: 'text'   -> sadece yazışma, mikrofon/ekran paylaşımı gizli
  CHANNELS: [
    { name: 'Genel', type: 'voice' },
    { name: 'Oyun', type: 'voice' },
    { name: 'Oyun 2', type: 'voice' },
    { name: 'Sohbet', type: 'text' }
  ]
};
