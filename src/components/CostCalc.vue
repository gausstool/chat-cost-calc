<script setup lang="ts">
import { ref, computed } from "vue";

const sessions = ref(10);
const interactions = ref(20);
const inputTokens = ref(100);
const outputTokens = ref(2000);

const cacheEnabled = ref(true);
const peakEnabled = ref(false);
const cacheHitPrice = ref(0.05);
const cacheMissPrice = ref(1.5);
const outputPrice = ref(4.5);

const totalInteractions = computed(() => sessions.value * interactions.value);

const totalOutputTokens = computed(
  () => totalInteractions.value * outputTokens.value,
);

// 平均会话上下文长度：单次会话内逐次累积的上下文（输入侧）总长度，
// 与命中缓存公式一致（= cacheHitInputTokens / sessions）
const avgContextPerSession = computed(() => {
  const n = interactions.value;
  return (
    (inputTokens.value * n * (n + 1)) / 2 +
    (outputTokens.value * (n - 1) * n) / 2
  );
});

const cacheHitInputTokens = computed(() => {
  const n = interactions.value;
  return (
    sessions.value *
    ((inputTokens.value * n * (n + 1)) / 2 +
      (outputTokens.value * (n - 1) * n) / 2)
  );
});

const cacheMissInputTokens = computed(
  () => totalInteractions.value * inputTokens.value,
);

const totalInputTokens = computed(
  () => cacheHitInputTokens.value + cacheMissInputTokens.value,
);

const effectiveCacheHitInputTokens = computed(() =>
  cacheEnabled.value ? cacheHitInputTokens.value : 0,
);

const effectiveCacheMissInputTokens = computed(() =>
  cacheEnabled.value ? cacheMissInputTokens.value : totalInputTokens.value,
);

const cacheHitPrecent = computed(() => {
  return ((100 * effectiveCacheHitInputTokens.value ) / (effectiveCacheHitInputTokens.value +  effectiveCacheMissInputTokens.value) ).toFixed(2)
})

// 高峰时段价格：高峰期花费为空闲期双倍（×2）
const peakMultiplier = computed(() => (peakEnabled.value ? 2 : 1));
const effectiveCacheHitPrice = computed(
  () => cacheHitPrice.value * peakMultiplier.value,
);
const effectiveCacheMissPrice = computed(
  () => cacheMissPrice.value * peakMultiplier.value,
);
const effectiveOutputPrice = computed(
  () => outputPrice.value * peakMultiplier.value,
);

const costCacheMiss = computed(
  () =>
    (effectiveCacheMissInputTokens.value / 1_000_000) *
    effectiveCacheMissPrice.value,
);

const costCacheHit = computed(
  () =>
    (effectiveCacheHitInputTokens.value / 1_000_000) *
    effectiveCacheHitPrice.value,
);



const costOutput = computed(
  () => (totalOutputTokens.value / 1_000_000) * effectiveOutputPrice.value,
);
const totalCost = computed(
  () => costCacheMiss.value + costCacheHit.value + costOutput.value,
);

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

function formatMoney(n: number): string {
  return `￥${n.toFixed(3)}`;
}
</script>

