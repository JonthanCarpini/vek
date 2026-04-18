import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.espetinhodochef.waiter',
  appName: 'Mesa Digital Garçom',
  webDir: 'www',
  server: {
    url: 'https://espetinhodochef.site/waiter',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0b0b0f',
    allowMixedContent: false,
  },
};

export default config;
