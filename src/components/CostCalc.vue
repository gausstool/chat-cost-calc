<script setup lang="ts">
import { ref, computed, watch } from "vue";
import CostChart from "./CostChart.vue";

const sessions = ref(1);
const interactions = ref(16);
const inputTokens = ref(410);

// 系统提示词：真实 Agent 会话中每轮请求都携带的常驻上下文（可缓存）
const systemPromptTokens = ref(3000);

// 工具调用模拟参数（真实 Agent 会话：轮 → 步 → 工具调用的三层结构）
const toolCount = ref(15); // 工具定义数量
const toolDefTokens = ref(100); // 每个工具定义的平均 Token
const toolSteps = ref(3); // 每轮对话平均工具调用步数
const toolCallsPerStep = ref(2); // 每步平均并行工具调用数
const toolResultTokens = ref(1080); // 每工具调用结果回传输入 Token
const toolCallOutputTokens = ref(150); // 每工具调用输出 Token（tool_use 生成）

// Agent 输出：平均每步思考（reasoning，每次 LLM 调用都有，计输出；
//            携带 tools 时按拼接规则进入上下文、参与缓存）
//            + 平均每轮正文输出（最终回复，每轮一份，计输出、进入上下文）
const thinkingTokensPerStep = ref(80); // 平均每步思考 Token
const replyTokensPerRound = ref(310); // 平均每轮正文输出 Token

const cacheEnabled = ref(true);
// 缓存命中概率：每一步 LLM 调用有 p 概率命中缓存，否则缓存前缀整段失效按未命中计费
const cacheHitProb = ref(0.99);
const peakEnabled = ref(false);
const cacheHitPrice = ref(0.05);
const cacheMissPrice = ref(1.5);
const outputPrice = ref(4.5);

const totalInteractions = computed(() => sessions.value * interactions.value);

// 每轮 LLM 调用总步数 = 1 次用户消息 + 工具调用步数 + 1 次最终回复步
const llmCallsPerRound = computed(() => toolSteps.value + 2);

// 固定上下文前缀：系统提示词 + 工具定义（真实 Agent 会话中每轮请求携带，可缓存）
const constDef = computed(
  () => systemPromptTokens.value + toolCount.value * toolDefTokens.value,
);

// 是否携带 tools 参数（有工具定义即携带）：按 DeepSeek 多轮拼接规则，
// 携带 tools 时思维链必须拼接进上下文并回传（参与缓存前缀）；
// 未携带 tools 时思维链不参与上下文拼接
const hasTools = computed(() => toolCount.value > 0);

