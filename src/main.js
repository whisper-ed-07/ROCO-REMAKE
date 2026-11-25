function init() { try { initSettings(); showScreen("intro"); } catch(e) { document.body.innerHTML = "<div style='color:lime;background:#111;padding:20px;font-family:monospace;font-size:14px'><h2 style='color:red'>INIT ERROR</h2><pre>"+e.stack+"</pre></div>"; } }
init();



