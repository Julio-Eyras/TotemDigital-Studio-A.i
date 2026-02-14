/**
 * Playground: demo do HoloGraph Engine com rede SmartSignage e filtros por dia/horário.
 */
import { createApp, ref, computed, watch } from 'vue'
import HoloGraphView from '../src/vue/HoloGraphView.vue'
import { smartSignageToGraph, createDemoNetwork } from '../src/smartsignage/SmartSignageAdapter'

const DAYS = [
  { value: '', label: 'Todos os dias' },
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' }
]

const HOURS = [{ value: '', label: 'Qualquer horário' }, ...Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, '0')}:00`,
  label: `${i.toString().padStart(2, '0')}:00`
}))]

const network = createDemoNetwork()
const filterDay = ref<string | number>('')
const filterTime = ref<string>('')

const graph = computed(() => {
  const opts: { includeScheduleEdges: boolean; filterDayOfWeek?: number; filterTime?: string } = {
    includeScheduleEdges: true
  }
  if (filterDay.value !== '' && filterDay.value != null) opts.filterDayOfWeek = Number(filterDay.value)
  if (filterTime.value) opts.filterTime = filterTime.value
  return smartSignageToGraph(network, opts)
})

const app = createApp({
  components: { HoloGraphView },
  setup() {
    return { graph, filterDay, filterTime, DAYS, HOURS }
  },
  template: `
    <div id="app">
      <div class="toolbar">
        <h1>HoloGraph Engine – Rede SmartSignage</h1>
        <label class="filter">
          <span>Dia da semana:</span>
          <select v-model="filterDay">
            <option v-for="d in DAYS" :key="d.value === '' ? 'all' : d.value" :value="d.value">
              {{ d.label }}
            </option>
          </select>
        </label>
        <label class="filter">
          <span>Horário:</span>
          <select v-model="filterTime">
            <option v-for="h in HOURS" :key="h.value || 'any'" :value="h.value">{{ h.label }}</option>
          </select>
        </label>
      </div>
      <div class="view">
        <HoloGraphView :graph="graph" @node-click="onNodeClick" />
      </div>
    </div>
  `,
  methods: {
    onNodeClick(node: { id: string; label?: string; type?: string }) {
      console.log('Node clicked:', node)
    }
  }
})
app.mount('#app')