// ── 模拟计算：逐会话、逐轮、逐步（每次 LLM 调用）累计输入命中 / 未命中 ──
// 每次 LLM 调用时（期望值口径，p = 缓存命中概率）：
//  - 命中缓存输入 = p × (固定前缀 + 历史上下文)
//  - 未命中缓存输入 = 本次新增（用户消息 / 工具结果回传）+ (1-p) × (前缀 + 历史上下文)
//    （即每一步有 1-p 概率缓存丢失，前缀与历史整段按未命中计费）
//  - 工具步调用输出 tool_use；最终回复步调用新增输入为 0；
//  - 思考（reasoning）总会计入输出费用；携带 tools 时拼接进上下文，否则不进入
const simulateSession = computed(() => {
  const p = cacheHitProb.value;
  let cacheHit = 0;
  let cacheMiss = 0;
  let context = 0;

  const rounds = [];
  const steps = [];

  for (let r = 0; r < interactions.value; r++) {
    let roundCacheHit = 0;
    let roundCacheMiss = 0;
    let roundOutput = 0;

    // LLM 调用 1：用户消息
    const req1 = constDef.value + context;
    const hit1 = p * req1;
    const miss1 = inputTokens.value + (1 - p) * req1;
    let out1 = 0;
    context += inputTokens.value;
    if (toolSteps.value > 0) {
      const t1 = toolCallsPerStep.value * toolCallOutputTokens.value;
      context += t1;
      out1 += t1;
    }
    if (hasTools.value) {
      context += thinkingTokensPerStep.value;
      out1 += thinkingTokensPerStep.value;
    }
    roundCacheHit += hit1;
    roundCacheMiss += miss1;
    roundOutput += out1;
    steps.push({
      round: r + 1, step: 1, label: '用户消息',
      cacheHit: hit1, cacheMiss: miss1, output: out1,
      cost: (hit1 / 1e6) * effectiveCacheHitPrice.value + (miss1 / 1e6) * effectiveCacheMissPrice.value + (out1 / 1e6) * effectiveOutputPrice.value,
      cumulativeContext: context,
    });

    // 工具调用步
    for (let s = 1; s <= toolSteps.value; s++) {
      const toolIn = toolCallsPerStep.value * toolResultTokens.value;
      const req = constDef.value + context;
      const hitS = p * req;
      const missS = toolIn + (1 - p) * req;
      let outS = 0;
      context += toolIn;
      if (s < toolSteps.value) {
        const tS = toolCallsPerStep.value * toolCallOutputTokens.value;
        context += tS;
        outS += tS;
      }
      if (hasTools.value) {
        context += thinkingTokensPerStep.value;
        outS += thinkingTokensPerStep.value;
      }
      roundCacheHit += hitS;
      roundCacheMiss += missS;
      roundOutput += outS;
      steps.push({
        round: r + 1, step: s + 1, label: `工具步 ${s}`,
        cacheHit: hitS, cacheMiss: missS, output: outS,
        cost: (hitS / 1e6) * effectiveCacheHitPrice.value + (missS / 1e6) * effectiveCacheMissPrice.value + (outS / 1e6) * effectiveOutputPrice.value,
        cumulativeContext: context,
      });
    }

    // 最终回复步
    const reqF = constDef.value + context;
    const hitF = p * reqF;
    const missF = (1 - p) * reqF;
    let outF = 0;
    if (hasTools.value) {
      context += thinkingTokensPerStep.value;
      outF += thinkingTokensPerStep.value;
    }
    context += replyTokensPerRound.value;
    outF += replyTokensPerRound.value;
    roundCacheHit += hitF;
    roundCacheMiss += missF;
    roundOutput += outF;
    steps.push({
      round: r + 1, step: toolSteps.value + 2, label: '最终回复',
      cacheHit: hitF, cacheMiss: missF, output: outF,
      cost: (hitF / 1e6) * effectiveCacheHitPrice.value + (missF / 1e6) * effectiveCacheMissPrice.value + (outF / 1e6) * effectiveOutputPrice.value,
      cumulativeContext: context,
    });

    rounds.push({
      round: r + 1,
      cacheHit: roundCacheHit,
      cacheMiss: roundCacheMiss,
      output: roundOutput,
      cost: (roundCacheHit / 1e6) * effectiveCacheHitPrice.value + (roundCacheMiss / 1e6) * effectiveCacheMissPrice.value + (roundOutput / 1e6) * effectiveOutputPrice.value,
      cumulativeContext: context,
    });

    cacheHit += roundCacheHit;
    cacheMiss += roundCacheMiss;
  }
  return { cacheHit, cacheMiss, context, rounds, steps };
});

// 每轮输出 = 工具调用生成 + 思考（每次 LLM 调用都有）+ 每轮正文
const outputPerRound = computed(
  () =>
    toolSteps.value *
      toolCallsPerStep.value *
      toolCallOutputTokens.value +
    llmCallsPerRound.value * thinkingTokensPerStep.value +
    replyTokensPerRound.value,
);

const totalOutputTokens = computed(
  () => totalInteractions.value * outputPerRound.value,
);

// 实际上下文长度：会话结束时累积的上下文总量
// （历史输入 + 历史输出 + 思考 + 正文，对照真实会话统计的窗口占用）
const avgContextPerSession = computed(
  () => simulateSession.value.context,
);

const cacheHitInputTokens = computed(
  () => simulateSession.value.cacheHit * sessions.value,
);

