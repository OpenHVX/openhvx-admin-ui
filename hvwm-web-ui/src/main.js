import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from '@/router';
import { useAuth } from '@/stores/auth';

(async () => {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia).use(router);

  // init auth avant d'afficher quoi que ce soit
  await useAuth().init();

  await router.isReady();
  app.mount('#app');

  // appliquer la classe body.login au premier rendu
  const isLogin = router.currentRoute.value.path.startsWith('/login');
  document.body.classList.toggle('login', isLogin);
})();
