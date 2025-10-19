import { defineModule } from '@directus/extensions-sdk';
import ModuleComponent from './module.vue';

export default defineModule({
  id: 'realtime-recalc-dashboard',
  name: 'Recalc Formules',
  icon: 'auto_graph',
  routes: [
    {
      path: '',
      component: ModuleComponent,
    },
  ],
});
