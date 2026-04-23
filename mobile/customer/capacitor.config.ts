import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.espetinhodochef.customer',
  appName: 'Espetinho do Chef',
  webDir: 'www',
  server: {
    url: 'https://espetinhodochef.site/',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0b0b0f',
    allowMixedContent: false,
  },
};

export default config;
