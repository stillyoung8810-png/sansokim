import { appsInToss } from '@apps-in-toss/framework/plugins';
import { defineConfig } from '@granite-js/react-native/config';

export default defineConfig({
  scheme: 'intoss',
  appName: 'sansokim',
  plugins: [
    appsInToss({
      brand: {
        displayName: '산소킴', // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
        primaryColor: '#4096F4', // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
        icon: 'https://static.toss.im/appsintoss/20887/bfe0b179-fbad-4a62-a3e8-175c6a00df4a.png', // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
      },
      permissions: [],
    }),
  ],
});
