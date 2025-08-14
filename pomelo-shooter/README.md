# 射击柚子（实时积分排名）

一个基于 Node.js + Socket.IO + HTML5 Canvas 的多人在线休闲小游戏：点击射击屏幕中的柚子，实时更新积分榜。

## 运行

```bash
node server.js
```

默认在 `http://localhost:3000` 运行。

## 功能
- 实时同步柚子位置
- 点击命中即加分
- 实时积分排行榜（前 10 名）
- 支持修改昵称

## 目录结构
- `server.js`：服务器端逻辑（Express + Socket.IO）
- `public/index.html`：页面框架与 UI
- `public/client.js`：客户端渲染与交互逻辑
- `public/styles.css`：样式