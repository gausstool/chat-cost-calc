import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import UIComponents from '@gausszhou/ui-vue-components'
import "@gausszhou/ui-vue-theme-chalk"

createApp(App).use(UIComponents).mount('#app')
