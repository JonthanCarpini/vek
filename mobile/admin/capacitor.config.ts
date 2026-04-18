import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.espetinhodochef.admin',
  appName: 'Mesa Digital Admin',
  webDir: 'www',
  server: {
    url: 'https://espetinhodochef.site/admin',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0b0b0f',
    allowMixedContent: false,
  },
};

export default config;
