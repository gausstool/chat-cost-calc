import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import UIComponents from '@gausszhou/ui-vue-components'
import "@gausszhou/ui-vue-theme-chalk"
import VueApexCharts from 'vue3-apexcharts'

createApp(App).use(UIComponents).use(VueApexCharts).mount('#app')
