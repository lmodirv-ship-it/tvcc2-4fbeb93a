import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/javascript; charset=utf-8",
};

const SCRIPT = `(function(){
  var key = document.currentScript && document.currentScript.dataset.key;
  if (!key) return;
  var base = document.currentScript.src.replace(/\\/badge\\.js.*/, '');
  function createBadge(data){
    var div = document.createElement('div');
    div.id = 'manara-badge-' + key;
    div.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:9999;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#10b981,#f59e0b,#06b6d4);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 18px rgba(16,185,129,.45);transition:transform .2s;';
    div.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l9 4v6c0 5.5-3.8 10.7-9 12-5.2-1.3-9-6.5-9-12V6z"/><circle cx="12" cy="10" r="3"/></svg>';
    div.title = 'منارة — مركز التوجيه الحي';
    div.onclick = function(){
      var current = data && data.current ? data.current.url : '#';
      window.open(current, '_blank');
    };
    document.body.appendChild(div);
  }
  fetch(base + '/resolve?key=' + encodeURIComponent(key))
    .then(function(r){ return r.json(); })
    .then(function(data){ createBadge(data); })
    .catch(function(){ createBadge(null); });
})();`;

export const Route = createFileRoute("/api/public/manara/badge")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => new Response(SCRIPT, { headers: CORS }),
    },
  },
});
