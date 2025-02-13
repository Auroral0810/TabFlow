import{M as t}from"./MemoryService.js";chrome.runtime.onInstalled.addListener(()=>{console.log("TabFlow 扩展已安装"),new t});chrome.tabs.onUpdated.addListener((e,o,r)=>{o.status==="complete"&&console.log("标签页更新:",r.title)});chrome.runtime.onMessage.addListener((e,o,r)=>{e.type==="restoreTab"&&new t().restoreTab(e.tabId)});
//# sourceMappingURL=worker.js.js.map
