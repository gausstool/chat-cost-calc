<script setup lang="ts">
import { ref, computed } from "vue";

const sessions = ref(50);
const interactions = ref(5);
const inputTokens = ref(500);
const outputTokens = ref(2000);

const cacheHitPrice = ref(0.02);
const cacheMissPrice = ref(1);
const outputPrice = ref(2);

const totalInteractions = computed(() => sessions.value * interactions.value);

const totalOutputTokens = computed(
  () => totalInteractions.value * outputTokens.value,
);

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

const costCacheMiss = computed(
  () => (cacheMissInputTokens.value / 1_000_000) * cacheMissPrice.value,
);
const costCacheHit = computed(
  () => (cacheHitInputTokens.value / 1_000_000) * cacheHitPrice.value,
);
const costOutput = computed(
  () => (totalOutputTokens.value / 1_000_000) * outputPrice.value,
);
const totalCost = computed(() => costCacheMiss.value + costCacheHit.value + costOutput.value);

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
      <div class="column">
        <h2>价格(每百万 Token)</h2>
        <div class="form">
          <label>
            <span>输入（命中缓存）</span>
            <input
              v-model.number="cacheHitPrice"
              type="number"
              min="0"
              step="0.01"
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
        </div>
      </div>

      <div class="column">
        <h2>预估消耗</h2>
        <div class="results">
          <div class="card highlight">
            <span class="label">输入（命中缓存）</span>
            <span class="value">{{ formatNum(cacheHitInputTokens) }}</span>
            <span class="cost">{{ formatMoney(costCacheHit) }}</span>
          </div>
          <div class="card highlight">
            <span class="label">输入（未命中缓存）</span>
            <span class="value">{{ formatNum(cacheMissInputTokens) }}</span>
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
    </div>
  </div>
</template>

<style scoped>
.calc {
  max-width: 1060px;
  margin: 0 auto;
  padding: 40px 24px;
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
.columns {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.column {
  flex: 1;
  min-width: 0;
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