<template>
  <div class="calc">
    <h1>对话费用估算</h1>
    <div class="columns">
      <GRow>
        <GCol :span="4" :xs="12">
          <div class="column">
            <h2>价格(每百万 Token)</h2>
            <div class="form">
              <label class="toggle-row">
                <span>支持缓存</span>
                <label class="switch">
                  <input type="checkbox" v-model="cacheEnabled" />
                  <span class="slider"></span>
                </label>
              </label>
              <label class="toggle-row">
                <span>高峰时段（价格 ×2）</span>
                <label class="switch">
                  <input type="checkbox" v-model="peakEnabled" />
                  <span class="slider"></span>
                </label>
              </label>
              <label :class="{ disabled: !cacheEnabled }">
                <span>输入（命中缓存）</span>
                <input
                  v-model.number="cacheHitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  :disabled="!cacheEnabled"
                />
              </label>
              <label>
                <span>输入（未命中缓存）</span>
                <input
                  v-model.number="cacheMissPrice"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
              <label>
                <span>输出</span>
                <input
                  v-model.number="outputPrice"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </label>
            </div>
          </div>
        </GCol>
        <GCol :span="4" :xs="12">
          <div class="column">
            <h2>交互习惯</h2>
            <div class="form">
              <label>
                <span>每天会话次数</span>
                <input v-model.number="sessions" type="number" min="1" />
              </label>
              <label>
                <span>每次会话交互次数</span>
                <input v-model.number="interactions" type="number" min="1" />
              </label>
              <label>
                <span>每次交互输入 Token</span>
                <input v-model.number="inputTokens" type="number" min="1" />
              </label>
              <label>
                <span>每次交互输出 Token</span>
                <input v-model.number="outputTokens" type="number" min="1" />
              </label>
              <div class="result-row">
                <span>平均会话上下文长度</span>
                <span class="value">{{ formatNum(avgContextPerSession) }}</span>
              </div>
            </div>
          </div>
        </GCol>
        <GCol :span="4" :xs="12">
          <div class="column">
            <h2>预估消耗</h2>
            <div class="results">
              <div class="card highlight" :class="{ dimmed: !cacheEnabled }">
                <span class="label">输入（命中缓存）({{ cacheHitPrecent }}%)</span>
                <span class="value">{{
                  formatNum(effectiveCacheHitInputTokens)
                }}</span>
                <span class="cost">{{ formatMoney(costCacheHit) }}</span>
              </div>
              <div class="card highlight">
                <span class="label">输入（未命中缓存）</span>
                <span class="value">{{
                  formatNum(effectiveCacheMissInputTokens)
                }}</span>
                <span class="cost">{{ formatMoney(costCacheMiss) }}</span>
              </div>
              <div class="card highlight">
                <span class="label">输出</span>
                <span class="value">{{ formatNum(totalOutputTokens) }}</span>
                <span class="cost">{{ formatMoney(costOutput) }}</span>
              </div>
              <div class="card total">
                <span class="label">总计</span>
                <span class="value">{{ formatMoney(totalCost) }}</span>
              </div>
            </div>
          </div>
        </GCol>
      </GRow>
    </div>
  </div>
</template>

<style scoped>
.calc {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 0 0;
}

h1 {
  font-size: 28px;
  text-align: center;
  margin: 0 0 40px;
}

h2 {
  font-size: 16px;
  margin: 0 0 20px;
  text-align: center;
  color: var(--text);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 12px;
}

.form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.form label.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.toggle-row {
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: var(--border);
  border-radius: 22px;
  transition: 0.3s;
}

.slider::before {
  content: "";
  position: absolute;
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: 0.3s;
}

.switch input:checked + .slider {
  background: var(--accent);
}

.switch input:checked + .slider::before {
  transform: translateX(18px);
}

.form input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text-h);
  font: 15px var(--mono);
  text-align: right;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form input:focus {
  border-color: var(--accent);
}

.form .unit {
  font-size: 12px;
  color: var(--text);
  text-align: center;
}

.result-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.result-row .value {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--accent-bg);
  color: var(--accent);
  font: 15px var(--mono);
  text-align: right;
  box-sizing: border-box;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px;
  border-radius: 10px;
  background: var(--code-bg);
  text-align: center;
}

.card.highlight {
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
}

.card.dimmed {
  opacity: 0.35;
}

.card.total {
  background: var(--accent);
  color: #fff;
}

.card.total .label {
  color: rgba(255, 255, 255, 0.8);
}

.card.total .value {
  color: #fff;
}

.card .label {
  font-size: 13px;
  color: var(--text);
}

.card .value {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-h);
  font-family: var(--mono);
}

.card .cost {
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
  font-family: var(--mono);
}
</style>
