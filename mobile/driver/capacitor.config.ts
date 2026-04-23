import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'site.espetinhodochef.driver',
  appName: 'Mesa Digital Motoboy',
  webDir: 'www',
  server: {
    url: 'https://espetinhodochef.site/driver',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0b0b0f',
    allowMixedContent: false,
  },
};

export default config;
