chrome.runtime.onInstalled.addListener(()=>{console.log("TabFlow 扩展已安装")});chrome.tabs.onUpdated.addListener((t,e,o)=>{e.status==="complete"&&console.log("标签页更新:",o.title)});
//# sourceMappingURL=worker.js.js.map
