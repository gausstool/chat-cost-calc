# 对话费用估算

基于 Vite + Vue 3 + TypeScript 构建的对话 Token 费用估算工具。

## 功能

输入每天会话次数、每次会话交互次数、每次交互的输入/输出 Token 数，以及每百万 Token 的价格，自动计算：

- **命中缓存**：利用历史缓存，每次交互累积上下文 → Token 数多，但单价低
- **未命中缓存**：无缓存，每次交互只算新输入 → Token 数少，但单价高
- **输出 Token 数**及对应费用

## 使用

```bash
npm install
npm run dev
```