const cacheMissInputTokens = computed(
  () => simulateSession.value.cacheMiss * sessions.value,
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

function formatTokenShort(n: number): string {
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return n.toString();
}
</script>

<template>
  <div class="calc">
    <h1>对话费用估算</h1>
    <div class="columns">
      <GRow>
        <GCol :span="3" :xs="12">
          <div class="column">
            <h2>价格</h2>
            <div class="form">
              <label class="toggle-row">
                <span>高峰时段（价格 ×2）</span>
                <label class="switch">
                  <input type="checkbox" v-model="peakEnabled" />
                  <span class="slider"></span>
                </label>
              </label>
              <label class="toggle-row">
                <span>支持缓存</span>
                <label class="switch">
                  <input type="checkbox" v-model="cacheEnabled" />
                  <span class="slider"></span>
                </label>
              </label>
              <label :class="{ disabled: !cacheEnabled }">
                <span>缓存概率</span>
                <input
                  v-model.number="cacheHitProb"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  :disabled="!cacheEnabled"
                />
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
        <GCol :span="3" :xs="12">
          <div class="column">
            <h2>Agent 模拟</h2>
            <div class="form">
              <label>
                <span>输出（每步思考 × 每轮正文）Token</span>
                <div class="inline-inputs">
                  <input
                    v-model.number="thinkingTokensPerStep"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="每步思考 Token"
                  />
                  <input
                    v-model.number="replyTokensPerRound"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="每轮正文 Token"
                  />
                </div>
              </label>
              <label>
                <span>工具定义（数量 × 每工具 Token）</span>
                <div class="inline-inputs">
                  <input
                    v-model.number="toolCount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="数量"
                  />
                  <input
                    v-model.number="toolDefTokens"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="每工具定义 Token"
                  />
                </div>
              </label>
              <label>
                <span>工具调用（每轮步数 × 每步调用数）</span>
                <div class="inline-inputs">
                  <input
                    v-model.number="toolSteps"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="每轮步数"
                  />
                  <input
                    v-model.number="toolCallsPerStep"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="每步调用数"
                  />
                </div>
              </label>
              <label>
                <span>每工具调用（结果输入 × 调用输出）Token</span>
                <div class="inline-inputs">
                  <input
                    v-model.number="toolResultTokens"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="结果输入 Token"
                  />
                  <input
                    v-model.number="toolCallOutputTokens"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="调用输出 Token"
                  />
                </div>
              </label>
              <div class="result-row">
                <span>每轮 LLM 调用次数</span>
                <span class="value">{{ formatNum(llmCallsPerRound) }}</span>
              </div>
            </div>
          </div>
        </GCol>
        <GCol :span="3" :xs="12">
          <div class="column">
            <h2>交互习惯</h2>
            <div class="form">
              <label>
                <span>系统提示词 Token</span>
                <input
                  v-model.number="systemPromptTokens"
                  type="number"
                  min="0"
                  step="1000"
                />
              </label>
              <label>
                <span>每天会话次数</span>
                <input v-model.number="sessions" type="number" min="1" />
              </label>
              <label>
                <span>每会话对话轮数</span>
                <input v-model.number="interactions" type="number" min="1" />
              </label>
              <label>
                <span>每轮输入 Token</span>
                <input v-model.number="inputTokens" type="number" min="1" />
              </label>
              <div class="result-row">
                <span>会话上下文长度</span>
                <span class="value">{{ formatNum(avgContextPerSession) }}</span>
              </div>
            </div>
          </div>
        </GCol>
        <GCol :span="3" :xs="12">
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
                <span class="label">输出（含工具调用）</span>
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
    
    <!-- 图表面板 -->
    <CostChart
      :rounds="simulateSession.rounds"
      :steps="simulateSession.steps"
      :cache-hit-price="effectiveCacheHitPrice"
      :cache-miss-price="effectiveCacheMissPrice"
      :output-price="effectiveOutputPrice"
    />
  </div>
</template>

<style scoped>
.calc {
  max-width: 1200px;
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

.inline-inputs {
  display: flex;
  gap: 8px;
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

.group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: 20px;
  border-radius: 12px;
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
