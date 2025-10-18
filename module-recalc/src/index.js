import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';

export default defineModule({
  id: 'realtime-recalc-dashboard',
  name: 'Formula Engine',
  icon: 'calculate',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
});
